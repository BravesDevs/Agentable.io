import type { EmitFn, NodeContext, PromptNodeConfig } from '@/lib/types'

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export async function handlePrompt(
  _nodeId: string,
  config: PromptNodeConfig | undefined,
  context: NodeContext,
  _emit: EmitFn,
): Promise<NodeContext> {
  const template = config?.template ?? '{{input}}'

  const vars: Record<string, string> = {
    input:  String(context.input  ?? ''),
    output: String(context.output ?? ''),
  }

  const rendered = interpolate(template, vars)

  return {
    ...context,
    output: rendered,
    messages: [{ role: 'user', content: rendered }],
  }
}
