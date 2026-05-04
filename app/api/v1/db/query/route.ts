import { runQuery } from '@/services/db-executor'
import type { DBDriver } from '@/types/db'
import { DB_DEFAULT_ROW_LIMIT } from '@/types/db'

export const runtime = 'nodejs'

interface QueryBody {
  driver:           DBDriver
  connectionString: string
  query:            string
  rowLimit?:        number
}

// One-shot query execution for the "Run Query" button in the node sidebar.
// Lives outside the flow runtime so authors can iterate without starting a run.
export async function POST(req: Request) {
  let body: QueryBody
  try {
    body = await req.json() as QueryBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { driver, connectionString, query, rowLimit } = body
  if (!driver || !connectionString) {
    return Response.json({ ok: false, error: 'driver and connectionString are required' }, { status: 400 })
  }
  if (!query?.trim()) {
    return Response.json({ ok: false, error: 'Query is empty' }, { status: 400 })
  }

  try {
    const result = await runQuery(driver, connectionString, query, rowLimit ?? DB_DEFAULT_ROW_LIMIT)
    return Response.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message }, { status: 200 })
  }
}
