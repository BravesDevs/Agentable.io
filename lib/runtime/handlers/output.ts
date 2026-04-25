import type { EmitFn, NodeContext } from '@/lib/types'

export async function handleOutput(
  _nodeId: string,
  _config: unknown,
  context: NodeContext,
  _emit: EmitFn,
): Promise<NodeContext> {
  return context
}
