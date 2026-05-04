import { LLMManager } from '@/lib/llm-manager'
import { currentUserId } from '@/lib/auth'
import type { ProviderId } from './registry'

/**
 * Thin wrapper around `LLMManager.getKey` for callers that just need the raw key
 * and don't want to construct a manager themselves. Delegates to LLMManager so
 * the resolution priority (session > DB > env) lives in one place.
 */
export async function resolveProviderKey(
  provider: ProviderId,
  sessionKeys?: Partial<Record<ProviderId, string>>,
): Promise<string | null> {
  const userId = await currentUserId()
  return LLMManager.forUser(userId).getKey(provider, sessionKeys)
}
