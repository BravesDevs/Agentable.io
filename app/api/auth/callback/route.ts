import { redirect } from 'next/navigation'
import {
  consumeStateCookie,
  exchangeCode,
  fetchUserInfo,
  setSessionCookie,
  signSession,
  upsertUser,
} from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)

  const auth0Error = url.searchParams.get('error')
  if (auth0Error) {
    const desc = url.searchParams.get('error_description') ?? auth0Error
    return errorRedirect('auth0', desc)
  }

  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return errorRedirect('state', 'Missing authorization code or state parameter.')
  }

  const expected = await consumeStateCookie()
  if (!expected || expected !== state) {
    return errorRedirect(
      'state',
      'Sign-in state did not match — please start the flow again.',
      'This usually means the sign-in took too long or was opened in a different browser.',
    )
  }

  const redirectUri = `${url.origin}/api/auth/callback`

  try {
    const tokens       = await exchangeCode(code, redirectUri)
    const info         = await fetchUserInfo(tokens.access_token)
    const { id, role } = await upsertUser(info)

    const session = signSession({
      sub:     id,
      email:   info.email ?? '',
      name:    info.name,
      picture: info.picture,
      role,
    })
    await setSessionCookie(session)

    const returnTo = decodeReturnTo(state) ?? '/'
    redirect(returnTo)
  } catch (err) {
    // `redirect()` throws a special NEXT_REDIRECT marker — let it bubble.
    if (isNextRedirect(err)) throw err
    return classify(err)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classify(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[auth/callback]', err)

  // DB schema not pushed yet — common dev gotcha. Surface it loudly.
  if (/relation .* does not exist/i.test(message) || /\b42P01\b/.test(message)) {
    return errorRedirect(
      'db',
      'The users table is missing in the database.',
      'Run `pnpm db:push` to apply the latest schema, then try signing in again.',
    )
  }
  if (/AUTH0_DOMAIN|CLIENT_ID|CLIENT_SECRET|API_KEY_SECRET/.test(message)) {
    return errorRedirect('config', message)
  }
  if (/token exchange failed/i.test(message)) {
    return errorRedirect('exchange', truncate(message))
  }
  if (/userinfo failed/i.test(message)) {
    return errorRedirect('userinfo', truncate(message))
  }
  return errorRedirect('unknown', truncate(message))
}

function errorRedirect(reason: string, detail?: string, hint?: string): never {
  const params = new URLSearchParams({ reason })
  if (detail) params.set('detail', truncate(detail))
  if (hint)   params.set('hint',   hint)
  redirect(`/auth/error?${params}`)
}

function isNextRedirect(err: unknown): boolean {
  return err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT') === true)
}

function truncate(s: string, max = 240): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function decodeReturnTo(state: string): string | null {
  const parts = state.split('.')
  if (parts.length < 2) return null
  try {
    const pad     = '='.repeat((4 - (parts[1].length % 4)) % 4)
    const decoded = Buffer.from((parts[1] + pad).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    // Block open-redirects: only same-origin paths.
    return decoded.startsWith('/') && !decoded.startsWith('//') ? decoded : null
  } catch {
    return null
  }
}
