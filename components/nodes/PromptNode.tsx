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

function PromptNode({ data, selected }: NodeProps) {
  const d        = data as NodeData
  const status   = d.runStatus ?? 'idle'
  const border   = statusBorder[status]
  const selRing  = selected ? 'ring-2 ring-purple-400' : ''
  const template = (d.config?.template as string | undefined) ?? ''
  const preview  = template.length > 60 ? template.slice(0, 60) + '…' : template
  const varCount = (template.match(/\{\{(\w+)\}\}/g) ?? []).length

  return (
    <div className={`w-52 px-4 py-3 bg-white rounded-xl border-2 shadow-sm ${border} ${selRing}`}>
      <Handle type="target" position={Position.Top}    id="vars-in"  data-port-type="any"    className="!bg-gray-400  !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="text-out" data-port-type="string" className="!bg-blue-500  !w-3 !h-3" />

      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Prompt</span>
        {varCount > 0 && (
          <span className="ml-auto text-[10px] bg-purple-100 text-purple-600 rounded px-1">{varCount} vars</span>
        )}
      </div>

      <p className="text-xs text-gray-500 font-mono break-words leading-relaxed">
        {preview || <span className="text-gray-300 italic">Click to edit template</span>}
      </p>
    </div>
  )
}

export default memo(PromptNode, (prev, next) =>
  (prev.data as NodeData).runStatus === (next.data as NodeData).runStatus &&
  (prev.data as NodeData).runOutput  === (next.data as NodeData).runOutput  &&
  (prev.data as NodeData).config     === (next.data as NodeData).config     &&
  prev.selected === next.selected
)
