import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { flows, runs } from '@/lib/db/schema'
import { execute } from '@/lib/runtime/execute'
import { createRun, publishChunk, closeRun } from '@/lib/runtime/runStore'
import { formatSSE, type FlowGraph } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: flowId } = await params
  const body = await request.json() as { input?: string; graph?: FlowGraph }
  const userInput = body.input ?? ''

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

  // Persist the run record
  const [run] = await db
    .insert(runs)
    .values({ flowId, status: 'running' })
    .returning({ id: runs.id })

  const runId = run.id
  createRun(runId)

  // Execute asynchronously — response returns immediately with runId
  setImmediate(async () => {
    try {
      await execute(graph, userInput, (event) => {
        publishChunk(runId, formatSSE(event))
      })
      publishChunk(runId, formatSSE({ type: 'run-complete', runId, status: 'done' }))
      await db.update(runs).set({ status: 'done' }).where(eq(runs.id, runId))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      publishChunk(runId, formatSSE({ type: 'run-complete', runId, status: 'error', error: msg }))
      await db.update(runs).set({ status: 'error' }).where(eq(runs.id, runId))
    } finally {
      closeRun(runId)
    }
  })

  return Response.json({ runId })
}
