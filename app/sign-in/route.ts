import { redirect } from 'next/navigation'

// /sign-in → Auth0 Universal Login. Same as /login; kept because the landing page links here.
export function GET(request: Request) {
  const url    = new URL(request.url)
  const params = new URLSearchParams(url.searchParams)
  redirect(`/api/auth/login${params.size ? `?${params}` : ''}`)
}
