import { redirect } from 'next/navigation'

// /register → Auth0 Universal Login (signup tab via screen_hint=signup).
export function GET(request: Request) {
  const url    = new URL(request.url)
  const params = new URLSearchParams(url.searchParams)
  params.set('screen_hint', 'signup')
  redirect(`/api/auth/login?${params}`)
}
