import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { apiKeys } from '@/lib/db/schema'
import { encrypt } from '@/lib/crypto'
import { isProviderId } from '@/lib/providers/registry'
import { validateProviderKey } from '@/lib/providers/validate'
import { currentUserId } from '@/lib/auth'

export const runtime = 'nodejs'

// GET — list providers the user has stored keys for. Never returns the key value.
export async function GET() {
  const userId = currentUserId()
  const rows   = await db
    .select({ provider: apiKeys.provider, createdAt: apiKeys.createdAt, updatedAt: apiKeys.updatedAt })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))

  return Response.json({ keys: rows })
}

// POST — validate, then either persist (persist='db') or just confirm validity (persist='session')
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    provider?: string
    apiKey?:   string
    persist?:  'session' | 'db'
  }

  if (!body.provider || !isProviderId(body.provider)) {
    return Response.json({ error: 'Unknown provider' }, { status: 400 })
  }
  if (!body.apiKey || typeof body.apiKey !== 'string' || body.apiKey.trim().length < 8) {
    return Response.json({ error: 'API key is required' }, { status: 400 })
  }

  const result = await validateProviderKey(body.provider, body.apiKey.trim())
  if (!result.ok) {
    return Response.json(
      { error: 'Key validation failed', status: result.status, detail: result.error },
      { status: 400 },
    )
  }

  if (body.persist === 'db') {
    const userId    = currentUserId()
    const encrypted = encrypt(body.apiKey.trim())

    // Upsert via delete+insert (Drizzle's onConflict needs explicit constraint targeting)
    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, body.provider)))
    await db.insert(apiKeys).values({
      userId,
      provider:     body.provider,
      keyEncrypted: encrypted,
    })

    return Response.json({ ok: true, persisted: 'db' })
  }

  return Response.json({ ok: true, persisted: 'session' })
}
