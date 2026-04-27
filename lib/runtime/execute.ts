import type { EmitFn, FileData, FlowGraph, LLMNodeConfig, NodeContext, NodeErrorInfo, PromptNodeConfig, SessionKeys, TokenUsage, ToolNodeConfig, ToolRunSnapshot } from '@/lib/types'
import { topoSort } from './topoSort'
import { handleInput } from './handlers/input'
import { handlePrompt } from './handlers/prompt'
import { handleLLM } from './handlers/llm'
import { handleOutput } from './handlers/output'
import { handleTool } from './handlers/tool'

const ANNOTATION_TYPES = new Set(['shape', 'text', 'drawing'])

export async function execute(
  graph: FlowGraph,
  userInput: string,
  emit: EmitFn,
  fileData?: FileData,
  sessionKeys?: SessionKeys,
): Promise<string> {
  // Annotation nodes (shapes, text, freehand drawings) are decorative only —
  // strip them and any edges that would touch them before scheduling.
  const runnableNodes = graph.nodes.filter((n) => !ANNOTATION_TYPES.has(n.type ?? ''))
  const runnableIds   = new Set(runnableNodes.map((n) => n.id))
  const runnableEdges = graph.edges.filter((e) => runnableIds.has(e.source) && runnableIds.has(e.target))

  const sorted = topoSort(runnableNodes, runnableEdges)

  // Per-node output contexts, keyed by nodeId
  const outputs = new Map<string, NodeContext>()

  for (const node of sorted) {
    const startMs = Date.now()
    emit({ type: 'node-start', nodeId: node.id, timestamp: startMs })

    // Merge all parent outputs into this node's input context
    const parentContexts = runnableEdges
      .filter(e => e.target === node.id)
      .map(e => outputs.get(e.source))
      .filter((c): c is NodeContext => c !== undefined)

    const inContext: NodeContext = parentContexts.reduce<NodeContext>(
      (acc, ctx) => ({ ...acc, ...ctx }),
      {
        input: userInput,
        ...(fileData    ? { fileData }    : {}),
        ...(sessionKeys ? { sessionKeys } : {}),
      },
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

        case 'tool':
          outContext = await handleTool(node.id, node.data.config as ToolNodeConfig, inContext, emit)
          break

        case 'output':
          outContext = await handleOutput(node.id, undefined, inContext, emit)
          break

        default:
          // Unimplemented node types are transparent passthroughs
          outContext = { ...inContext }
      }

      outputs.set(node.id, outContext)

      // LLM nodes return usage + model for analytics
      const cfg = node.data.config as Record<string, unknown> | undefined
      emit({
        type:      'node-end',
        nodeId:    node.id,
        status:    'done',
        durationMs: Date.now() - startMs,
        output:    outContext.output,
        ...(outContext.usage ? { usage: outContext.usage as TokenUsage } : {}),
        ...(node.type === 'llm'  ? { model: (cfg?.model as string | undefined) ?? 'claude-sonnet-4-6' } : {}),
        ...(node.type === 'tool' && outContext.tool ? { tool: outContext.tool as ToolRunSnapshot } : {}),
      })
    } catch (err) {
      const toolSnap  = (err as Error & { toolSnapshot?: ToolRunSnapshot }).toolSnapshot
      const errorMeta = (err as Error & { errorMeta?: NodeErrorInfo }).errorMeta
      const errorInfo: NodeErrorInfo = errorMeta ?? {
        code:    'unknown',
        message: err instanceof Error ? err.message : String(err),
      }
      emit({
        type:       'node-end',
        nodeId:     node.id,
        status:     'error',
        durationMs: Date.now() - startMs,
        error:      errorInfo,
        ...(toolSnap ? { tool: toolSnap } : {}),
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
