import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { flows } from '@/lib/db/schema'
import { SAMPLE_WORKFLOWS } from '@/lib/sampleWorkflows'
import WorkflowCard from '@/components/workflows/WorkflowCard'

interface FlowJson {
  nodes?: { type?: string; data?: { nodeType?: string } }[]
  edges?: unknown[]
}

const ANNOTATION_TYPES = new Set(['shape', 'text', 'drawing', 'arrow'])

function summarize(json: unknown): { nodeCount: number; nodeTypes: string[] } {
  const j = (json ?? {}) as FlowJson
  const nodes = Array.isArray(j.nodes) ? j.nodes : []
  const runnable = nodes.filter((n) => !ANNOTATION_TYPES.has((n.type ?? '') as string))
  const nodeTypes = runnable
    .map((n) => (n.data?.nodeType ?? n.type ?? '') as string)
    .filter(Boolean)
  return { nodeCount: runnable.length, nodeTypes }
}

export default async function SavedWorkflowsPage() {
  const session = await getSession()
  if (!session) redirect('/')

  const userFlows = await db.select().from(flows).orderBy(desc(flows.createdAt))

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <header className="sticky top-0 z-10 border-b border-white/8 bg-[#0d1117]/85 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/canvas" className="flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-white to-[#9198a1] text-[11px] font-bold text-[#0d1117]">
              A
            </div>
            <span>AgentCraft</span>
          </Link>
          <Link
            href="/canvas"
            className="rounded-md bg-white/8 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/12 hover:text-white"
          >
            ← Back to Canvas
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Saved Workflows</h1>
            <p className="mt-1.5 text-sm text-white/55">
              Open a workflow to keep editing, or start from a template.
            </p>
          </div>
          <Link
            href="/canvas"
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-[#f6f8fa] to-[#d1d9e0] px-4 py-2 text-sm font-medium text-[#0d1117] transition-colors hover:from-white hover:to-[#e6edf3]"
          >
            <span className="text-base leading-none">+</span> New workflow
          </Link>
        </div>

        {/* ── Templates section ─────────────────────────────────────── */}
        <section className="mb-12">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Templates</h2>
            <span className="text-xs text-white/35">
              Working examples you can clone and customize
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_WORKFLOWS.map((s) => {
              const { nodeCount, nodeTypes } = summarize(s.graph)
              return (
                <WorkflowCard
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  description={s.description}
                  tags={s.tags}
                  nodeCount={nodeCount}
                  nodeTypes={nodeTypes}
                  variant="sample"
                />
              )
            })}
          </div>
        </section>

        {/* ── User workflows ────────────────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your workflows</h2>
            <span className="text-xs text-white/35">
              {userFlows.length} {userFlows.length === 1 ? 'workflow' : 'workflows'}
            </span>
          </div>

          {userFlows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
              <p className="text-white/55">You haven&apos;t saved any workflows yet.</p>
              <p className="mt-1 text-xs text-white/35">
                Open the canvas to build one, or start from a template above.
              </p>
              <Link
                href="/canvas"
                className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[#0969da] px-4 py-2 text-sm font-medium text-white hover:bg-[#0860ca]"
              >
                → Open canvas
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {userFlows.map((flow) => {
                const { nodeCount, nodeTypes } = summarize(flow.json)
                return (
                  <WorkflowCard
                    key={flow.id}
                    id={flow.id}
                    name={flow.name || 'Untitled Workflow'}
                    createdAt={flow.createdAt}
                    nodeCount={nodeCount}
                    nodeTypes={nodeTypes}
                    variant="user"
                  />
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
