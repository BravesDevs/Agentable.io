import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { apiKeys } from '@/lib/db/schema'
import { decrypt } from '@/lib/crypto'
import { PROVIDERS, type ProviderId } from './registry'
import { currentUserId } from '@/lib/auth'

/**
 * Returns the API key for a provider in this priority order:
 *   1. Session-supplied key (passed via run POST body)
 *   2. DB-stored encrypted key for the current user
 *   3. process.env fallback (legacy behavior)
 *
 * Returns null when none is available — the LLM handler must block in that case.
 */
export async function resolveProviderKey(
  provider: ProviderId,
  sessionKeys?: Partial<Record<ProviderId, string>>,
): Promise<string | null> {
  if (sessionKeys?.[provider]) return sessionKeys[provider]!

  const userId = currentUserId()
  const [row]  = await db
    .select({ keyEncrypted: apiKeys.keyEncrypted })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
    .limit(1)

  if (row?.keyEncrypted) {
    try { return decrypt(row.keyEncrypted) } catch { /* fall through to env */ }
  }

  const envName = PROVIDERS[provider].envFallback
  return process.env[envName] ?? null
}
