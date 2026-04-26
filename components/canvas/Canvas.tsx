'use client'

import { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  type IsValidConnection,
  type DefaultEdgeOptions,
  type OnBeforeDelete,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useShallow } from 'zustand/react/shallow'
import {
  useNodes, useEdges, useGraphActions, useStore,
  isAnnotationKind,
  type AgentEdge, type AgentNode, type NodeData, type PortType, type AgentNodeKind,
} from '@/store'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

import InputNode    from '@/components/nodes/InputNode'
import PromptNode   from '@/components/nodes/PromptNode'
import LLMNode      from '@/components/nodes/LLMNode'
import ToolNode     from '@/components/nodes/ToolNode'
import MemoryNode   from '@/components/nodes/MemoryNode'
import OutputNode   from '@/components/nodes/OutputNode'
import ShapeNode    from '@/components/nodes/ShapeNode'
import TextNode     from '@/components/nodes/TextNode'
import DrawingNode  from '@/components/nodes/DrawingNode'

import NodePalette, { PALETTE_DRAG_MIME } from './NodePalette'
import DrawingDock from './DrawingDock'
import {
  createAgentNode, createShapeNode, createTextNode, createDrawingNode,
  type DrawingPoint,
} from '@/lib/nodeFactory'

// Module-scope — new object on every render = infinite loop
const NODE_TYPES: NodeTypes = {
  input:   InputNode,
  prompt:  PromptNode,
  llm:     LLMNode,
  tool:    ToolNode,
  memory:  MemoryNode,
  output:  OutputNode,
  shape:   ShapeNode,
  text:    TextNode,
  drawing: DrawingNode,
} as const

const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  animated: true,
  style: { stroke: '#00ff88', strokeWidth: 1.5, opacity: 0.7 },
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
    shape:   '#94a3b8',
    text:    '#94a3b8',
    drawing: '#94a3b8',
  }
  return colors[data.nodeType] ?? '#94a3b8'
}

// ─── In-progress drawing preview state ───────────────────────────────────────

type DrawingDraft =
  | { kind: 'rectangle' | 'ellipse'; startScreen: DrawingPoint; endScreen: DrawingPoint; startFlow: DrawingPoint; endFlow: DrawingPoint }
  | { kind: 'pen';       pointsScreen: DrawingPoint[]; pointsFlow: DrawingPoint[] }

// ─── Helpers for the delete-confirmation dialog ──────────────────────────────

function nodeDisplayName(n: AgentNode): string {
  return (n.data.label as string | undefined) ?? n.data.nodeType ?? 'node'
}

function nodeInfoText(n: AgentNode): string {
  const cfg = (n.data.config ?? {}) as Record<string, unknown>
  switch (n.data.nodeType) {
    case 'llm':    return `LLM · ${cfg.model ?? '—'}`
    case 'tool':   return `${cfg.method ?? 'GET'} · ${(cfg.url as string) || 'no url'}`
    case 'prompt': return 'Prompt template'
    case 'memory': return `Buffer · k=${cfg.k ?? 10}`
    case 'input':  return `Input · ${cfg.inputType ?? 'text'}`
    case 'output': return 'Output sink'
    default:       return n.data.nodeType
  }
}

interface PendingDelete {
  nodes:   AgentNode[]
  edges:   AgentEdge[]
  resolve: (allow: boolean) => void
}

// ─── Inner component (consumes useReactFlow) ─────────────────────────────────

