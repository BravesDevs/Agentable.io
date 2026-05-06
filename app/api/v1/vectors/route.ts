// GET /api/v1/vectors?flowId=&nodeId=&limit=
//
// Lists rows in the `embeddings` table for a single VectorNode, scoped by
// (flowId, nodeId). Embeddings are streamed back with a small numeric preview
// (first 8 dims) instead of the full vector so payloads stay manageable for
// 1536-dim models.

import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { embeddings, vectorStores } from '@/lib/db/schema'

export const runtime = 'nodejs'

const DEFAULT_LIMIT = 50
const MAX_LIMIT     = 500
const PREVIEW_DIMS  = 8

const SCHEMA = [
  { column: 'id',          type: 'uuid',      note: 'primary key'                  },
  { column: 'store_id',    type: 'uuid',      note: 'FK → vector_stores.id'        },
  { column: 'flow_id',     type: 'uuid',      note: 'FK → flows.id'                },
  { column: 'chunk_index', type: 'integer',   note: 'order within source document' },
  { column: 'content',     type: 'text',      note: 'raw chunk text'               },
  { column: 'embedding',   type: 'jsonb',     note: 'number[] — model dimensions'  },
  { column: 'metadata',    type: 'jsonb',     note: '{ source, page, … }'          },
  { column: 'created_at',  type: 'timestamp', note: 'insert time'                  },
] as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const url     = new URL(request.url)
  const flowId  = url.searchParams.get('flowId')
  const nodeId  = url.searchParams.get('nodeId')
  const limit   = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)))

  if (!flowId || !nodeId) {
    return Response.json({ error: 'flowId and nodeId are required' }, { status: 400 })
  }
  // Drizzle/Postgres rejects non-UUID values on a uuid column with a low-level
  // error. Treat unsaved/local flow ids as "no store yet" so the sidebar shows
  // an empty state instead of bubbling a 500 to the client.
  if (!UUID_RE.test(flowId)) {
    return Response.json({ schema: SCHEMA, store: null, rows: [], total: 0 })
  }

  try {
    const [store] = await db
      .select()
      .from(vectorStores)
      .where(and(eq(vectorStores.flowId, flowId), eq(vectorStores.nodeId, nodeId)))
      .limit(1)

    if (!store) {
      return Response.json({ schema: SCHEMA, store: null, rows: [], total: 0 })
    }

    const rows = await db
      .select({
        id:         embeddings.id,
        chunkIndex: embeddings.chunkIndex,
        content:    embeddings.content,
        embedding:  embeddings.embedding,
        metadata:   embeddings.metadata,
        createdAt:  embeddings.createdAt,
      })
      .from(embeddings)
      .where(eq(embeddings.storeId, store.id))
      .orderBy(asc(embeddings.chunkIndex))
      .limit(limit)

    const shaped = rows.map((r) => {
      const vec = (r.embedding as unknown as number[]) ?? []
      return {
        id:         r.id,
        chunkIndex: r.chunkIndex,
        content:    r.content,
        preview:    vec.slice(0, PREVIEW_DIMS),
        dims:       vec.length,
        metadata:   r.metadata,
        createdAt:  r.createdAt,
      }
    })

    return Response.json({
      schema: SCHEMA,
      store: {
        id:         store.id,
        name:       store.name,
        provider:   store.provider,
        model:      store.model,
        dimensions: store.dimensions,
        indexType:  store.indexType,
        metric:     store.metric,
        createdAt:  store.createdAt,
      },
      rows:  shaped,
      total: shaped.length,
      limit,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[vectors] list failed', err)
    return Response.json({ error: message, schema: SCHEMA, store: null, rows: [], total: 0 }, { status: 500 })
  }
}
