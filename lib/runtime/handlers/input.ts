import type { EmitFn, NodeContext } from '@/lib/types'

export async function handleInput(
  _nodeId: string,
  _config: unknown,
  context: NodeContext,
  _emit: EmitFn,
): Promise<NodeContext> {
  return {
    ...context,
    output: context.input ?? '',
    messages: [{ role: 'user', content: context.input ?? '' }],
  }
}
