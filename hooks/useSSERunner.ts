'use client'

import { useCallback, useRef } from 'react'
import { useStore } from '@/store'
import type { FlowGraph } from '@/lib/types'

export function useSSERunner() {
  const esRef = useRef<EventSource | null>(null)

  const setRunId        = useStore((s) => s.setRunId)
  const setRunStatus    = useStore((s) => s.setRunStatus)
  const appendNodeToken = useStore((s) => s.appendNodeToken)
  const resetRun        = useStore((s) => s.resetRun)

  const runFlow = useCallback(async (
    flowId: string,
    userInput: string,
    graph?: FlowGraph,
  ) => {
    resetRun()

    // Start the run — pass graph inline if provided (no DB fetch needed for demos)
    const res = await fetch(`/api/v1/flows/${flowId}/run`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ input: userInput, ...(graph ? { graph } : {}) }),
    })

    if (!res.ok) {
      console.error('Failed to start run:', await res.text())
      return
    }

    const { runId } = await res.json() as { runId: string }
    setRunId(runId)

    // Open SSE stream
    const es = new EventSource(`/api/v1/runs/${runId}/stream`)
    esRef.current = es

    es.addEventListener('node-start', (e) => {
      const { nodeId } = JSON.parse(e.data) as { nodeId: string }
      setRunStatus(nodeId, 'running')
    })

    es.addEventListener('node-delta', (e) => {
      const { nodeId, token } = JSON.parse(e.data) as { nodeId: string; token: string }
      appendNodeToken(nodeId, token)
    })

    es.addEventListener('node-end', (e) => {
      const { nodeId, status } = JSON.parse(e.data) as { nodeId: string; status: 'done' | 'error' }
      setRunStatus(nodeId, status)
    })

    es.addEventListener('run-complete', () => {
      es.close()
      esRef.current = null
    })

    es.onerror = () => {
      es.close()
      esRef.current = null
    }
  }, [resetRun, setRunId, setRunStatus, appendNodeToken])

  const stopRun = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    resetRun()
  }, [resetRun])

  return { runFlow, stopRun }
}
