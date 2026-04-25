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

function MemoryNode({ data, selected }: NodeProps) {
  const d        = data as NodeData
  const status   = d.runStatus ?? 'idle'
  const border   = statusBorder[status]
  const selRing  = selected ? 'ring-1 ring-teal-400/60' : ''
  const k        = (d.config?.k as number | undefined) ?? 10
  const history  = d.runHistory ?? []
  const runCount = history.length

  return (
    <div className={`w-56 px-4 py-3 bg-[#131316] rounded-xl border shadow-lg transition-shadow duration-300 ${border} ${selRing}`}>
      <Handle type="target" position={Position.Top}    id="messages-in"  data-port-type="messages" className="!bg-purple-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="messages-out" data-port-type="messages" className="!bg-purple-500 !w-3 !h-3" />

      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-teal-400" />
        <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">Memory</span>
        {runCount > 0 && (
          <span className="ml-auto text-[10px] font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/20 rounded-full px-2 py-0.5">
            {runCount} msg{runCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <p className="text-[11px] text-white/40 mb-2">Buffer · last <strong className="text-white/70">{k}</strong> msgs</p>

      {d.runOutput ? (
        <div className="bg-black/40 rounded-lg px-2.5 py-2 border border-white/5">
          <p className="text-[11px] text-white/60 font-mono break-words line-clamp-3 leading-relaxed">
            {d.runOutput}
          </p>
        </div>
      ) : (
        <p className="text-xs text-white/20 italic">
          {runCount > 0 ? 'Click to view history' : 'Awaiting messages…'}
        </p>
      )}

      {runCount > 0 && (
        <p className="text-[10px] text-white/20 mt-2 text-right">
          Click node → view history
        </p>
      )}
    </div>
  )
}

export default memo(MemoryNode, (prev, next) =>
  (prev.data as NodeData).runStatus  === (next.data as NodeData).runStatus  &&
  (prev.data as NodeData).runOutput  === (next.data as NodeData).runOutput  &&
  (prev.data as NodeData).runHistory === (next.data as NodeData).runHistory &&
  (prev.data as NodeData).config     === (next.data as NodeData).config     &&
  prev.selected === next.selected
)
