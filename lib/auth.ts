/**
 * Auth0 OAuth (OIDC code flow) — minimal, library-free.
 *
 * Why no @auth0/nextjs-auth0?
 *   Next 16 made cookies()/headers()/params/searchParams async-only and renamed
 *   middleware.ts → proxy.ts; the official package hasn't fully landed those
 *   changes. A ~150-line custom flow is more reliable and removes a dep.
 *
 * Connections supported (configure in the Auth0 tenant dashboard):
 *   - email           → Email / OTP passwordless
 *   - google-oauth2   → Google social
 *   - github          → GitHub social
 *   - (omit)          → Universal Login picks for the user
 *
 * Session: HS256 JWT signed with API_KEY_SECRET, stored in an HttpOnly cookie.
 * Auth0 access/refresh tokens are NOT persisted — we exchange the code, fetch
 * /userinfo once, then forget Auth0 ever existed for this session.
 */
import { cookies } from 'next/headers'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from './db/client'
import { users, profiles, type Role } from './db/schema'

// ─── Config ───────────────────────────────────────────────────────────────────

export interface Auth0Config {
  domain:       string
  clientId:     string
  clientSecret: string
  scope:        string
  sessionSecret: string
  cookieName:   string
  stateCookie:  string
  sessionTTL:   number   // seconds
}

export function getAuth0Config(): Auth0Config {
  const domain       = process.env.AUTH0_DOMAIN
  const clientId     = process.env.CLIENT_ID
  const clientSecret = process.env.CLIENT_SECRET
  const sessionSecret = process.env.API_KEY_SECRET   // reused — already 32 bytes hex

  if (!domain || !clientId || !clientSecret) {
    throw new Error('AUTH0_DOMAIN, CLIENT_ID, CLIENT_SECRET must be set in .env.local')
  }
  if (!sessionSecret) {
    throw new Error('API_KEY_SECRET is required to sign session cookies')
  }

  return {
    domain,
    clientId,
    clientSecret,
    sessionSecret,
    scope:       'openid profile email',
    cookieName:  'agentable_session',
    stateCookie: 'agentable_oauth_state',
    sessionTTL:  60 * 60 * 24 * 7,   // 7 days
  }
}

// ─── Authorize URL ────────────────────────────────────────────────────────────

export type Connection = 'email' | 'google-oauth2' | 'github'

export interface BuildAuthorizeUrlOpts {
  redirectUri: string
  connection?: Connection
  returnTo?:   string
  screenHint?: 'login' | 'signup'
}

export function buildAuthorizeUrl(opts: BuildAuthorizeUrlOpts): { url: string; state: string } {
  const cfg   = getAuth0Config()
  const state = randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     cfg.clientId,
    redirect_uri:  opts.redirectUri,
    scope:         cfg.scope,
    state:         opts.returnTo ? `${state}.${b64url(opts.returnTo)}` : state,
  })
  if (opts.connection) params.set('connection',  opts.connection)
  if (opts.screenHint) params.set('screen_hint', opts.screenHint)

  return {
    url:   `https://${cfg.domain}/authorize?${params.toString()}`,
    state: params.get('state')!,
  }
}

// ─── Auth0 token exchange + userinfo ──────────────────────────────────────────

export interface Auth0TokenResponse {
  access_token: string
  id_token:     string
  token_type:   string
  expires_in:   number
}

