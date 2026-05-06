import { desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { flows } from '@/lib/db/schema'

export const runtime = 'nodejs'

export async function GET() {
  let rows = await db.select().from(flows).orderBy(desc(flows.createdAt))

  // Seed a default flow on first load
  if (rows.length === 0) {
    const [created] = await db
      .insert(flows)
      .values({ name: 'My first agent', json: { nodes: [], edges: [] } })
      .returning()
    rows = [created]
  }

  return Response.json(rows)
}

export async function POST(request: Request) {
  const { name, json } = await request.json() as {
    name?: string
    json?: { nodes: unknown[]; edges: unknown[] }
  }
  const [flow] = await db
    .insert(flows)
    .values({
      name: name ?? 'Untitled flow',
      json: json ?? { nodes: [], edges: [] },
    })
    .returning()
  return Response.json(flow, { status: 201 })
}
