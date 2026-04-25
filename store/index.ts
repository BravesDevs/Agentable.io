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

// ─── Port & Node types ────────────────────────────────────────────────────────

export type PortType = 'messages' | 'string' | 'json' | 'any'
export type NodeKind  = 'input' | 'prompt' | 'llm' | 'tool' | 'memory' | 'output'
export type RunStatus = 'idle' | 'running' | 'done' | 'error'

export interface Port {
  id:   string
  type: PortType
}

export interface NodeData {
  label:     string
  nodeType:  NodeKind
  config:    Record<string, unknown>
  inputs:    Port[]
  outputs:   Port[]
  runStatus?: RunStatus
  runOutput?: string
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
  setRunStatus:      (nodeId: string, status: RunStatus, output?: string) => void
  appendNodeToken:   (nodeId: string, token: string) => void
  resetRun:          () => void
  // ui
  setSelectedNode: (id: string | null) => void
  closeSidebar:    () => void
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useStore = create<State & Actions>()((set) => ({
  // ── initial state ──────────────────────────────────────────────────────────
  nodes:          [],
  edges:          [],
  runId:          null,
  selectedNodeId: null,
  sidebarOpen:    false,

  // ── graph actions ──────────────────────────────────────────────────────────
  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (connection) =>
    set((s) => ({ edges: addEdge({ ...connection, animated: false }, s.edges) })),

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

  setRunStatus: (nodeId, status, output) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, runStatus: status, ...(output !== undefined ? { runOutput: output } : {}) } }
          : n
      ),
    })),

  appendNodeToken: (nodeId, token) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, runOutput: (n.data.runOutput ?? '') + token } }
          : n
      ),
    })),

  resetRun: () =>
    set((s) => ({
      runId: null,
      nodes: s.nodes.map((n) => ({
        ...n,
        data: { ...n.data, runStatus: 'idle' as RunStatus, runOutput: undefined },
      })),
    })),

  // ── ui actions ─────────────────────────────────────────────────────────────
  setSelectedNode: (id) => set({ selectedNodeId: id, sidebarOpen: id !== null }),

  closeSidebar: () => set({ sidebarOpen: false, selectedNodeId: null }),
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
