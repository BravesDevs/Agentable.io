'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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

function CanvasInner() {
  const params                  = useSearchParams()
  const requestedId             = params.get('flowId')
  const [flowId,   setFlowId]   = useState<string | null>(null)
  const [flowName, setFlowName] = useState<string | undefined>()
  const loadGraph    = useStore((s) => s.loadGraph)
  const setStoreFlow = useStore((s) => s.setFlowId)

  useFlowPersist(flowId)

  useEffect(() => {
    async function load() {
      if (requestedId) {
        const r = await fetch(`/api/v1/flows/${requestedId}`)
        if (!r.ok) {
          console.error('Failed to load flow', requestedId, r.status)
          return
        }
        const flow = await r.json() as FlowRow
        setFlowId(flow.id)
        setStoreFlow(flow.id)
        setFlowName(flow.name)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        loadGraph(flow.json.nodes as any, flow.json.edges as any)
        return
      }

      const r    = await fetch('/api/v1/flows')
      const rows = await r.json() as FlowRow[]
      const flow = rows[0]
      if (!flow) return
      setFlowId(flow.id)
      setStoreFlow(flow.id)
      setFlowName(flow.name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadGraph(flow.json.nodes as any, flow.json.edges as any)
    }
    load().catch(console.error)
  }, [requestedId, loadGraph, setStoreFlow])

  if (!flowId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Toolbar flowId={flowId} flowName={flowName} onRename={setFlowName} />
      <div className="flex-1 relative overflow-hidden">
        <Canvas />
        <NodeSidebar />
      </div>
    </div>
  )
}

export default function CanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
        </div>
      }
    >
      <CanvasInner />
    </Suspense>
  )
}
