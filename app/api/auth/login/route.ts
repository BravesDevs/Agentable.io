import { redirect } from 'next/navigation'
import {
  buildAuthorizeUrl,
  setStateCookie,
  type Connection,
} from '@/lib/auth'

export const runtime = 'nodejs'

const VALID: ReadonlySet<Connection> = new Set(['email', 'google-oauth2', 'github'])

export async function GET(request: Request) {
  const url        = new URL(request.url)
  const connection = url.searchParams.get('connection') ?? undefined
  const returnTo   = url.searchParams.get('returnTo')   ?? '/'
  const screenHint = url.searchParams.get('screen_hint')

  const conn = connection && VALID.has(connection as Connection)
    ? (connection as Connection)
    : undefined
  const hint = screenHint === 'signup' || screenHint === 'login' ? screenHint : undefined

  try {
    const redirectUri = `${url.origin}/api/auth/callback`
    const { url: authorizeUrl, state } = buildAuthorizeUrl({
      redirectUri,
      connection: conn,
      returnTo,
      screenHint: hint,
    })

    await setStateCookie(state)
    redirect(authorizeUrl)
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT') === true)) {
      throw err
    }
    console.error('[auth/login]', err)
    const detail = err instanceof Error ? err.message : String(err)
    const params = new URLSearchParams({ reason: 'config', detail: detail.slice(0, 240) })
    redirect(`/auth/error?${params}`)
  }
}
