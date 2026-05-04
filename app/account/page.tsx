import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AccountPage() {
  const session = await getSession()
  if (!session) redirect('/')

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
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold mb-6">Manage Account</h1>
          
          <div className="space-y-6">
            {/* User info section */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-white/50">Email</p>
                  <p className="text-base text-white/90">{session.email}</p>
                </div>
                {session.name && (
                  <div>
                    <p className="text-sm text-white/50">Name</p>
                    <p className="text-base text-white/90">{session.name}</p>
                  </div>
                )}
                {session.role && (
                  <div>
                    <p className="text-sm text-white/50">Role</p>
                    <p className="text-base text-white/90 capitalize">{session.role}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Placeholder for additional settings */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold mb-4">Settings</h2>
              <p className="text-sm text-white/50">Account settings coming soon...</p>
            </div>

            {/* Back button */}
            <div>
              <Link
                href="/canvas"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-b from-[#f6f8fa] to-[#d1d9e0] text-[#0d1117] font-medium hover:from-white hover:to-[#e6edf3] transition-colors"
              >
                ← Back to Canvas
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
