import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ user: null }, { status: 200 })
  return Response.json({
    user: {
      id:      session.sub,
      email:   session.email,
      name:    session.name,
      picture: session.picture,
      role:    session.role,
    },
  })
}
