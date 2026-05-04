import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db/client'
import { flows } from '@/lib/db/schema'

export default async function SavedWorkflowsPage() {
  const session = await getSession()
  if (!session) redirect('/')

  // Fetch all flows (schema doesn't have user-level filtering yet)
  const userFlows = await db.select().from(flows)

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <header className="border-b border-white/8 bg-[#0d1117]/80">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/canvas" className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-white to-[#9198a1] flex items-center justify-center text-[#0d1117] text-[11px] font-bold">
              A
            </div>
            <span>AgentCraft</span>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div>
          <h1 className="text-3xl font-bold mb-8">Saved Workflows</h1>
          
          {userFlows.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-12 text-center">
              <p className="text-white/60 mb-4">You don't have any saved workflows yet.</p>
              <Link
                href="/canvas"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-b from-[#f6f8fa] to-[#d1d9e0] text-[#0d1117] font-medium hover:from-white hover:to-[#e6edf3] transition-colors"
              >
                → Create your first workflow
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {userFlows.map((flow) => (
                <div
                  key={flow.id}
                  className="rounded-lg border border-white/10 bg-white/5 p-4 hover:bg-white/8 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        {flow.name || 'Untitled Workflow'}
                      </h3>
                      <p className="text-xs text-white/40 mt-1">
                        Created {new Date(flow.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href="/canvas"
                      className="px-3 py-1.5 rounded-md bg-[#0969da] hover:bg-[#0860ca] text-white text-sm font-medium transition-colors"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Back button */}
          <div className="mt-8">
            <Link
              href="/canvas"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-b from-[#f6f8fa] to-[#d1d9e0] text-[#0d1117] font-medium hover:from-white hover:to-[#e6edf3] transition-colors"
            >
              ← Back to Canvas
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
