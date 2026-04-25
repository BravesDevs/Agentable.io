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

// ─── Input node ───────────────────────────────────────────────────────────────

export type InputType = 'text' | 'file' | 'image' | 'json' | 'url'

export interface InputNodeConfig {
  inputType:          InputType
  maxSizeKB?:         number
  allowedExtensions?: string[]   // for file type
  allowedFormats?:    string[]   // for image type
}

// File/image payload sent from client → API → executor
export interface FileData {
  name:     string
  mimeType: string
  size:     number
  data:     string   // raw base64 (no data: prefix)
}

// ─── LLM node ─────────────────────────────────────────────────────────────────

export interface LLMNodeConfig {
  provider:         'anthropic' | 'openai'
  model?:           string
  systemPrompt?:    string
  temperature?:     number
  maxOutputTokens?: number
  structuredOutput?: boolean
  outputSchema?:    Record<string, unknown>   // JSON Schema passed to jsonSchema()
}

export interface PromptNodeConfig {
  template: string
}

export type NodeConfig =
  | InputNodeConfig
  | LLMNodeConfig
  | PromptNodeConfig
  | Record<string, unknown>

// ─── Token / timing analytics ────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens:     number
  completionTokens: number
  totalTokens:      number
  firstTokenMs?:    number   // ms from LLM request start to first token
}

export interface NodeContext {
  input?:    string
  output?:   string
  messages?: ModelMessage[]
  fileData?: FileData
  usage?:    TokenUsage
  [key: string]: unknown
}

export type SSEEvent =
  | { type: 'node-start';    nodeId: string; timestamp: number }
  | { type: 'node-delta';    nodeId: string; token: string }
  | { type: 'node-replace';  nodeId: string; output: string }   // replaces (not appends) runOutput
  | { type: 'node-end';      nodeId: string; status: 'done' | 'error'; durationMs: number; output?: string; usage?: TokenUsage; model?: string }
  | { type: 'run-complete';  runId: string;  status: 'done' | 'error'; error?: string }

export type EmitFn = (event: SSEEvent) => void

export function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}
