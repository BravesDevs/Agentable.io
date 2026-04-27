import type { ProviderId } from './registry'

/**
 * Verifies that an API key is live by hitting a per-provider endpoint that
 * (a) requires authentication and (b) is cheap or free. We deliberately do
 * NOT use generic /models routes for every provider because some are public
 * (OpenRouter) and others may reject scoped keys (Anthropic User-tokens).
 */
export async function validateProviderKey(
  provider: ProviderId,
  apiKey: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    switch (provider) {
      case 'anthropic': {
        // count_tokens is auth-gated and free, so it works for all key scopes.
        // Anthropic returns 401 `authentication_error` for bad keys; any other
        // 4xx (e.g. 400 `invalid_request_error` for low credit balance) means
        // the key itself authenticated — we treat the key as valid in that case.
        const res = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
          method: 'POST',
          headers: {
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          body: JSON.stringify({
            model:    'claude-haiku-4-5',
            messages: [{ role: 'user', content: 'ping' }],
          }),
        })
        if (res.ok) return { ok: true, status: res.status }
        if (res.status !== 401) return { ok: true, status: res.status }
        return summarize(res)
      }

      case 'openai':
        return summarize(await fetch('https://api.openai.com/v1/models', {
          headers: { authorization: `Bearer ${apiKey}` },
        }))

      case 'google':
        // Native Gemini API (not OpenAI-compat) — accepts the key as a query param
        // and reliably rejects bad keys with 400.
        return summarize(await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        ))

      case 'xai':
        return summarize(await fetch('https://api.x.ai/v1/models', {
          headers: { authorization: `Bearer ${apiKey}` },
        }))

      case 'openrouter':
        // /api/v1/models is public (always 200), so use /auth/key to actually verify.
        return summarize(await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { authorization: `Bearer ${apiKey}` },
        }))
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function summarize(res: Response): Promise<{ ok: boolean; status: number; error?: string }> {
  if (res.ok) return { ok: true, status: res.status }
  const text = await res.text().catch(() => '')
  return { ok: false, status: res.status, error: text.slice(0, 300) || res.statusText }
}
