import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import type { TokenUsage, ToolRunSnapshot } from '@/lib/types'

// ─── Port & Node types ────────────────────────────────────────────────────────

export type PortType = 'messages' | 'string' | 'json' | 'any'
export type AgentNodeKind = 'input' | 'prompt' | 'llm' | 'tool' | 'memory' | 'output'
export type AnnotationKind = 'shape' | 'text' | 'drawing' | 'arrow'
export type NodeKind  = AgentNodeKind | AnnotationKind
export type RunStatus = 'idle' | 'running' | 'done' | 'error'

export type DrawingTool = 'select' | 'rectangle' | 'ellipse' | 'pen' | 'text' | 'arrow'

export const AGENT_NODE_KINDS: readonly AgentNodeKind[] = ['input', 'prompt', 'llm', 'tool', 'memory', 'output'] as const

export function isAnnotationKind(k: string | undefined): k is AnnotationKind {
  return k === 'shape' || k === 'text' || k === 'drawing' || k === 'arrow'
}

export interface Port {
  id:   string
  type: PortType
}

export interface RunHistoryEntry {
  id:            string
  output:        string
  timestamp:     number        // Date.now()
  durationMs?:   number        // total wall time
  model?:        string        // model identifier, e.g. "claude-sonnet-4-6"
  mode?:         'text' | 'structured'
  usage?:        TokenUsage    // token counts + firstTokenMs
  status?:       'done' | 'error'   // tool runs may end in error but still produce a history card
  tool?:         ToolRunSnapshot    // request/response capture for tool nodes
}

export interface RunMeta {
  charCount?:  number   // chars streamed so far (LLM)
  durationMs?: number   // wall time for the node (set on node-end)
  stage?:      string   // human label: "Thinking…" | "Streaming" | "Done"
  httpStatus?: number   // HTTP response code (Tool nodes)
  httpError?:  string   // error message
  errorCode?:  'usage_exceeded' | 'auth' | 'missing_key' | 'unknown'   // classification for LLM errors
}

export interface NodeData {
  label:     string
  nodeType:  NodeKind
  config:    Record<string, unknown>
  inputs:    Port[]
  outputs:   Port[]
  runStatus?:  RunStatus
  runOutput?:  string
  runMeta?:    RunMeta
  runHistory?: RunHistoryEntry[]
  [key: string]: unknown   // React Flow requires this on NodeData
}

export type AgentNode = Node<NodeData>
export type AgentEdge = Edge

// ─── Full store shape ────────────────────────────────────────────────────────

interface State {
  // graph
  nodes:          AgentNode[]
  edges:          AgentEdge[]
  // run
  runId:          string | null
  // ui
  selectedNodeId: string | null
  sidebarOpen:    boolean
  activeTool:     DrawingTool
  drawingColor:   string
}

