/**
 * In-process SSE pub/sub for active runs.
 * Works for single-instance deployments (local dev + single Vercel instance).
 * Replace with Redis pub/sub for multi-instance scaling.
 */

type Subscriber = (chunk: string) => void

interface RunState {
  buffer: string[]
  subscribers: Set<Subscriber>
  done: boolean
}

const store = new Map<string, RunState>()

export function createRun(runId: string): void {
  store.set(runId, { buffer: [], subscribers: new Set(), done: false })
}

export function publishChunk(runId: string, chunk: string): void {
  const run = store.get(runId)
  if (!run) return
  run.buffer.push(chunk)
  for (const sub of run.subscribers) sub(chunk)
}

/** Signal all subscribers that the run is finished and schedule cleanup. */
export function closeRun(runId: string): void {
  const run = store.get(runId)
  if (!run) return
  run.done = true
  for (const sub of run.subscribers) sub('')
  run.subscribers.clear()
  setTimeout(() => store.delete(runId), 60_000)
}

/**
 * Subscribe to a run's events.
 * Replays the buffer first, then delivers live chunks.
 * Returns an unsubscribe function, or null if the run doesn't exist.
 */
export function subscribeRun(
  runId: string,
  onChunk: Subscriber,
): (() => void) | null {
  const run = store.get(runId)
  if (!run) return null

  for (const chunk of run.buffer) onChunk(chunk)

  if (run.done) {
    onChunk('')
    return () => {}
  }

  run.subscribers.add(onChunk)
  return () => run.subscribers.delete(onChunk)
}

export function runExists(runId: string): boolean {
  return store.has(runId)
}
