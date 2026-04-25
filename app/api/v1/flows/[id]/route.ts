import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { flows } from '@/lib/db/schema'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [flow] = await db.select().from(flows).where(eq(flows.id, id)).limit(1)
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(flow)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body   = await request.json() as { name?: string; json?: unknown }
  await db.update(flows).set({ ...(body.name ? { name: body.name } : {}), ...(body.json ? { json: body.json } : {}) }).where(eq(flows.id, id))
  return Response.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await db.delete(flows).where(eq(flows.id, id))
  return Response.json({ ok: true })
}
