import { runQuery } from '@/services/db-executor'
import type { DBDriver } from '@/types/db'

export const runtime = 'nodejs'

interface TestBody {
  driver:           DBDriver
  connectionString: string
}

// Lightweight connectivity probe — runs a trivial query so we exercise both
// the network handshake and auth without touching user data.
export async function POST(req: Request) {
  let body: TestBody
  try {
    body = await req.json() as TestBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { driver, connectionString } = body
  if (!driver || !connectionString) {
    return Response.json({ ok: false, error: 'driver and connectionString are required' }, { status: 400 })
  }

  const t0 = Date.now()
  try {
    const result = await runQuery(driver, connectionString, 'SELECT 1 AS ok', 1)
    return Response.json({
      ok:         true,
      durationMs: Date.now() - t0,
      driver,
      command:    result.command,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({
      ok:         false,
      durationMs: Date.now() - t0,
      error:      message,
    }, { status: 200 })   // 200 so the client gets the structured error, not a network failure
  }
}
