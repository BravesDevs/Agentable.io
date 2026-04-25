'use client'

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  type IsValidConnection,
  type DefaultEdgeOptions,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useNodes, useEdges, useGraphActions, useStore, type NodeData, type PortType } from '@/store'
import { useShallow } from 'zustand/react/shallow'

import InputNode  from '@/components/nodes/InputNode'
import PromptNode from '@/components/nodes/PromptNode'
import LLMNode    from '@/components/nodes/LLMNode'
import ToolNode   from '@/components/nodes/ToolNode'
import MemoryNode from '@/components/nodes/MemoryNode'
import OutputNode from '@/components/nodes/OutputNode'

// Must be at module scope — new object on every render = infinite loop
const NODE_TYPES: NodeTypes = {
  input:  InputNode,
  prompt: PromptNode,
  llm:    LLMNode,
  tool:   ToolNode,
  memory: MemoryNode,
  output: OutputNode,
} as const

// Flowing dashes on every edge
const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  animated: true,
  style: {
    stroke:      '#00ff88',
    strokeWidth: 1.5,
    opacity:     0.7,
  },
}

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

export default function Canvas() {
  const nodes = useNodes()
  const edges = useEdges()
  const { onNodesChange, onEdgesChange, onConnect } = useGraphActions()
  const setSelectedNode = useStore(useShallow((s) => s.setSelectedNode))

  const isValidConnection: IsValidConnection = (connection) => {
    const allNodes   = useStore.getState().nodes
    const sourceNode = allNodes.find((n) => n.id === connection.source)
    const targetNode = allNodes.find((n) => n.id === connection.target)
    if (!sourceNode || !targetNode) return false

    const sourcePort = sourceNode.data.outputs.find((p) => p.id === connection.sourceHandle)
    const targetPort = targetNode.data.inputs.find((p)  => p.id === connection.targetHandle)
    if (!sourcePort || !targetPort) return true

    return PORT_COMPAT[sourcePort.type]?.includes(targetPort.type) ?? false
  }

  return (
    <div className="w-full h-full bg-[#0a0a0c]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onPaneClick={() => setSelectedNode(null)}
        isValidConnection={isValidConnection}
        onlyRenderVisibleElements
        snapToGrid
        snapGrid={[16, 16]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#ffffff18"
        />
        <Controls className="[&>button]:bg-[#1a1a1e] [&>button]:border-white/10 [&>button]:text-white/60 [&>button:hover]:bg-white/10" />
        <MiniMap
          nodeColor={(node) => nodeColor(node.data as NodeData)}
          className="!bg-[#131316] !border-white/10"
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>
    </div>
  )
}
