'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeData, RunStatus } from '@/store'

const statusBorder: Record<RunStatus, string> = {
  idle:    'border-gray-200',
  running: 'border-blue-400 ring-2 ring-blue-200',
  done:    'border-green-400',
  error:   'border-red-400',
}

function LLMNode({ data, selected }: NodeProps) {
  const d       = data as NodeData
  const status  = d.runStatus ?? 'idle'
  const border  = statusBorder[status]
  const selRing = selected ? 'ring-2 ring-blue-400' : ''
  const model   = (d.config?.model as string | undefined) ?? 'claude-sonnet-4-6'

  return (
    <div className={`w-52 px-4 py-3 bg-white rounded-xl border-2 shadow-sm ${border} ${selRing}`}>
      {/* Handles */}
      <Handle type="target" position={Position.Top}    id="messages-in" data-port-type="messages" className="!bg-purple-500 !w-3 !h-3 !left-1/3" />
      <Handle type="target" position={Position.Top}    id="system-in"   data-port-type="string"   className="!bg-gray-400  !w-3 !h-3 !left-2/3" />
      <Handle type="source" position={Position.Bottom} id="messages-out" data-port-type="messages" className="!bg-purple-500 !w-3 !h-3 !left-1/3" />
      <Handle type="source" position={Position.Bottom} id="text-out"    data-port-type="string"   className="!bg-blue-500  !w-3 !h-3 !left-2/3" />

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">LLM</span>
        </div>
        {status === 'running' && (
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        )}
      </div>

      <p className="text-xs text-gray-400 mb-2 truncate">{model}</p>

      {/* Streaming output */}
      {d.runOutput && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 max-h-24 overflow-y-auto">
          <span className="font-mono text-xs text-gray-600 break-words whitespace-pre-wrap">
            {d.runOutput}
          </span>
          {status === 'running' && (
            <span className="inline-block w-1 h-3 bg-blue-400 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      )}
    </div>
  )
}

export default memo(LLMNode, (prev, next) =>
  (prev.data as NodeData).runStatus === (next.data as NodeData).runStatus &&
  (prev.data as NodeData).runOutput  === (next.data as NodeData).runOutput  &&
  (prev.data as NodeData).config     === (next.data as NodeData).config     &&
  prev.selected === next.selected
)
