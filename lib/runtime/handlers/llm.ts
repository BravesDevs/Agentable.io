import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { ModelMessage } from 'ai'
import type { EmitFn, LLMNodeConfig, NodeContext } from '@/lib/types'

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
    fullText += token
    emit({ type: 'node-delta', nodeId, token })
  }

  return {
    ...context,
    output: fullText,
    messages: [
      ...messages,
      { role: 'assistant', content: fullText },
    ],
  }
}
