import { redirect } from 'next/navigation'
import { buildLogoutUrl, clearSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  await clearSessionCookie()
  const url = new URL(request.url)
  let returnTo = url.searchParams.get('returnTo') ?? '/'
  
  // Ensure returnTo is a full URL (not just a path)
  // Auth0 requires fully-qualified URLs in the logout redirect
  if (!returnTo.startsWith('http://') && !returnTo.startsWith('https://')) {
    returnTo = `${url.origin}${returnTo}`
  }
  
  redirect(buildLogoutUrl(returnTo))
}