function CanvasInner() {
  const nodes = useNodes()
  const edges = useEdges()
  const { onNodesChange, onEdgesChange, onConnect, addNode } = useGraphActions()
  const setSelectedNode = useStore(useShallow((s) => s.setSelectedNode))

  const { activeTool, drawingColor, setActiveTool } = useStore(useShallow((s) => ({
    activeTool:    s.activeTool,
    drawingColor:  s.drawingColor,
    setActiveTool: s.setActiveTool,
  })))

  const { screenToFlowPosition, updateNodeData } = useReactFlow()

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<DrawingDraft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  // Block delete keystrokes / programmatic deletes for agent nodes until the
  // user confirms. Annotation nodes (shapes/text/drawings) skip the dialog —
  // they're decorative and cheap to redraw.
  const onBeforeDelete = useCallback<OnBeforeDelete<AgentNode, AgentEdge>>(async ({ nodes: delNodes, edges: delEdges }) => {
    if (delNodes.length === 0) return true
    if (delNodes.every((n) => isAnnotationKind(n.data.nodeType))) return true
    return new Promise<boolean>((resolve) => {
      setPendingDelete({ nodes: delNodes, edges: delEdges, resolve })
    })
  }, [])

  function resolveDelete(allow: boolean) {
    pendingDelete?.resolve(allow)
    setPendingDelete(null)
  }

  // ── Validate connections by port type ────────────────────────────────────
  const isValidConnection: IsValidConnection = (connection) => {
    const all = useStore.getState().nodes
    const src = all.find((n) => n.id === connection.source)
    const dst = all.find((n) => n.id === connection.target)
    if (!src || !dst) return false
    const sp = src.data.outputs.find((p) => p.id === connection.sourceHandle)
    const dp = dst.data.inputs .find((p) => p.id === connection.targetHandle)
    if (!sp || !dp) return true
    return PORT_COMPAT[sp.type]?.includes(dp.type) ?? false
  }

  // ── Drag-and-drop from NodePalette ──────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(PALETTE_DRAG_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    const kind = e.dataTransfer.getData(PALETTE_DRAG_MIME) as AgentNodeKind
    if (!kind) return
    e.preventDefault()
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addNode(createAgentNode(kind, pos))
  }, [addNode, screenToFlowPosition])

  // ── Drawing pointer handlers ────────────────────────────────────────────
  function wrapperRect() {
    return wrapperRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
  }

  function eventOnExistingNode(e: React.PointerEvent): boolean {
    const t = e.target as HTMLElement
    return !!t.closest('.react-flow__node, .react-flow__controls, .react-flow__minimap, .react-flow__panel, .react-flow__edge, .react-flow__handle')
  }

  // Returns the node id under the cursor (if any), regardless of which inner
  // element actually received the event. Used by the text tool to open an
  // existing shape's inline editor.
  function nodeIdUnder(e: React.PointerEvent): string | null {
    const wrapper = (e.target as HTMLElement).closest<HTMLElement>('.react-flow__node')
    return wrapper?.getAttribute('data-id') ?? null
  }

  function onPointerDown(e: React.PointerEvent) {
    if (activeTool === 'select') return

    // Text tool: clicking inside an existing shape opens its inline editor.
    if (activeTool === 'text') {
      const hitId = nodeIdUnder(e)
      if (hitId) {
        const hit = useStore.getState().nodes.find((n) => n.id === hitId)
        if (hit?.data.nodeType === 'shape') {
          updateNodeData(hitId, { editing: true })
          setActiveTool('select')
          return
        }
        // Click landed on a non-shape node — bail rather than drop a stray text node
        return
      }
    }

    if (eventOnExistingNode(e)) return

    const rect      = wrapperRect()
    const startScr  = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const startFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY })

    if (activeTool === 'text') {
      addNode(createTextNode(startFlow, drawingColor))
      setActiveTool('select')
      return
    }

    if (activeTool === 'rectangle' || activeTool === 'ellipse') {
      setDraft({ kind: activeTool, startScreen: startScr, endScreen: startScr, startFlow, endFlow: startFlow })
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      return
    }

    if (activeTool === 'pen') {
      setDraft({ kind: 'pen', pointsScreen: [startScr], pointsFlow: [startFlow] })
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      return
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draft) return
    const rect    = wrapperRect()
    const curScr  = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const curFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY })

    if (draft.kind === 'pen') {
      setDraft({
        ...draft,
        pointsScreen: [...draft.pointsScreen, curScr],
        pointsFlow:   [...draft.pointsFlow,   curFlow],
      })
    } else {
      setDraft({ ...draft, endScreen: curScr, endFlow: curFlow })
    }
  }

  function onPointerUp() {
    if (!draft) return

    if (draft.kind === 'rectangle' || draft.kind === 'ellipse') {
      const x = Math.min(draft.startFlow.x, draft.endFlow.x)
      const y = Math.min(draft.startFlow.y, draft.endFlow.y)
      const w = Math.max(8, Math.abs(draft.endFlow.x - draft.startFlow.x))
      const h = Math.max(8, Math.abs(draft.endFlow.y - draft.startFlow.y))
      // If user just clicked without dragging, drop a default-sized shape
      const sized = (w < 12 && h < 12)
        ? { x: x - 60, y: y - 40, w: 120, h: 80 }
        : { x, y, w, h }
      addNode(createShapeNode(draft.kind, { x: sized.x, y: sized.y }, { width: sized.w, height: sized.h }, drawingColor))
    } else if (draft.kind === 'pen') {
      const node = createDrawingNode(draft.pointsFlow, drawingColor, 2)
      if (node) addNode(node)
    }

    setDraft(null)
    setActiveTool('select')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setDraft(null)
      if (activeTool !== 'select') setActiveTool('select')
    }
  }

  // ── Render preview overlay (in screen coords, on top of ReactFlow) ──────
  function renderPreview() {
    if (!draft) return null
    if (draft.kind === 'pen') {
      const path = draft.pointsScreen.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      return (
        <svg className="absolute inset-0 pointer-events-none z-20 w-full h-full" style={{ overflow: 'visible' }}>
          <path d={path} fill="none" stroke={drawingColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
    const x = Math.min(draft.startScreen.x, draft.endScreen.x)
    const y = Math.min(draft.startScreen.y, draft.endScreen.y)
    const w = Math.abs(draft.endScreen.x - draft.startScreen.x)
    const h = Math.abs(draft.endScreen.y - draft.startScreen.y)
    return (
      <div
        className="absolute pointer-events-none z-20"
        style={{
          left: x, top: y, width: w, height: h,
          border: `2px dashed ${drawingColor}`,
          background: `${drawingColor}10`,
          borderRadius: draft.kind === 'ellipse' ? '50%' : 6,
        }}
      />
    )
  }

  const drawing       = activeTool !== 'select'
  const cursorClass   = drawing ? (activeTool === 'text' ? 'cursor-text' : 'cursor-crosshair') : ''
  const interactProps = drawing ? { onPointerDown, onPointerMove, onPointerUp } : {}

  return (
    <div
      ref={wrapperRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative w-full h-full bg-[#0a0a0c] outline-none ${cursorClass}`}
      {...interactProps}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        onNodeClick={(_, node) => {
          if (isAnnotationKind((node.data as NodeData).nodeType)) return
          setSelectedNode(node.id)
        }}
        onPaneClick={() => setSelectedNode(null)}
        isValidConnection={isValidConnection}
        onBeforeDelete={onBeforeDelete}
        onlyRenderVisibleElements
        snapToGrid
        snapGrid={[16, 16]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="dark"
        panOnDrag={!drawing}
        nodesDraggable={!drawing}
        selectionOnDrag={false}
        zoomOnDoubleClick={!drawing}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#ffffff18" />
        <Controls className="[&>button]:bg-[#1a1a1e] [&>button]:border-white/10 [&>button]:text-white/60 [&>button:hover]:bg-white/10" />
        <MiniMap
          nodeColor={(node) => nodeColor(node.data as NodeData)}
          className="!bg-[#131316] !border-white/10"
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>

      <NodePalette />
      <DrawingDock />
      {renderPreview()}

      <DeleteConfirmDialog pending={pendingDelete} onResolve={resolveDelete} />
    </div>
  )
}

// ─── Delete confirmation dialog ─────────────────────────────────────────────

function DeleteConfirmDialog({
  pending,
  onResolve,
}: {
  pending:   PendingDelete | null
  onResolve: (allow: boolean) => void
}) {
  const open    = !!pending
  const count   = pending?.nodes.length ?? 0
  const single  = count === 1 ? pending!.nodes[0] : null
  const edgeCt  = pending?.edges.length ?? 0

  const title = single
    ? `Delete ${nodeDisplayName(single)}?`
    : `Delete ${count} nodes?`

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onResolve(false) }}>
      <DialogContent className="max-w-md bg-[#0f0f11] border border-white/10 p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-white/8">
          <DialogTitle className="text-sm font-semibold text-white/90">{title}</DialogTitle>
          <DialogDescription className="text-[11px] text-white/40 mt-0.5 leading-relaxed font-mono">
            {single ? (
              <>
                {nodeInfoText(single)}
                {edgeCt > 0 && (
                  <span className="block mt-1 text-white/30 font-sans">
                    Also removes {edgeCt} connected edge{edgeCt === 1 ? '' : 's'}.
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="block">
                  {pending?.nodes.map(nodeDisplayName).join(', ')}
                </span>
                {edgeCt > 0 && (
                  <span className="block mt-1 text-white/30 font-sans">
                    Also removes {edgeCt} connected edge{edgeCt === 1 ? '' : 's'}.
                  </span>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="px-6 py-4 border-t border-white/8 gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-white/10 text-black/80 hover:bg-white/5 hover:text-white/70"
            onClick={() => onResolve(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            autoFocus
            className="h-8 text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-400/30 hover:border-rose-400/50"
            onClick={() => onResolve(true)}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
