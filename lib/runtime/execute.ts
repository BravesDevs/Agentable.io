import type { EmitFn, FlowGraph, LLMNodeConfig, NodeContext, PromptNodeConfig } from '@/lib/types'
import { topoSort } from './topoSort'
import { handleInput } from './handlers/input'
import { handlePrompt } from './handlers/prompt'
import { handleLLM } from './handlers/llm'
import { handleOutput } from './handlers/output'

export async function execute(
  graph: FlowGraph,
  userInput: string,
  emit: EmitFn,
): Promise<string> {
  const sorted = topoSort(graph.nodes, graph.edges)

  // Per-node output contexts, keyed by nodeId
  const outputs = new Map<string, NodeContext>()

  for (const node of sorted) {
    const startMs = Date.now()
    emit({ type: 'node-start', nodeId: node.id, timestamp: startMs })

    // Merge all parent outputs into this node's input context
    const parentContexts = graph.edges
      .filter(e => e.target === node.id)
      .map(e => outputs.get(e.source))
      .filter((c): c is NodeContext => c !== undefined)

    const inContext: NodeContext = parentContexts.reduce<NodeContext>(
      (acc, ctx) => ({ ...acc, ...ctx }),
      { input: userInput },
    )

    try {
      let outContext: NodeContext

      switch (node.type) {
        case 'input':
          outContext = await handleInput(node.id, undefined, inContext, emit)
          break

        case 'prompt':
          outContext = await handlePrompt(node.id, node.data.config as PromptNodeConfig, inContext, emit)
          break

        case 'llm':
          outContext = await handleLLM(node.id, node.data.config as LLMNodeConfig, inContext, emit)
          break

        case 'output':
          outContext = await handleOutput(node.id, undefined, inContext, emit)
          break

        default:
          // Unimplemented node types are transparent passthroughs
          outContext = { ...inContext }
      }

      outputs.set(node.id, outContext)
      emit({
        type: 'node-end',
        nodeId: node.id,
        status: 'done',
        durationMs: Date.now() - startMs,
        output: outContext.output,
      })
    } catch (err) {
      emit({
        type: 'node-end',
        nodeId: node.id,
        status: 'error',
        durationMs: Date.now() - startMs,
      })
      throw err
    }
  }

  // Return the output node's result, or the last node's output
  const outputNode = [...sorted].reverse().find(n => n.type === 'output')
  const lastNode   = sorted[sorted.length - 1]
  const finalNode  = outputNode ?? lastNode

  return outputs.get(finalNode?.id ?? '')?.output ?? ''
}
