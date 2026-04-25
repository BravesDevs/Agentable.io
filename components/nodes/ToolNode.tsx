'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeData, RunStatus } from '@/store'

const statusBorder: Record<RunStatus, string> = {
  idle:    'border-gray-200',
  running: 'border-amber-400 ring-2 ring-amber-200 animate-pulse',
  done:    'border-green-400',
  error:   'border-red-400',
}

const methodColor: Record<string, string> = {
  GET:    'bg-green-100 text-green-700',
  POST:   'bg-blue-100  text-blue-700',
  PUT:    'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100   text-red-700',
}

function ToolNode({ data, selected }: NodeProps) {
  const d       = data as NodeData
  const status  = d.runStatus ?? 'idle'
  const border  = statusBorder[status]
  const selRing = selected ? 'ring-2 ring-amber-400' : ''
  const method  = (d.config?.method as string | undefined) ?? 'GET'
  const url     = (d.config?.url    as string | undefined) ?? ''
  const urlPrev = url.length > 40 ? url.slice(0, 40) + '…' : url

  return (
    <div className={`w-52 px-4 py-3 bg-white rounded-xl border-2 shadow-sm ${border} ${selRing}`}>
      <Handle type="target" position={Position.Top}    id="trigger-in" data-port-type="any"  className="!bg-gray-400  !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="json-out"   data-port-type="json" className="!bg-amber-500 !w-3 !h-3" />

      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tool</span>
        <span className={`ml-auto text-[10px] font-bold rounded px-1 py-0.5 ${methodColor[method] ?? 'bg-gray-100 text-gray-600'}`}>
          {method}
        </span>
      </div>

      <p className="text-xs text-gray-400 font-mono truncate">
        {urlPrev || 'No URL set'}
      </p>
    </div>
  )
}

export default memo(ToolNode, (prev, next) =>
  (prev.data as NodeData).runStatus === (next.data as NodeData).runStatus &&
  (prev.data as NodeData).runOutput  === (next.data as NodeData).runOutput  &&
  (prev.data as NodeData).config     === (next.data as NodeData).config     &&
  prev.selected === next.selected
)
