// Vector store service. Wraps:
//   • embedding generation via the AI SDK (`embedMany` / `embed`)
//   • upsert + similarity query against the `embeddings` / `vector_stores` tables
//
// Storage shape is portable JSON-backed (jsonb embedding column). Similarity
// scoring runs in-process so the same code path works whether or not the
// pgvector extension is enabled. When pgvector is later added, the query path
// can be swapped for a server-side `<=> ` operator without changing callers.

import { and, eq } from 'drizzle-orm'
import { embed, embedMany } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { db } from '@/lib/db/client'
import { embeddings, vectorStores } from '@/lib/db/schema'
import { LLMManager } from '@/lib/llm-manager'
import { PROVIDERS, type ProviderId } from '@/lib/providers/registry'
import type { SessionKeys } from '@/lib/types'

export type IndexType = 'flat' | 'hnsw' | 'ivfflat'
export type Metric    = 'cosine' | 'l2' | 'dot'

export interface EmbedTextsArgs {
  provider:    ProviderId
  model:       string
  texts:       string[]
  userId:      string
  sessionKeys?: SessionKeys
}

export interface ChunkRecord {
  content:   string
  embedding: number[]
  metadata?: Record<string, unknown>
}

export interface UpsertArgs {
  flowId:     string
  nodeId:     string
  storeName:  string
  provider:   ProviderId
  model:      string
  dimensions: number
  indexType:  IndexType
  metric:     Metric
  config?:    Record<string, unknown>
  records:    ChunkRecord[]
  /** When true, deletes any existing rows in the store before inserting. */
  replace?:   boolean
}

export interface QueryArgs {
  flowId:     string
  nodeId:     string
  storeName?: string
  queryEmbedding: number[]
  topK:       number
  /** Min similarity score (0..1 for cosine). 0 disables thresholding. */
  threshold?: number
}

export interface QueryHit {
  id:       string
  content:  string
  score:    number
  metadata: Record<string, unknown>
}

// ─── Embedding ────────────────────────────────────────────────────────────────

/**
 * Resolve an embedding model instance for the user's configured provider.
 * Only OpenAI-compatible providers expose `textEmbeddingModel`; others throw.
 * The user-facing error is what surfaces in the node UI.
 */
async function resolveEmbeddingModel(
  provider: ProviderId,
  modelId:  string,
  userId:   string,
  sessionKeys?: SessionKeys,
) {
  const apiKey = await LLMManager.forUser(userId).getKey(provider, sessionKeys)
  if (!apiKey) {
    throw new Error(`No API key configured for "${provider}" — open the Embedding node and add one.`)
  }
  const baseURL = PROVIDERS[provider].baseUrl
  if (provider === 'anthropic') {
    throw new Error('Anthropic does not expose embedding models. Use OpenAI or Google for embeddings.')
  }
  const openai = createOpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
  return openai.textEmbeddingModel(modelId)
}

export async function embedTexts(args: EmbedTextsArgs): Promise<number[][]> {
  const model = await resolveEmbeddingModel(args.provider, args.model, args.userId, args.sessionKeys)
  if (args.texts.length === 0) return []
  if (args.texts.length === 1) {
    const { embedding } = await embed({ model, value: args.texts[0] })
    return [embedding]
  }
  const { embeddings: vecs } = await embedMany({ model, values: args.texts })
  return vecs
}

export async function embedQuery(args: Omit<EmbedTextsArgs, 'texts'> & { text: string }): Promise<number[]> {
  const model = await resolveEmbeddingModel(args.provider, args.model, args.userId, args.sessionKeys)
  const { embedding } = await embed({ model, value: args.text })
  return embedding
}

// ─── Store lifecycle ──────────────────────────────────────────────────────────

/**
 * Returns the vector store row for `(flowId, nodeId)`, creating it on first
 * call. Subsequent calls update mutable config fields so the store always
 * reflects the node's current configuration.
 */
export async function ensureStore(args: {
  flowId:     string
  nodeId:     string
  storeName:  string
  provider:   ProviderId
  model:      string
  dimensions: number
  indexType:  IndexType
  metric:     Metric
  config?:    Record<string, unknown>
}) {
  const [existing] = await db
    .select()
    .from(vectorStores)
    .where(and(eq(vectorStores.flowId, args.flowId), eq(vectorStores.nodeId, args.nodeId)))
    .limit(1)

  if (existing) {
    if (
      existing.model      !== args.model     ||
      existing.provider   !== args.provider  ||
      existing.dimensions !== args.dimensions ||
      existing.indexType  !== args.indexType ||
      existing.metric     !== args.metric    ||
      existing.name       !== args.storeName
    ) {
      const [updated] = await db
        .update(vectorStores)
        .set({
          name:       args.storeName,
          provider:   args.provider,
          model:      args.model,
          dimensions: args.dimensions,
          indexType:  args.indexType,
          metric:     args.metric,
          config:     args.config ?? {},
        })
        .where(eq(vectorStores.id, existing.id))
        .returning()
      return updated
    }
    return existing
  }

  const [created] = await db
    .insert(vectorStores)
    .values({
      flowId:     args.flowId,
      nodeId:     args.nodeId,
      name:       args.storeName,
      provider:   args.provider,
      model:      args.model,
      dimensions: args.dimensions,
      indexType:  args.indexType,
      metric:     args.metric,
      config:     args.config ?? {},
    })
    .returning()
  return created
}

