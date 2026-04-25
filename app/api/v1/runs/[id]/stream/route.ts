import { runExists, subscribeRun } from '@/lib/runtime/runStore'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await params

  if (!runExists(runId)) {
    return Response.json({ error: 'Run not found' }, { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = subscribeRun(runId, (chunk) => {
        if (chunk === '') {
          // empty string = done signal from closeRun
          controller.close()
          return
        }
        controller.enqueue(encoder.encode(chunk))
      })

      if (!unsubscribe) {
        controller.error(new Error('Run not found'))
        return
      }

      request.signal.addEventListener('abort', () => {
        unsubscribe()
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
