import { streamText, streamObject, jsonSchema } from 'ai'
import type { ModelMessage } from 'ai'
import type { EmitFn, LLMNodeConfig, NodeContext, SessionKeys, TokenUsage } from '@/lib/types'
import { PROVIDERS, type ProviderId, isProviderId } from '@/lib/providers/registry'
import { LLMManager, MissingApiKeyError } from '@/lib/llm-manager'
import { currentUserId } from '@/lib/auth'

// OpenAI structured output requires additionalProperties: false on every object node.
// Apply recursively so nested objects don't trigger the same error.
function normalizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result = { ...schema }
  if (result.type === 'object') {
    result.additionalProperties = false
    if (result.properties && typeof result.properties === 'object') {
      result.properties = Object.fromEntries(
        Object.entries(result.properties as Record<string, unknown>).map(([k, v]) => [
          k,
          normalizeSchema(v as Record<string, unknown>),
        ])
      )
    }
  }
  if (result.type === 'array') {
    if (result.items && typeof result.items === 'object') {
      result.items = normalizeSchema(result.items as Record<string, unknown>)
    } else {
      result.items = { type: 'string' }   // OpenAI requires items to have an explicit type
    }
  }
  return result
}

export type LLMErrorCode = 'usage_exceeded' | 'auth' | 'missing_key' | 'unknown'

export interface LLMErrorMeta {
  message:  string
  code:     LLMErrorCode
  provider: ProviderId
  model:    string
  status?:  number
}

const USAGE_PATTERN =
  /(rate.?limit|quota|usage.{0,20}(limit|exceed)|credit.{0,20}(balance|exhaust)|insufficient.{0,20}credit|over.{0,5}quota|too.{0,5}many.{0,5}requests)/i

function classifyLLMError(err: unknown, provider: ProviderId, model: string): LLMErrorMeta {
  if (err instanceof MissingApiKeyError) {
    return { code: 'missing_key', message: err.message, provider: err.provider, model }
  }

  // AI SDK errors expose statusCode; some providers return 200 with an error body.
  const e        = err as { statusCode?: number; status?: number; message?: string; responseBody?: string }
  const status   = e?.statusCode ?? e?.status
  const message  = (e?.message ?? String(err)).slice(0, 500)
  const haystack = `${message} ${e?.responseBody ?? ''}`

  if (status === 429 || status === 402 || USAGE_PATTERN.test(haystack)) {
    return { code: 'usage_exceeded', message, provider, model, status }
  }
  if (status === 401 || status === 403) {
    return { code: 'auth', message, provider, model, status }
  }
  return { code: 'unknown', message, provider, model, status }
}

/** Error wrapper carrying classification metadata that execute.ts forwards to the SSE stream. */
class LLMRuntimeError extends Error {
  constructor(public errorMeta: LLMErrorMeta) {
    super(errorMeta.message)
    this.name = 'LLMRuntimeError'
  }
}

// The user's configured (provider, model) is the contract — we never silently
// fall back to a different provider or model on error. Cost control + predictability.
async function resolveModel(config: LLMNodeConfig, sessionKeys?: SessionKeys) {
  const provider: ProviderId = isProviderId(config.provider) ? config.provider : 'anthropic'
  const modelId  = config.model ?? PROVIDERS[provider].models[0].id
  const userId   = await currentUserId()
  return LLMManager.forUser(userId).getModel(provider, modelId, sessionKeys)
}

export async function handleLLM(
  nodeId: string,
  config: LLMNodeConfig | undefined,
  context: NodeContext,
  emit: EmitFn,
): Promise<NodeContext> {
  const cfg: LLMNodeConfig = {
    provider: 'anthropic',
    model:    'claude-sonnet-4-6',
    ...config,
  }

  const providerId: ProviderId = isProviderId(cfg.provider) ? cfg.provider : 'anthropic'
  const modelId                = cfg.model ?? PROVIDERS[providerId].models[0].id

  const sessionKeys = context.sessionKeys as SessionKeys | undefined

  let model: Awaited<ReturnType<typeof resolveModel>>
  try {
    model = await resolveModel(cfg, sessionKeys)
  } catch (err) {
    throw new LLMRuntimeError(classifyLLMError(err, providerId, modelId))
  }

  const messages: ModelMessage[] = context.messages?.length
    ? context.messages
    : [{ role: 'user', content: context.output ?? context.input ?? '' }]

  try {
  // ── Structured output path ─────────────────────────────────────────────────
  if (cfg.structuredOutput && cfg.outputSchema) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = jsonSchema(normalizeSchema(cfg.outputSchema as Record<string, unknown>) as any)
    const t0 = Date.now()
    let firstTokenMs: number | undefined

    const result = streamObject({
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schema: schema as any,
      system: cfg.systemPrompt,
      messages,
      temperature: cfg.temperature,
      experimental_telemetry: {
        isEnabled: Boolean(process.env.LANGFUSE_SECRET_KEY),
        functionId: `node:${nodeId}`,
      },
    })

    for await (const partial of result.partialObjectStream) {
      if (firstTokenMs === undefined) firstTokenMs = Date.now() - t0
      emit({ type: 'node-replace', nodeId, output: JSON.stringify(partial, null, 2) })
    }

    const [finalObject, rawUsage] = await Promise.all([result.object, result.usage])
    const output = JSON.stringify(finalObject, null, 2)

    const promptTokens     = rawUsage.inputTokens  ?? 0
    const completionTokens = rawUsage.outputTokens ?? 0
    const usage: TokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      firstTokenMs,
    }

    return {
      ...context,
      output,
      usage,
      messages: [...messages, { role: 'assistant', content: output }],
    }
  }

  // ── Streaming text path ────────────────────────────────────────────────────
  const t0 = Date.now()
  let firstTokenMs: number | undefined

  const result = streamText({
    model,
    system: cfg.systemPrompt,
    messages,
    temperature: cfg.temperature,
    maxOutputTokens: cfg.maxOutputTokens,
    experimental_telemetry: {
      isEnabled: Boolean(process.env.LANGFUSE_SECRET_KEY),
      functionId: `node:${nodeId}`,
    },
  })

  let fullText = ''
  for await (const token of result.textStream) {
    if (firstTokenMs === undefined) firstTokenMs = Date.now() - t0
    fullText += token
    emit({ type: 'node-delta', nodeId, token })
  }

  const rawUsage         = await result.usage
  const promptTokens     = rawUsage.inputTokens  ?? 0
  const completionTokens = rawUsage.outputTokens ?? 0
  const usage: TokenUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    firstTokenMs,
  }

  return {
    ...context,
    output: fullText,
    usage,
    messages: [...messages, { role: 'assistant', content: fullText }],
  }
  } catch (err) {
    if (err instanceof LLMRuntimeError) throw err
    throw new LLMRuntimeError(classifyLLMError(err, providerId, modelId))
  }
}
