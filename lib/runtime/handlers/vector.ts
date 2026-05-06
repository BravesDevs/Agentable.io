import type { EmitFn, NodeContext, RagContext, SessionKeys } from '@/lib/types'
import { isProviderId, type ProviderId } from '@/lib/providers/registry'
import { currentUserId } from '@/lib/auth'
import {
  embedQuery,
  queryStore,
  upsertEmbeddings,
  type IndexType,
  type Metric,
} from '@/services/vector-store'

interface VectorConfig {
  storeName?:  string
  indexType?:  IndexType
  metric?:     Metric
  mode?:       'auto' | 'index' | 'query'
  topK?:       number
  topP?:       number    // similarity threshold (0..1 for cosine, 0 = disabled)
  injectInto?: 'context' | 'messages' | 'output'
  replace?:    boolean   // when indexing, drop existing rows first
}

const CONTEXT_PREFIX = 'Use the following retrieved context to answer. Cite specifics; do not invent details.\n\n'

function formatHits(hits: RagContext['hits']): string {
  return hits
    .map((h, i) => {
      const score = (h.score * 100).toFixed(1)
      return `[${i + 1}] (score=${score}) ${h.content}`
    })
    .join('\n\n')
}

export async function handleVector(
  nodeId:  string,
  config:  VectorConfig | undefined,
  context: NodeContext,
  emit:    EmitFn,
): Promise<NodeContext> {
  const cfg: Required<VectorConfig> = {
    storeName:  config?.storeName  ?? 'default',
    indexType:  config?.indexType  ?? 'flat',
    metric:     config?.metric     ?? 'cosine',
    mode:       config?.mode       ?? 'auto',
    topK:       config?.topK       ?? 5,
    topP:       config?.topP       ?? 0,
    injectInto: config?.injectInto ?? 'context',
    replace:    config?.replace    ?? false,
  }

  const flowId = context.flowId
  if (!flowId) {
    throw Object.assign(new Error('Vector node requires a flow id (run from a saved flow).'), {
      errorMeta: { code: 'unknown', message: 'Vector node requires a flow id' },
    })
  }

  const t0 = Date.now()
  const payload = context.embeddings
  const userId = await currentUserId()
  const sessionKeys = context.sessionKeys as SessionKeys | undefined

  // ── Resolve mode ──────────────────────────────────────────────────────────
  // index: chunks present and either explicit, or auto without an embedded query
  // query: embedded query present, OR plain text input + an existing store
  const wantIndex =
    cfg.mode === 'index' ||
    (cfg.mode === 'auto' && payload?.chunks.length && !payload.query)
  const wantQuery =
    cfg.mode === 'query' ||
    (cfg.mode === 'auto' && (payload?.query || (!payload && (context.output || context.input))))

  // ── Index path ────────────────────────────────────────────────────────────
  if (wantIndex && payload && payload.chunks.length > 0) {
    if (!isProviderId(payload.provider)) {
      throw Object.assign(new Error(`Unknown provider on embedding payload: ${payload.provider}`), {
        errorMeta: { code: 'unknown', message: 'Unknown provider on embedding payload' },
      })
    }
    try {
      const { inserted } = await upsertEmbeddings({
        flowId,
        nodeId,
        storeName:  cfg.storeName,
        provider:   payload.provider as ProviderId,
        model:      payload.model,
        dimensions: payload.dimensions,
        indexType:  cfg.indexType,
        metric:     cfg.metric,
        records:    payload.chunks,
        replace:    cfg.replace,
        config:     { topK: cfg.topK, topP: cfg.topP },
      })

      const summary = {
        mode:    'index',
        store:   cfg.storeName,
        index:   cfg.indexType,
        metric:  cfg.metric,
        stored:  inserted,
        dims:    payload.dimensions,
      }
      emit({ type: 'node-replace', nodeId, output: JSON.stringify(summary, null, 2) })
      const durationMs = Date.now() - t0
      return {
        ...context,
        output:  JSON.stringify(summary),
        runMeta: { ...(context.runMeta ?? {}), mode: 'index', vectorCount: inserted, dimensions: payload.dimensions, durationMs },
      } as NodeContext
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      emit({ type: 'node-replace', nodeId, output: JSON.stringify({ error: msg }, null, 2) })
      throw Object.assign(new Error(msg), { errorMeta: { code: 'unknown', message: msg } })
    }
  }

  // ── Query path ────────────────────────────────────────────────────────────
  if (!wantQuery) {
    const summary = { mode: 'noop', note: 'no embeddings to index and no query text' }
    emit({ type: 'node-replace', nodeId, output: JSON.stringify(summary, null, 2) })
    return { ...context, output: JSON.stringify(summary) }
  }

  // Build the query embedding. Either it rode in on the embedding payload,
  // or we embed the upstream text using the same model the store was built with.
  let queryEmbedding = payload?.query?.embedding
  if (!queryEmbedding) {
    if (!payload) {
      // No embedding payload at all — we need to know what model the store
      // uses. The vector store row carries that, but the embed call needs a
      // provider+model up front. For now, default to OpenAI text-embedding-3-small
      // and surface an error if the user hasn't configured a key.
      const text = context.output ?? context.input ?? ''
      if (!text) {
        const summary = { mode: 'query', note: 'no query text' }
        emit({ type: 'node-replace', nodeId, output: JSON.stringify(summary, null, 2) })
        return { ...context, output: JSON.stringify(summary) }
      }
      try {
        queryEmbedding = await embedQuery({
          provider: 'openai',
          model:    'text-embedding-3-small',
          text,
          userId,
          sessionKeys,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        emit({ type: 'node-replace', nodeId, output: JSON.stringify({ error: msg }, null, 2) })
        throw Object.assign(new Error(msg), { errorMeta: { code: 'unknown', message: msg } })
      }
    } else {
      const text = context.output ?? context.input ?? ''
      try {
        queryEmbedding = await embedQuery({
          provider: payload.provider as ProviderId,
          model:    payload.model,
          text,
          userId,
          sessionKeys,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        emit({ type: 'node-replace', nodeId, output: JSON.stringify({ error: msg }, null, 2) })
        throw Object.assign(new Error(msg), { errorMeta: { code: 'unknown', message: msg } })
      }
    }
  }

  const { hits } = await queryStore({
    flowId,
    nodeId,
    storeName:      cfg.storeName,
    queryEmbedding,
    topK:           cfg.topK,
    threshold:      cfg.topP,
  })

  const rag: RagContext = { storeName: cfg.storeName, hits }
  const formatted = formatHits(hits)

  // Inject retrieved context into the downstream payload according to config:
  //   - 'context': prepend a primer block to `output` (LLM uses as user prompt)
  //   - 'messages': add a system message ahead of any existing messages
  //   - 'output': replace output with the raw retrieved chunks
  const next: NodeContext = { ...context, rag }
  const incomingMessages = context.messages ?? []

  if (cfg.injectInto === 'output') {
    next.output = formatted
  } else if (cfg.injectInto === 'messages') {
    const existingUser = context.output ?? context.input ?? ''
    next.output = existingUser
    next.messages = [
      { role: 'system', content: CONTEXT_PREFIX + formatted },
      ...incomingMessages,
    ]
  } else {
    const existingUser = context.output ?? context.input ?? ''
    next.output = `${CONTEXT_PREFIX}${formatted}\n\n---\n\nQuestion: ${existingUser}`
    next.messages = [{ role: 'user', content: next.output }]
  }

  const summary = {
    mode:    'query',
    store:   cfg.storeName,
    metric:  cfg.metric,
    topK:    cfg.topK,
    topP:    cfg.topP,
    matched: hits.length,
    hits:    hits.map((h, i) => ({
      rank:    i + 1,
      score:   Number(h.score.toFixed(4)),
      preview: h.content.length > 160 ? h.content.slice(0, 160) + '…' : h.content,
    })),
  }
  emit({ type: 'node-replace', nodeId, output: JSON.stringify(summary, null, 2) })

  const durationMs = Date.now() - t0
  return {
    ...next,
    runMeta: { ...(next.runMeta ?? {}), mode: 'query', vectorCount: hits.length, topK: cfg.topK, durationMs },
  } as NodeContext
}
