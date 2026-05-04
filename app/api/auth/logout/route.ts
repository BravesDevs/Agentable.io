import { redirect } from 'next/navigation'
import { buildLogoutUrl, clearSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  await clearSessionCookie()
  const url      = new URL(request.url)
  const returnTo = url.searchParams.get('returnTo') ?? url.origin
  redirect(buildLogoutUrl(returnTo))
}
