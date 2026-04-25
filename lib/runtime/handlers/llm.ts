import { streamText, streamObject, jsonSchema } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { ModelMessage } from 'ai'
import type { EmitFn, LLMNodeConfig, NodeContext, TokenUsage } from '@/lib/types'

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

function resolveModel(config: LLMNodeConfig) {
  const model = config.model ?? 'claude-sonnet-4-6'
  const isOpenAI = model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || config.provider === 'openai'
  if (isOpenAI) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(model)
  }
  return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(model)
}

export async function handleLLM(
  nodeId: string,
  config: LLMNodeConfig | undefined,
  context: NodeContext,
  emit: EmitFn,
): Promise<NodeContext> {
  const cfg: LLMNodeConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    ...config,
  }

  const messages: ModelMessage[] = context.messages?.length
    ? context.messages
    : [{ role: 'user', content: context.output ?? context.input ?? '' }]

  // ── Structured output path ─────────────────────────────────────────────────
  if (cfg.structuredOutput && cfg.outputSchema) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = jsonSchema(normalizeSchema(cfg.outputSchema as Record<string, unknown>) as any)
    const t0 = Date.now()
    let firstTokenMs: number | undefined

    const result = streamObject({
      model: resolveModel(cfg),
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
    model: resolveModel(cfg),
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
}
