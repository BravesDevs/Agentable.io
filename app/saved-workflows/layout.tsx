import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function SavedWorkflowsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/')
  }

  return <>{children}</>
}
