import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { flows, runs, runNodes } from '@/lib/db/schema'
import { execute } from '@/lib/runtime/execute'
import { createRun, publishChunk, closeRun } from '@/lib/runtime/runStore'
import { formatSSE, type FileData, type FlowGraph, type SessionKeys, type SSEEvent, type TokenUsage } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300

const TRUNCATE_BYTES = 10_240  // 10 KB

function truncate(s: string | undefined): string | undefined {
  if (!s || s.length <= TRUNCATE_BYTES) return s
  return s.slice(0, TRUNCATE_BYTES) + '\n…[truncated]'
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: flowId } = await params
  const body      = await request.json() as { input?: string; graph?: FlowGraph; fileData?: FileData; sessionKeys?: SessionKeys }
  const userInput = body.input    ?? ''
  const fileData  = body.fileData
  const sessionKeys = body.sessionKeys

  // Resolve graph: prefer inline body.graph (for testing), else fetch from DB
  let graph: FlowGraph
  if (body.graph) {
    graph = body.graph
  } else {
    const [flow] = await db.select().from(flows).where(eq(flows.id, flowId)).limit(1)
    if (!flow) {
      return Response.json({ error: 'Flow not found' }, { status: 404 })
    }
    graph = flow.json as FlowGraph
  }

  // Derive input metadata (never store file contents)
  const inputType = fileData
    ? (fileData.mimeType.startsWith('image/') ? 'image' : 'file')
    : 'text'
  const fileName  = fileData?.name

  const nodeCount = graph.nodes.length

  // Persist the run record with all available metadata upfront
  const [run] = await db
    .insert(runs)
    .values({
      flowId,
      status:    'running',
      userInput: truncate(userInput),
      inputType,
      fileName,
      nodeCount,
    })
    .returning({ id: runs.id })

  const runId = run.id
  createRun(runId)

  // Execute asynchronously — response returns immediately with runId
  setImmediate(async () => {
    const runStartMs = Date.now()

    // Collect node-end events for bulk insert after execution
    const nodeEndEvents: Array<SSEEvent & { type: 'node-end' }> = []

    try {
      const finalOutput = await execute(graph, userInput, (event) => {
        publishChunk(runId, formatSSE(event))
        if (event.type === 'node-end') {
          nodeEndEvents.push(event as SSEEvent & { type: 'node-end' })
        }
      }, fileData, sessionKeys)

      publishChunk(runId, formatSSE({ type: 'run-complete', runId, status: 'done' }))

      const totalTokens = nodeEndEvents.reduce((sum, e) => {
        return sum + ((e.usage as TokenUsage | undefined)?.totalTokens ?? 0)
      }, 0)

      // Bulk-insert per-node analytics
      if (nodeEndEvents.length > 0) {
        const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
        await db.insert(runNodes).values(
          nodeEndEvents.map(e => {
            const graphNode = nodeMap.get(e.nodeId)
            const usage     = e.usage as TokenUsage | undefined
            const cfg       = graphNode?.data?.config as Record<string, unknown> | undefined
            const mode      = cfg?.structuredOutput ? 'structured' : 'text'
            return {
              runId,
              nodeId:           e.nodeId,
              nodeType:         graphNode?.type ?? 'unknown',
              nodeLabel:        graphNode?.data?.label ?? undefined,
              status:           e.status,
              durationMs:       e.durationMs,
              output:           truncate(e.output),
              model:            e.model,
              mode:             graphNode?.type === 'llm' ? mode : undefined,
              promptTokens:     usage?.promptTokens,
              completionTokens: usage?.completionTokens,
              totalTokens:      usage?.totalTokens,
              firstTokenMs:     usage?.firstTokenMs,
            }
          })
        )
      }

      await db.update(runs).set({
        status:      'done',
        completedAt: new Date(),
        durationMs:  Date.now() - runStartMs,
        finalOutput: truncate(finalOutput),
        totalTokens: totalTokens || undefined,
      }).where(eq(runs.id, runId))

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      publishChunk(runId, formatSSE({ type: 'run-complete', runId, status: 'error', error: msg }))
      await db.update(runs).set({
        status:      'error',
        completedAt: new Date(),
        durationMs:  Date.now() - runStartMs,
        error:       truncate(msg),
      }).where(eq(runs.id, runId))
    } finally {
      closeRun(runId)
    }
  })

  return Response.json({ runId })
}
