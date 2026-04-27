import { PROVIDERS, type ProviderId } from './registry'

/**
 * Hits a lightweight authenticated endpoint (typically /models) on the
 * provider to verify the supplied API key. Returns true if 2xx, false otherwise.
 */
export async function validateProviderKey(provider: ProviderId, apiKey: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const spec = PROVIDERS[provider]
  const headers: Record<string, string> = {}

  if (provider === 'anthropic') {
    headers['x-api-key']         = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers['authorization'] = `Bearer ${apiKey}`
  }

  try {
    const res = await fetch(spec.validateUrl, { method: 'GET', headers })
    if (res.ok) return { ok: true, status: res.status }
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, error: text.slice(0, 300) || res.statusText }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