export async function exchangeCode(code: string, redirectUri: string): Promise<Auth0TokenResponse> {
  const cfg = getAuth0Config()
  const res = await fetch(`https://${cfg.domain}/oauth/token`, {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify({
      grant_type:    'authorization_code',
      client_id:     cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri:  redirectUri,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Auth0 token exchange failed (${res.status}): ${text.slice(0, 300)}`)
  }
  return res.json() as Promise<Auth0TokenResponse>
}

export interface Auth0UserInfo {
  sub:            string
  email?:         string
  email_verified?: boolean
  name?:          string
  picture?:       string
  nickname?:      string
}

export async function fetchUserInfo(accessToken: string): Promise<Auth0UserInfo> {
  const cfg = getAuth0Config()
  const res = await fetch(`https://${cfg.domain}/userinfo`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Auth0 userinfo failed (${res.status}): ${text.slice(0, 300)}`)
  }
  return res.json() as Promise<Auth0UserInfo>
}

// ─── DB upsert ────────────────────────────────────────────────────────────────

export async function upsertUser(info: Auth0UserInfo): Promise<{ id: string; role: Role }> {
  const provider = info.sub.split('|')[0]                  // auth0 | google-oauth2 | github | email
  const email    = info.email ?? `${info.sub}@unknown.local`

  const [existing] = await db.select().from(users).where(eq(users.id, info.sub)).limit(1)

  if (existing) {
    await db
      .update(users)
      .set({
        email,
        emailVerified: info.email_verified ?? existing.emailVerified,
        name:          info.name    ?? existing.name,
        picture:       info.picture ?? existing.picture,
        provider,
        lastLoginAt:   new Date(),
      })
      .where(eq(users.id, info.sub))
    return { id: existing.id, role: existing.role }
  }

  await db.insert(users).values({
    id:            info.sub,
    email,
    emailVerified: info.email_verified ?? false,
    name:          info.name,
    picture:       info.picture,
    provider,
    lastLoginAt:   new Date(),
  })
  await db.insert(profiles).values({
    userId:      info.sub,
    displayName: info.name ?? info.nickname ?? null,
    avatarUrl:   info.picture ?? null,
  })
  return { id: info.sub, role: 'user' }
}

// ─── Session JWT (HS256) ──────────────────────────────────────────────────────

export interface SessionPayload {
  sub:     string
  email:   string
  name?:   string
  picture?: string
  role:    Role
  iat:     number
  exp:     number
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64urlDecode(input: string): Buffer {
  const pad = '='.repeat((4 - (input.length % 4)) % 4)
  return Buffer.from((input + pad).replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

export function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>, ttlSeconds?: number): string {
  const cfg     = getAuth0Config()
  const now     = Math.floor(Date.now() / 1000)
  const exp     = now + (ttlSeconds ?? cfg.sessionTTL)
  const full    = { ...payload, iat: now, exp }
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body    = b64url(JSON.stringify(full))
  const sig     = b64url(createHmac('sha256', cfg.sessionSecret).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}

export function verifySession(token: string): SessionPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts

  const cfg      = getAuth0Config()
  const expected = createHmac('sha256', cfg.sessionSecret).update(`${header}.${body}`).digest()
  const provided = b64urlDecode(sig)
  if (expected.length !== provided.length) return null
  if (!timingSafeEqual(expected, provided)) return null

  try {
    const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as SessionPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ─── Cookie helpers (Next 16: cookies() is async) ─────────────────────────────

export async function setSessionCookie(token: string): Promise<void> {
  const cfg  = getAuth0Config()
  const jar  = await cookies()
  jar.set(cfg.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   cfg.sessionTTL,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cfg = getAuth0Config()
  const jar = await cookies()
  jar.delete(cfg.cookieName)
}

export async function setStateCookie(state: string): Promise<void> {
  const cfg = getAuth0Config()
  const jar = await cookies()
  jar.set(cfg.stateCookie, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   60 * 10,   // 10 minutes for the round trip
  })
}

export async function consumeStateCookie(): Promise<string | null> {
  const cfg = getAuth0Config()
  const jar = await cookies()
  const v   = jar.get(cfg.stateCookie)?.value ?? null
  jar.delete(cfg.stateCookie)
  return v
}

// ─── Session readers ──────────────────────────────────────────────────────────

export async function getSession(): Promise<SessionPayload | null> {
  const cfg   = getAuth0Config()
  const jar   = await cookies()
  const token = jar.get(cfg.cookieName)?.value
  if (!token) return null
  return verifySession(token)
}

export async function currentUser(): Promise<SessionPayload | null> {
  return getSession()
}

/**
 * Returns the authenticated user's Auth0 sub. Falls back to DEV_USER_ID for the
 * single-user demo path so the existing flows / keys / runs API don't break
 * when Auth0 isn't configured yet. Once Auth0 is the only path, drop the
 * fallback and require a session.
 */
export async function currentUserId(): Promise<string> {
  const session = await getSession()
  if (session) return session.sub
  return process.env.DEV_USER_ID ?? 'demo'
}

export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

// ─── Logout URL ───────────────────────────────────────────────────────────────

export function buildLogoutUrl(returnTo: string): string {
  const cfg    = getAuth0Config()
  const params = new URLSearchParams({ client_id: cfg.clientId, returnTo })
  return `https://${cfg.domain}/v2/logout?${params.toString()}`
}
