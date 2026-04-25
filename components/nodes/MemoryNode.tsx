'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeData, RunStatus } from '@/store'

const statusBorder: Record<RunStatus, string> = {
  idle:    'border-gray-200',
  running: 'border-teal-400 ring-2 ring-teal-200 animate-pulse',
  done:    'border-green-400',
  error:   'border-red-400',
}

function MemoryNode({ data, selected }: NodeProps) {
  const d       = data as NodeData
  const status  = d.runStatus ?? 'idle'
  const border  = statusBorder[status]
  const selRing = selected ? 'ring-2 ring-teal-400' : ''
  const k       = (d.config?.k as number | undefined) ?? 10

  return (
    <div className={`w-52 px-4 py-3 bg-white rounded-xl border-2 shadow-sm ${border} ${selRing}`}>
      <Handle type="target" position={Position.Top}    id="messages-in"  data-port-type="messages" className="!bg-purple-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="messages-out" data-port-type="messages" className="!bg-purple-500 !w-3 !h-3" />

      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-teal-500" />
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Memory</span>
      </div>

      <p className="text-xs text-gray-500">Buffer · last <strong>{k}</strong> messages</p>
    </div>
  )
}

export default memo(MemoryNode, (prev, next) =>
  (prev.data as NodeData).runStatus === (next.data as NodeData).runStatus &&
  (prev.data as NodeData).runOutput  === (next.data as NodeData).runOutput  &&
  (prev.data as NodeData).config     === (next.data as NodeData).config     &&
  prev.selected === next.selected
)
