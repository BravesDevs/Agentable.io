'use client'

import { useEffect, useState } from 'react'
import Canvas      from '@/components/canvas/Canvas'
import Toolbar     from '@/components/canvas/Toolbar'
import NodeSidebar from '@/components/canvas/NodeSidebar'
import { useStore } from '@/store'
import { useFlowPersist } from '@/hooks/useFlowPersist'

interface FlowRow {
  id:        string
  name:      string
  json:      { nodes: unknown[]; edges: unknown[] }
  createdAt: string
}

export default function CanvasPage() {
  const [flowId,   setFlowId]   = useState<string | null>(null)
  const [flowName, setFlowName] = useState<string | undefined>()
  const loadGraph = useStore((s) => s.loadGraph)

  useFlowPersist(flowId)

  useEffect(() => {
    fetch('/api/v1/flows')
      .then((r) => r.json())
      .then((rows: FlowRow[]) => {
        const flow = rows[0]
        if (!flow) return
        setFlowId(flow.id)
        setFlowName(flow.name)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        loadGraph(flow.json.nodes as any, flow.json.edges as any)
      })
      .catch(console.error)
  }, [loadGraph])

  if (!flowId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Toolbar flowId={flowId} flowName={flowName} />
      <div className="flex-1 relative overflow-hidden">
        <Canvas />
        <NodeSidebar />
      </div>
    </div>
  )
}
