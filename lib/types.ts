import type { ModelMessage } from 'ai'

export type NodeType =
  | 'input' | 'prompt' | 'llm' | 'tool'
  | 'memory' | 'mcp' | 'rag' | 'guardrail' | 'output'

export interface GraphNode {
  id: string
  type: NodeType
  data: {
    label?: string
    config?: NodeConfig
  }
  position: { x: number; y: number }
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export interface FlowGraph {
  id: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface LLMNodeConfig {
  provider: 'anthropic' | 'openai'
  model?: string
  systemPrompt?: string
  temperature?: number
  maxOutputTokens?: number
}

export interface PromptNodeConfig {
  template: string
}

export type NodeConfig =
  | LLMNodeConfig
  | PromptNodeConfig
  | Record<string, unknown>

export interface NodeContext {
  input?: string
  output?: string
  messages?: ModelMessage[]
  [key: string]: unknown
}

export type SSEEvent =
  | { type: 'node-start';    nodeId: string; timestamp: number }
  | { type: 'node-delta';    nodeId: string; token: string }
  | { type: 'node-end';      nodeId: string; status: 'done' | 'error'; durationMs: number; output?: string }
  | { type: 'run-complete';  runId: string;  status: 'done' | 'error'; error?: string }

export type EmitFn = (event: SSEEvent) => void

export function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}
