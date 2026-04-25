'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeData, RunStatus } from '@/store'

const statusBorder: Record<RunStatus, string> = {
  idle:    'border-white/10',
  running: 'border-[#00ff88] shadow-[0_0_18px_rgba(0,255,136,0.45)] ring-1 ring-[#00ff88]/30',
  done:    'border-[#00ff88]/50',
  error:   'border-red-500',
}

function PromptNode({ data, selected }: NodeProps) {
  const d        = data as NodeData
  const status   = d.runStatus ?? 'idle'
  const border   = statusBorder[status]
  const selRing  = selected ? 'ring-1 ring-purple-400/60' : ''
  const template = (d.config?.template as string | undefined) ?? ''
  const preview  = template.length > 60 ? template.slice(0, 60) + '…' : template
  const varCount = (template.match(/\{\{(\w+)\}\}/g) ?? []).length

  return (
    <div className={`w-52 px-4 py-3 bg-[#131316] rounded-xl border shadow-lg ${border} ${selRing}`}>
      <Handle type="target" position={Position.Top}    id="vars-in"  data-port-type="any"    className="!bg-white/40 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="text-out" data-port-type="string" className="!bg-blue-400 !w-3 !h-3" />

      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-purple-400" />
        <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">Prompt</span>
        {varCount > 0 && (
          <span className="ml-auto text-[10px] bg-purple-500/20 text-purple-300 rounded px-1.5 py-0.5 border border-purple-500/20">
            {varCount} var{varCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <p className="text-[11px] text-white/40 font-mono break-words leading-relaxed">
        {preview || <span className="text-white/20 italic">Click to edit</span>}
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
