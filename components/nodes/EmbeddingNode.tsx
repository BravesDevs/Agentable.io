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

function EmbeddingNode({ data, selected }: NodeProps) {
  const d         = data as NodeData
  const status    = d.runStatus ?? 'idle'
  const border    = statusBorder[status]
  const selRing   = selected ? 'ring-1 ring-fuchsia-400/60' : ''
  const provider  = (d.config?.provider as string | undefined)   ?? 'openai'
  const model     = (d.config?.model    as string | undefined)   ?? 'text-embedding-3-small'
  const dims      = (d.config?.dimensions as number | undefined) ?? 1536
  const meta      = d.runMeta

  return (
    <div className={`w-60 px-4 py-3 bg-[#131316] rounded-xl border shadow-lg transition-shadow duration-300 ${border} ${selRing}`}>
      <Handle type="target" position={Position.Top}    id="source-in"   data-port-type="any"  className="!bg-white/40 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="vectors-out" data-port-type="json" className="!bg-fuchsia-400 !w-3 !h-3" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
        <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">Embedding</span>
        <span className="ml-auto text-[9px] font-bold rounded px-1.5 py-0.5 border bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/20 uppercase tracking-wide">
          {provider}
        </span>
      </div>

      {/* Model + dims */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] text-white/40 font-mono truncate">{model}</p>
        <span className="text-[10px] tabular-nums text-white/30 font-mono shrink-0">{dims}d</span>
      </div>

      {/* Running */}
      {status === 'running' && (
        <div className="flex items-center gap-2 py-1 px-2 rounded-lg bg-fuchsia-500/8 border border-fuchsia-500/15">
          <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
          <span className="text-[11px] text-fuchsia-300/70 font-mono truncate">Embedding…</span>
        </div>
      )}

      {/* Done */}
      {status === 'done' && (
        <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/4 border border-white/6">
          <span className="text-[11px] font-mono text-fuchsia-300">
            {(meta?.vectorCount ?? 0)} vec{meta?.vectorCount === 1 ? '' : 's'}
          </span>
          <span className="text-[10px] text-white/20 font-mono">
            {meta?.durationMs != null ? `${meta.durationMs}ms` : ''}
          </span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <span className="text-[11px] text-red-400/80 font-mono break-words line-clamp-2">
            {meta?.errorMsg ?? 'Embedding failed'}
          </span>
        </div>
      )}
    </div>
  )
}

export default memo(EmbeddingNode, (prev, next) =>
  (prev.data as NodeData).runStatus === (next.data as NodeData).runStatus &&
  (prev.data as NodeData).runOutput === (next.data as NodeData).runOutput &&
  (prev.data as NodeData).runMeta   === (next.data as NodeData).runMeta   &&
  (prev.data as NodeData).config    === (next.data as NodeData).config    &&
  prev.selected === next.selected
)
