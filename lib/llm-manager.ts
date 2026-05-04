/**
 * LLMManager — BYOK factory, isolated per user.
 *
 * Responsibilities:
 *   1. Resolve the API key for a (user, provider) pair.
 *      Priority:  session-supplied  >  encrypted DB row  >  process.env fallback
 *   2. Construct AI SDK model instances using the resolved key.
 *   3. Cache constructed clients within a single manager (request-scoped),
 *      so re-using the same model in multiple nodes of one flow doesn't
 *      re-instantiate the SDK client.
 *
 * Isolation:
 *   - One LLMManager per request, scoped to a single userId.
 *   - All DB lookups filter by userId; no cross-user leakage is possible
 *     unless the caller hands the wrong userId in.
 *   - Caches are instance-local — never global, never shared across users.
 */
import { and, eq } from 'drizzle-orm'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI }    from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { db } from './db/client'
import { apiKeys } from './db/schema'
import { decrypt } from './crypto'
import { PROVIDERS, type ProviderId } from './providers/registry'
import type { SessionKeys } from './types'

export class MissingApiKeyError extends Error {
  constructor(public provider: ProviderId) {
    super(`No API key configured for provider "${provider}". Open the LLM node and add one.`)
    this.name = 'MissingApiKeyError'
  }
}

export class LLMManager {
  private modelCache = new Map<string, LanguageModel>()
  private keyCache   = new Map<ProviderId, string | null>()

  private constructor(public readonly userId: string) {}

  /** Build a manager scoped to a single user. Cheap — no I/O until you call a method. */
  static forUser(userId: string): LLMManager {
    return new LLMManager(userId)
  }

  /**
   * Resolve the API key for a provider in this priority order:
   *   1. sessionKeys[provider]  — a key passed in the run POST body, never persisted
   *   2. apiKeys row            — encrypted DB key for this user
   *   3. process.env fallback   — for local dev / single-user demo
   * Returns `null` when none is available.
   */
  async getKey(provider: ProviderId, sessionKeys?: SessionKeys): Promise<string | null> {
    if (sessionKeys?.[provider]) return sessionKeys[provider]!

    if (this.keyCache.has(provider)) return this.keyCache.get(provider) ?? null

    const [row] = await db
      .select({ keyEncrypted: apiKeys.keyEncrypted })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, this.userId), eq(apiKeys.provider, provider)))
      .limit(1)

    let key: string | null = null
    if (row?.keyEncrypted) {
      try { key = decrypt(row.keyEncrypted) } catch { /* fall through */ }
    }
    if (!key) key = process.env[PROVIDERS[provider].envFallback] ?? null

    this.keyCache.set(provider, key)
    return key
  }

  /**
   * Build an AI SDK model instance for `(provider, modelId)`. Throws
   * `MissingApiKeyError` if no key is resolvable. Cached per-manager.
   */
  async getModel(
    provider: ProviderId,
    modelId:  string,
    sessionKeys?: SessionKeys,
  ): Promise<LanguageModel> {
    const apiKey = await this.getKey(provider, sessionKeys)
    if (!apiKey) throw new MissingApiKeyError(provider)

    const cacheKey = `${provider}::${modelId}::${fingerprint(apiKey)}`
    const hit      = this.modelCache.get(cacheKey)
    if (hit) return hit

    const model = buildModel(provider, modelId, apiKey)
    this.modelCache.set(cacheKey, model)
    return model
  }

  /** Cheap pre-check — useful for surfacing missing-key UX before kicking off a run. */
  async assertProviderAvailable(provider: ProviderId, sessionKeys?: SessionKeys): Promise<void> {
    const key = await this.getKey(provider, sessionKeys)
    if (!key) throw new MissingApiKeyError(provider)
  }

  /** List of providers this user has a stored key for (DB rows only — does NOT include env fallback). */
  async listProviders(): Promise<ProviderId[]> {
    const rows = await db
      .select({ provider: apiKeys.provider })
      .from(apiKeys)
      .where(eq(apiKeys.userId, this.userId))
    return rows
      .map((r) => r.provider as ProviderId)
      .filter((p): p is ProviderId => Boolean(PROVIDERS[p]))
  }

  /** Drop all cached clients/keys. Call when keys are rotated mid-request. */
  clearCache(): void {
    this.modelCache.clear()
    this.keyCache.clear()
  }
}

// ─── Internals ────────────────────────────────────────────────────────────────

function buildModel(provider: ProviderId, modelId: string, apiKey: string): LanguageModel {
  if (provider === 'anthropic') {
    return createAnthropic({ apiKey })(modelId)
  }
  // OpenAI + OpenAI-compatible providers (google, xai, openrouter)
  const baseURL = PROVIDERS[provider].baseUrl
  return createOpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })(modelId)
}

/**
 * Short, non-reversible discriminator so two managers with the same key share a
 * cached client without us having to put the key itself in the cache key.
 */
function fingerprint(key: string): string {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}
