'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'

export function useFlowPersist(flowId: string | null) {
  const nodes    = useStore(useShallow((s) => s.nodes))
  const edges    = useStore(useShallow((s) => s.edges))
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!flowId) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await fetch(`/api/v1/flows/${flowId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ json: { nodes, edges } }),
      })
    }, 600)
    return () => clearTimeout(timerRef.current)
  }, [nodes, edges, flowId])
}
