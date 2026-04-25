import type {
  EmitFn,
  NodeContext,
  ToolMethod,
  ToolNodeConfig,
  ToolRequestSnapshot,
  ToolResponseSnapshot,
  ToolRunSnapshot,
} from '@/lib/types'

const RESPONSE_BODY_CAP = 100_000   // chars — protect SSE payload size

function substitute(template: string, ctx: NodeContext): string {
  if (!template) return template
  const input  = ctx.input  ?? ''
  const output = ctx.output ?? ''
  return template
    .replace(/\{\{\s*input\s*\}\}/g, input)
    .replace(/\{\{\s*output\s*\}\}/g, output)
}

function safeParseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (v != null) result[k] = String(v)
      }
      return result
    }
  } catch { /* ignore */ }
  return {}
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => { out[key] = value })
  return out
}

function parseQuery(url: string): Record<string, string> {
  try {
    const u = new URL(url)
    const out: Record<string, string> = {}
    u.searchParams.forEach((v, k) => { out[k] = v })
    return out
  } catch {
    return {}
  }
}

function ensureContentType(headers: Record<string, string>, body: string): Record<string, string> {
  const hasCT = Object.keys(headers).some(k => k.toLowerCase() === 'content-type')
  if (hasCT || !body) return headers
  // Auto-set JSON content-type if body parses as JSON
  try {
    JSON.parse(body)
    return { ...headers, 'Content-Type': 'application/json' }
  } catch {
    return headers
  }
}

export async function handleTool(
  nodeId: string,
  config: ToolNodeConfig | undefined,
  context: NodeContext,
  emit: EmitFn,
): Promise<NodeContext> {
  const cfg: ToolNodeConfig = {
    method:       (config?.method as ToolMethod) ?? 'GET',
    url:          config?.url     ?? '',
    headers:      config?.headers ?? '{}',
    body:         config?.body    ?? '',
    forwardInput: config?.forwardInput ?? false,
  }

  const url = substitute(cfg.url, context).trim()

  // When `forwardInput` is on, the parent node's output becomes the body verbatim.
  // Falls back to `input` (the user's original prompt) if no upstream output is set.
  const requestBody = cfg.forwardInput
    ? (context.output ?? context.input ?? '')
    : substitute(cfg.body, context)

  const reqHeadersRaw = safeParseHeaders(cfg.headers)
  const reqHeaders    = (cfg.method === 'GET' || cfg.method === 'DELETE')
    ? reqHeadersRaw
    : ensureContentType(reqHeadersRaw, requestBody)

  const requestSnap: ToolRequestSnapshot = {
    method:  cfg.method,
    url,
    headers: reqHeaders,
    ...(requestBody && cfg.method !== 'GET' && cfg.method !== 'DELETE' ? { body: requestBody } : {}),
    ...(url ? { query: parseQuery(url) } : {}),
  }

  if (!url) {
    const snap: ToolRunSnapshot = { request: requestSnap, error: 'URL is empty' }
    emit({ type: 'node-replace', nodeId, output: JSON.stringify({ error: snap.error }, null, 2) })
    throw Object.assign(new Error('Tool node URL is empty'), { toolSnapshot: snap })
  }

  const t0 = Date.now()

  try {
    const init: RequestInit = {
      method:  cfg.method,
      headers: reqHeaders,
      ...(cfg.method !== 'GET' && cfg.method !== 'DELETE' && requestBody ? { body: requestBody } : {}),
    }

    const res         = await fetch(url, init)
    const durationMs  = Date.now() - t0
    const resHeaders  = headersToObject(res.headers)
    const contentType = res.headers.get('content-type') ?? undefined

    const rawBody     = await res.text()
    const bodyBytes   = rawBody.length
    const truncated   = rawBody.length > RESPONSE_BODY_CAP
      ? rawBody.slice(0, RESPONSE_BODY_CAP) + '\n…[truncated]'
      : rawBody

    // Pretty-print JSON when applicable for nicer modal display
    let prettyBody = truncated
    if (contentType?.includes('json')) {
      try { prettyBody = JSON.stringify(JSON.parse(truncated), null, 2) }
      catch { /* keep raw */ }
    }

    const responseSnap: ToolResponseSnapshot = {
      status:     res.status,
      statusText: res.statusText,
      headers:    resHeaders,
      body:       prettyBody,
      durationMs,
      bodyBytes,
      ...(contentType ? { contentType } : {}),
    }

    const snap: ToolRunSnapshot = { request: requestSnap, response: responseSnap }
    const ok = res.ok

    emit({ type: 'node-replace', nodeId, output: prettyBody })

    if (!ok) {
      const err = Object.assign(new Error(`HTTP ${res.status} ${res.statusText}`), { toolSnapshot: snap })
      throw err
    }

    return {
      ...context,
      output: prettyBody,
      tool:   snap,
    }
  } catch (err) {
    if (err instanceof Error && (err as Error & { toolSnapshot?: ToolRunSnapshot }).toolSnapshot) {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    const snap: ToolRunSnapshot = { request: requestSnap, error: message }
    throw Object.assign(new Error(message), { toolSnapshot: snap })
  }
}
