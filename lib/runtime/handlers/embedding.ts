import type { EmitFn, EmbeddingPayload, NodeContext, SessionKeys } from '@/lib/types'
import { isProviderId, type ProviderId } from '@/lib/providers/registry'
import { currentUserId } from '@/lib/auth'
import { chunkText, embedQuery, embedTexts } from '@/services/vector-store'

interface EmbeddingConfig {
  provider?:     string
  model?:        string
  dimensions?:   number
  chunkSize?:    number
  chunkOverlap?: number
  sourceField?:  string   // 'auto' | 'output' | 'input' | 'dbRows' | named context key
}

/**
 * Pulls the text payload to embed off the upstream context.
 *   - 'auto' (default): prefer dbRows → output → input. dbRows are stringified
 *     row-by-row so each row becomes its own chunk.
 *   - named field: read context[name] and stringify if needed.
 */
function gatherSourceTexts(ctx: NodeContext, sourceField: string): { texts: string[]; queryText: string | null } {
  const out = ctx.output ?? ''
  const inp = ctx.input  ?? ''

  if (sourceField !== 'auto') {
    const v = ctx[sourceField]
    if (v === undefined || v === null) return { texts: [], queryText: null }
    if (Array.isArray(v)) return { texts: v.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))), queryText: null }
    if (typeof v === 'string') return { texts: [v], queryText: v }
    return { texts: [JSON.stringify(v)], queryText: null }
  }

  // auto: rows from a Database node split into one chunk per row, otherwise
  // treat the streamed output as a document to be re-chunked.
  if (Array.isArray(ctx.dbRows) && ctx.dbRows.length > 0) {
    return { texts: ctx.dbRows.map((r) => JSON.stringify(r)), queryText: out || inp || null }
  }
  if (out)  return { texts: [out], queryText: out }
  if (inp)  return { texts: [inp], queryText: inp }
  return { texts: [], queryText: null }
}

export async function handleEmbedding(
  nodeId:  string,
  config:  EmbeddingConfig | undefined,
  context: NodeContext,
  emit:    EmitFn,
): Promise<NodeContext> {
  const cfg: Required<EmbeddingConfig> = {
    provider:     config?.provider     ?? 'openai',
    model:        config?.model        ?? 'text-embedding-3-small',
    dimensions:   config?.dimensions   ?? 1536,
    chunkSize:    config?.chunkSize    ?? 512,
    chunkOverlap: config?.chunkOverlap ?? 64,
    sourceField:  config?.sourceField  ?? 'auto',
  }

  if (!isProviderId(cfg.provider)) {
    throw Object.assign(new Error(`Unknown embedding provider: ${cfg.provider}`), {
      errorMeta: { code: 'unknown', message: `Unknown embedding provider: ${cfg.provider}` },
    })
  }
  const provider: ProviderId = cfg.provider

  const t0 = Date.now()
  const { texts, queryText } = gatherSourceTexts(context, cfg.sourceField)

  // Re-chunk single long documents so we get useful retrieval granularity.
  // Pre-chunked sources (DB rows) flow through as-is.
  const inputCameAsRows = Array.isArray(context.dbRows) && context.dbRows.length > 0
  const chunks = inputCameAsRows
    ? texts
    : texts.flatMap((t) => chunkText(t, cfg.chunkSize, cfg.chunkOverlap))

  if (chunks.length === 0) {
    emit({ type: 'node-replace', nodeId, output: '{ "vectors": 0, "note": "no source text" }' })
    return { ...context, embeddings: { provider, model: cfg.model, dimensions: cfg.dimensions, chunks: [] } }
  }

  const userId      = await currentUserId()
  const sessionKeys = context.sessionKeys as SessionKeys | undefined

  let vectors: number[][]
  try {
    vectors = await embedTexts({
      provider,
      model:    cfg.model,
      texts:    chunks,
      userId,
      sessionKeys,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    emit({ type: 'node-replace', nodeId, output: JSON.stringify({ error: msg }, null, 2) })
    throw Object.assign(new Error(msg), {
      errorMeta: { code: 'unknown', message: msg, provider, model: cfg.model },
    })
  }

  const dims = vectors[0]?.length ?? cfg.dimensions
  const payload: EmbeddingPayload = {
    provider,
    model:      cfg.model,
    dimensions: dims,
    chunks: chunks.map((content, i) => ({
      content,
      embedding: vectors[i] ?? [],
      metadata:  { chunkIndex: i, source: cfg.sourceField },
    })),
  }

  // When the upstream looks like a question (single short text, no rows), also
  // embed it as a query so a downstream Vector node can switch into query mode.
  if (queryText && !inputCameAsRows && chunks.length <= 2) {
    try {
      const qVec = chunks.length === 1 && queryText === chunks[0]
        ? vectors[0]
        : await embedQuery({ provider, model: cfg.model, text: queryText, userId, sessionKeys })
      payload.query = { text: queryText, embedding: qVec }
    } catch {
      // query embed failure shouldn't fail the whole index step
    }
  }

  const summary = {
    provider,
    model:      cfg.model,
    dimensions: dims,
    vectors:    payload.chunks.length,
    sample:     payload.chunks.slice(0, 1).map((c) => ({
      content: c.content.length > 200 ? c.content.slice(0, 200) + '…' : c.content,
      preview: c.embedding.slice(0, 4),
    })),
  }
  emit({ type: 'node-replace', nodeId, output: JSON.stringify(summary, null, 2) })

  const durationMs = Date.now() - t0
  return {
    ...context,
    output:     JSON.stringify(summary),
    embeddings: payload,
    runMeta:    { ...(context.runMeta ?? {}), vectorCount: payload.chunks.length, dimensions: dims, durationMs },
  } as NodeContext
}
