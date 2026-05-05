import { introspect } from '@/services/db-executor'
import type { DBDriver } from '@/types/db'

// Neon's serverless driver is a server-only runtime dep.
export const runtime = 'nodejs'

interface IntrospectBody {
  driver:           DBDriver
  connectionString: string
}

export async function POST(req: Request) {
  let body: IntrospectBody
  try {
    body = await req.json() as IntrospectBody
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { driver, connectionString } = body
  if (!driver || !connectionString) {
    return new Response('driver and connectionString are required', { status: 400 })
  }

  try {
    const schema = await introspect(driver, connectionString)
    return Response.json(schema)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(message, { status: 500 })
  }
}
