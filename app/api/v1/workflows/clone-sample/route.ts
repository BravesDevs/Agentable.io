import { db } from '@/lib/db/client'
import { flows } from '@/lib/db/schema'
import { getSampleWorkflow } from '@/lib/sampleWorkflows'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { sampleId } = await request.json() as { sampleId?: string }
  if (!sampleId) {
    return Response.json({ error: 'sampleId is required' }, { status: 400 })
  }
  const sample = getSampleWorkflow(sampleId)
  if (!sample) {
    return Response.json({ error: `Unknown sample: ${sampleId}` }, { status: 404 })
  }

  const [created] = await db
    .insert(flows)
    .values({
      name: sample.name,
      json: { nodes: sample.graph.nodes, edges: sample.graph.edges },
    })
    .returning()

  return Response.json(created, { status: 201 })
}
