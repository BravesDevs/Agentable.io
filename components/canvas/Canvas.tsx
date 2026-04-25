'use client'

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  type IsValidConnection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useNodes, useEdges, useGraphActions, useStore, type NodeData, type PortType } from '@/store'
import { useShallow } from 'zustand/react/shallow'

// Placeholder node components — replaced in Step 4
import InputNode  from '@/components/nodes/InputNode'
import PromptNode from '@/components/nodes/PromptNode'
import LLMNode    from '@/components/nodes/LLMNode'
import ToolNode   from '@/components/nodes/ToolNode'
import MemoryNode from '@/components/nodes/MemoryNode'
import OutputNode from '@/components/nodes/OutputNode'

// ─── NODE_TYPES must live at module scope — never inside the component ────────
const NODE_TYPES: NodeTypes = {
  input:  InputNode,
  prompt: PromptNode,
  llm:    LLMNode,
  tool:   ToolNode,
  memory: MemoryNode,
  output: OutputNode,
} as const

// ─── Port compatibility ───────────────────────────────────────────────────────
const PORT_COMPAT: Record<PortType, PortType[]> = {
  messages: ['messages', 'any'],
  string:   ['string',   'any'],
  json:     ['json',     'any'],
  any:      ['messages', 'string', 'json', 'any'],
}

function nodeColor(data: NodeData): string {
  const colors: Record<string, string> = {
    input:   '#6366f1',
    prompt:  '#8b5cf6',
    llm:     '#3b82f6',
    tool:    '#f59e0b',
    memory:  '#14b8a6',
    output:  '#22c55e',
  }
  return colors[data.nodeType] ?? '#94a3b8'
}

// ─── Canvas component ─────────────────────────────────────────────────────────
export default function Canvas() {
  const nodes = useNodes()
  const edges = useEdges()
  const { onNodesChange, onEdgesChange, onConnect } = useGraphActions()
  const setSelectedNode = useStore(useShallow((s) => s.setSelectedNode))

  const isValidConnection: IsValidConnection = (connection) => {
    const allNodes = useStore.getState().nodes
    const sourceNode = allNodes.find((n) => n.id === connection.source)
    const targetNode = allNodes.find((n) => n.id === connection.target)
    if (!sourceNode || !targetNode) return false

    const sourcePort = sourceNode.data.outputs.find((p) => p.id === connection.sourceHandle)
    const targetPort = targetNode.data.inputs.find((p)  => p.id === connection.targetHandle)
    if (!sourcePort || !targetPort) return true // allow if port metadata missing

    return PORT_COMPAT[sourcePort.type]?.includes(targetPort.type) ?? false
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onPaneClick={() => setSelectedNode(null)}
        isValidConnection={isValidConnection}
        onlyRenderVisibleElements
        snapToGrid
        snapGrid={[16, 16]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap nodeColor={(node) => nodeColor(node.data as NodeData)} />
      </ReactFlow>
    </div>
  )
}