export async function upsertEmbeddings(args: UpsertArgs): Promise<{ storeId: string; inserted: number }> {
  const store = await ensureStore({
    flowId:     args.flowId,
    nodeId:     args.nodeId,
    storeName:  args.storeName,
    provider:   args.provider,
    model:      args.model,
    dimensions: args.dimensions,
    indexType:  args.indexType,
    metric:     args.metric,
    config:     args.config,
  })

  if (args.replace) {
    await db.delete(embeddings).where(eq(embeddings.storeId, store.id))
  }

  if (args.records.length === 0) return { storeId: store.id, inserted: 0 }

  await db.insert(embeddings).values(
    args.records.map((r, i) => ({
      storeId:    store.id,
      flowId:     args.flowId,
      chunkIndex: i,
      content:    r.content,
      embedding:  r.embedding,
      metadata:   r.metadata ?? {},
    })),
  )
  return { storeId: store.id, inserted: args.records.length }
}

// ─── Query ────────────────────────────────────────────────────────────────────

function dot(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

function norm(v: number[]): number {
  let s = 0
  for (const x of v) s += x * x
  return Math.sqrt(s)
}

function cosine(a: number[], b: number[]): number {
  const denom = norm(a) * norm(b)
  return denom === 0 ? 0 : dot(a, b) / denom
}

function l2Distance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i]
    s += d * d
  }
  return Math.sqrt(s)
}

function score(metric: Metric, a: number[], b: number[]): number {
  if (metric === 'cosine') return cosine(a, b)
  if (metric === 'dot')    return dot(a, b)
  // l2: convert distance to similarity in (0, 1]
  return 1 / (1 + l2Distance(a, b))
}

export async function queryStore(args: QueryArgs): Promise<{ storeId: string | null; hits: QueryHit[] }> {
  // Resolve the store row. Primary lookup is (flowId, nodeId) — that row exists
  // when the same node both indexed and is now querying. When a storeName is
  // provided we also fall back to (flowId, storeName) so a separate Vector node
  // (or another node that previously seeded the store) can be reached by name.
  let [store] = await db
    .select()
    .from(vectorStores)
    .where(and(eq(vectorStores.flowId, args.flowId), eq(vectorStores.nodeId, args.nodeId)))
    .limit(1)

  if ((!store || (args.storeName && store.name !== args.storeName)) && args.storeName) {
    const named = await db
      .select()
      .from(vectorStores)
      .where(and(eq(vectorStores.flowId, args.flowId), eq(vectorStores.name, args.storeName)))
      .limit(1)
    if (named[0]) store = named[0]
  }

  if (!store) return { storeId: null, hits: [] }
  if (args.storeName && store.name !== args.storeName) return { storeId: store.id, hits: [] }

  const rows = await db
    .select({
      id:        embeddings.id,
      content:   embeddings.content,
      embedding: embeddings.embedding,
      metadata:  embeddings.metadata,
    })
    .from(embeddings)
    .where(eq(embeddings.storeId, store.id))

  const metric = (store.metric ?? 'cosine') as Metric
  const scored = rows.map((r) => ({
    id:       r.id,
    content:  r.content,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    score:    score(metric, args.queryEmbedding, r.embedding as unknown as number[]),
  }))

  scored.sort((a, b) => b.score - a.score)
  const threshold = args.threshold ?? 0
  const filtered = threshold > 0 ? scored.filter((h) => h.score >= threshold) : scored
  return { storeId: store.id, hits: filtered.slice(0, Math.max(1, args.topK)) }
}

// ─── Chunking ─────────────────────────────────────────────────────────────────
// Recursive character splitter: paragraphs → sentences → words. Token counts
// are approximated by chars/4 (good enough for chunk sizing without bringing
// in a tokenizer).

const SEPARATORS = ['\n\n', '\n', '. ', ' ', '']

function splitRecursive(text: string, sepIdx: number, target: number): string[] {
  if (text.length <= target) return [text]
  const sep = SEPARATORS[sepIdx] ?? ''
  if (sep === '') {
    const out: string[] = []
    for (let i = 0; i < text.length; i += target) out.push(text.slice(i, i + target))
    return out
  }
  const parts = text.split(sep)
  const out:   string[] = []
  let buf = ''
  for (const p of parts) {
    const candidate = buf ? buf + sep + p : p
    if (candidate.length <= target) {
      buf = candidate
      continue
    }
    if (buf) out.push(buf)
    if (p.length > target) {
      out.push(...splitRecursive(p, sepIdx + 1, target))
      buf = ''
    } else {
      buf = p
    }
  }
  if (buf) out.push(buf)
  return out
}

export function chunkText(text: string, chunkSize = 512, overlap = 64): string[] {
  // chunkSize is in tokens (~4 chars/token); convert to chars
  const targetChars  = Math.max(64, chunkSize  * 4)
  const overlapChars = Math.max(0,  Math.min(overlap * 4, targetChars - 1))
  const pieces = splitRecursive(text.trim(), 0, targetChars).filter((p) => p.trim().length > 0)
  if (overlapChars === 0 || pieces.length <= 1) return pieces
  const out: string[] = [pieces[0]]
  for (let i = 1; i < pieces.length; i++) {
    const tail = out[out.length - 1].slice(-overlapChars)
    out.push(tail + pieces[i])
  }
  return out
}
