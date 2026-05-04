import { redirect } from 'next/navigation'

// /login → Auth0 Universal Login (login tab). Forwards `returnTo` and `connection`.
export function GET(request: Request) {
  const url    = new URL(request.url)
  const params = new URLSearchParams(url.searchParams)
  redirect(`/api/auth/login${params.size ? `?${params}` : ''}`)
}