interface Actions {
  // graph
  onNodesChange:  (changes: NodeChange<AgentNode>[]) => void
  onEdgesChange:  (changes: EdgeChange[]) => void
  onConnect:      (connection: Connection) => void
  addNode:        (node: AgentNode) => void
  updateNodeData: (id: string, partial: Partial<NodeData>) => void
  loadGraph:      (nodes: AgentNode[], edges: AgentEdge[]) => void
  // run
  setRunId:          (id: string | null) => void
  setRunStatus:      (nodeId: string, status: RunStatus, output?: string, meta?: RunMeta) => void
  appendNodeToken:   (nodeId: string, token: string) => void
  appendRunHistory:  (nodeId: string, entry: RunHistoryEntry) => void
  resetRun:          () => void
  completeRun:       () => void
  clearRunState:     () => void
  // ui
  setSelectedNode: (id: string | null) => void
  closeSidebar:    () => void
  setActiveTool:   (tool: DrawingTool) => void
  setDrawingColor: (color: string) => void
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useStore = create<State & Actions>()((set) => ({
  // ── initial state ──────────────────────────────────────────────────────────
  nodes:          [],
  edges:          [],
  runId:          null,
  selectedNodeId: null,
  sidebarOpen:    false,
  activeTool:     'select',
  drawingColor:   '#fbbf24',

  // ── graph actions ──────────────────────────────────────────────────────────
  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (connection) =>
    set((s) => ({
      edges: addEdge({
        ...connection,
        animated: true,
        style: { stroke: '#00ff88', strokeWidth: 1.5, opacity: 0.7 },
      }, s.edges),
    })),

  addNode: (node) =>
    set((s) => ({ nodes: [...s.nodes, node] })),

  updateNodeData: (id, partial) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...partial } } : n
      ),
    })),

  loadGraph: (nodes, edges) => set({ nodes, edges }),

  // ── run actions ────────────────────────────────────────────────────────────
  setRunId: (id) => set({ runId: id }),

  setRunStatus: (nodeId, status, output, meta) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== nodeId) return n
        return {
          ...n,
          data: {
            ...n.data,
            runStatus: status,
            ...(output !== undefined ? { runOutput: output } : {}),
            ...(meta   !== undefined ? { runMeta: { ...n.data.runMeta, ...meta } } : {}),
          },
        }
      }),
    })),

  appendNodeToken: (nodeId, token) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== nodeId) return n
        const prev      = n.data.runOutput ?? ''
        const charCount = prev.length + token.length
        return {
          ...n,
          data: {
            ...n.data,
            runOutput: prev + token,
            runMeta:   { ...n.data.runMeta, charCount, stage: 'Streaming' },
          },
        }
      }),
    })),

  appendRunHistory: (nodeId, entry) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== nodeId) return n
        const prev = (n.data.runHistory ?? []) as RunHistoryEntry[]
        return { ...n, data: { ...n.data, runHistory: [entry, ...prev].slice(0, 50) } }
      }),
    })),

  resetRun: () =>
    set((s) => ({
      runId: null,
      nodes: s.nodes.map((n) => ({
        ...n,
        data: { ...n.data, runStatus: 'idle' as RunStatus, runOutput: undefined, runMeta: undefined },
      })),
    })),

  // Called when run-complete fires — clears runId and resolves any node still stuck in 'running'
  completeRun: () =>
    set((s) => ({
      runId: null,
      nodes: s.nodes.map((n) => {
        if (n.data.runStatus !== 'running') return n
        return { ...n, data: { ...n.data, runStatus: 'done' as RunStatus } }
      }),
    })),

  // Hard reset: drop all run/session state but preserve graph structure and node configs
  clearRunState: () =>
    set((s) => ({
      runId: null,
      nodes: s.nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          runStatus:  'idle' as RunStatus,
          runOutput:  undefined,
          runMeta:    undefined,
          runHistory: undefined,
        },
      })),
    })),

  // ── ui actions ─────────────────────────────────────────────────────────────
  setSelectedNode: (id) => set({ selectedNodeId: id, sidebarOpen: id !== null }),

  closeSidebar: () => set({ sidebarOpen: false, selectedNodeId: null }),

  setActiveTool:   (tool)  => set({ activeTool: tool }),
  setDrawingColor: (color) => set({ drawingColor: color }),
}))

// ─── Stable selectors (useShallow prevents re-renders on unrelated changes) ──

export const useNodes        = () => useStore(useShallow((s) => s.nodes))
export const useEdges        = () => useStore(useShallow((s) => s.edges))
export const useGraphActions = () => useStore(useShallow((s) => ({
  onNodesChange:  s.onNodesChange,
  onEdgesChange:  s.onEdgesChange,
  onConnect:      s.onConnect,
  addNode:        s.addNode,
  updateNodeData: s.updateNodeData,
  loadGraph:      s.loadGraph,
})))
export const useRunActions   = () => useStore(useShallow((s) => ({
  setRunId:        s.setRunId,
  setRunStatus:    s.setRunStatus,
  appendNodeToken: s.appendNodeToken,
  resetRun:        s.resetRun,
})))
export const useUIState      = () => useStore(useShallow((s) => ({
  selectedNodeId: s.selectedNodeId,
  sidebarOpen:    s.sidebarOpen,
  setSelectedNode: s.setSelectedNode,
  closeSidebar:   s.closeSidebar,
})))
