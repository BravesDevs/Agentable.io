'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeData, RunStatus } from '@/store'

const statusBorder: Record<RunStatus, string> = {
  idle:    'border-gray-200',
  running: 'border-blue-400 ring-2 ring-blue-200 animate-pulse',
  done:    'border-green-400',
  error:   'border-red-400',
}

function InputNode({ data, selected }: NodeProps) {
  const d        = data as NodeData
  const status   = d.runStatus ?? 'idle'
  const border   = statusBorder[status]
  const selRing  = selected ? 'ring-2 ring-indigo-400' : ''

  return (
    <div className={`w-52 px-4 py-3 bg-white rounded-xl border-2 shadow-sm ${border} ${selRing}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-indigo-500" />
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Input</span>
      </div>
      <p className="text-xs text-gray-400">Flow input</p>

      <Handle
        type="source"
        position={Position.Bottom}
        id="text-out"
        data-port-type="string"
        className="!bg-blue-500 !w-3 !h-3"
      />
    </div>
  )
}

export default memo(InputNode, (prev, next) =>
  (prev.data as NodeData).runStatus === (next.data as NodeData).runStatus &&
  (prev.data as NodeData).runOutput  === (next.data as NodeData).runOutput  &&
  prev.selected === next.selected
)
