'use client'

import { useCallback, useRef } from 'react'
import { useStore } from '@/store'
import type { FileData, FlowGraph, TokenUsage, ToolRunSnapshot } from '@/lib/types'

export function useSSERunner() {
  const esRef = useRef<EventSource | null>(null)

  const setRunId          = useStore((s) => s.setRunId)
  const setRunStatus      = useStore((s) => s.setRunStatus)
  const appendNodeToken   = useStore((s) => s.appendNodeToken)
  const appendRunHistory  = useStore((s) => s.appendRunHistory)
  const resetRun          = useStore((s) => s.resetRun)
  const completeRun       = useStore((s) => s.completeRun)

  const runFlow = useCallback(async (
    flowId: string,
    userInput: string,
    graph?: FlowGraph,
    fileData?: FileData,
  ) => {
    resetRun()

    // Start the run — pass graph inline if provided (no DB fetch needed for demos)
    const res = await fetch(`/api/v1/flows/${flowId}/run`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        input: userInput,
        ...(graph    ? { graph }    : {}),
        ...(fileData ? { fileData } : {}),
      }),
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
      setRunStatus(nodeId, 'running', undefined, { stage: 'Thinking…' })
    })

    es.addEventListener('node-delta', (e) => {
      const { nodeId, token } = JSON.parse(e.data) as { nodeId: string; token: string }
      appendNodeToken(nodeId, token)
    })

    // Structured output: each event replaces (not appends) the running output
    es.addEventListener('node-replace', (e) => {
      const { nodeId, output } = JSON.parse(e.data) as { nodeId: string; output: string }
      setRunStatus(nodeId, 'running', output, { stage: 'Structuring…' })
    })

    es.addEventListener('node-end', (e) => {
      const { nodeId, status, durationMs, output, usage, model, tool } = JSON.parse(e.data) as {
        nodeId:     string
        status:     'done' | 'error'
        durationMs: number
        output?:    string
        usage?:     TokenUsage
        model?:     string
        tool?:      ToolRunSnapshot
      }

      const nodeData = useStore.getState().nodes.find((n) => n.id === nodeId)?.data
      const isTool   = nodeData?.nodeType === 'tool'

      setRunStatus(nodeId, status, output, {
        durationMs,
        stage: status === 'done' ? 'Done' : 'Error',
        ...(isTool && tool?.response ? { httpStatus: tool.response.status } : {}),
        ...(isTool && tool?.error    ? { httpError:  tool.error            } : {}),
      })

      // Tool nodes record every attempt — success or failure — so users can inspect what was sent.
      if (isTool && tool) {
        appendRunHistory(nodeId, {
          id:        crypto.randomUUID(),
          output:    output ?? tool.response?.body ?? tool.error ?? '',
          timestamp: Date.now(),
          durationMs,
          status,
          tool,
        })
        return
      }

      if (status === 'done' && output) {
        const mode = nodeData?.config?.structuredOutput ? 'structured' : 'text'

        appendRunHistory(nodeId, {
          id:        crypto.randomUUID(),
          output,
          timestamp: Date.now(),
          durationMs,
          model,
          mode,
          usage,
          status,
        })
      }
    })

    es.addEventListener('run-complete', () => {
      es.close()
      esRef.current = null
      completeRun()
    })

    es.onerror = () => {
      es.close()
      esRef.current = null
      completeRun()
    }
  }, [resetRun, setRunId, setRunStatus, appendNodeToken, appendRunHistory, completeRun])  // fileData intentionally not in deps (passed per-call)

  const stopRun = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    resetRun()
  }, [resetRun])

  return { runFlow, stopRun }
}
