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

const indexLabel: Record<string, string> = {
  flat:    'FLAT',
  hnsw:    'HNSW',
  ivfflat: 'IVF',
}

const modeColor: Record<string, string> = {
  index: 'bg-amber-500/15  text-amber-300  border-amber-500/20',
  query: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  auto:  'bg-violet-500/15 text-violet-300 border-violet-500/20',
}

function VectorNode({ data, selected }: NodeProps) {
  const d         = data as NodeData
  const status    = d.runStatus ?? 'idle'
  const border    = statusBorder[status]
  const selRing   = selected ? 'ring-1 ring-violet-400/60' : ''
  const storeName = (d.config?.storeName as string | undefined) ?? 'default'
  const indexType = (d.config?.indexType as string | undefined) ?? 'flat'
  const metric    = (d.config?.metric    as string | undefined) ?? 'cosine'
  const topK      = (d.config?.topK      as number | undefined) ?? 5
  const mode      = (d.config?.mode      as string | undefined) ?? 'auto'
  const meta      = d.runMeta
  const runMode   = meta?.mode ?? mode

  return (
    <div className={`w-60 px-4 py-3 bg-[#131316] rounded-xl border shadow-lg transition-shadow duration-300 ${border} ${selRing}`}>
      <Handle type="target" position={Position.Top}    id="vectors-in"  data-port-type="any"    className="!bg-fuchsia-400 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="context-out" data-port-type="string" className="!bg-violet-400 !w-3 !h-3 !left-1/3" />
      <Handle type="source" position={Position.Bottom} id="json-out"    data-port-type="json"   className="!bg-cyan-400  !w-3 !h-3 !left-2/3" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-violet-400" />
        <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">Vector</span>
        <span className={`ml-auto text-[9px] font-bold rounded px-1.5 py-0.5 border uppercase tracking-wide ${modeColor[runMode] ?? modeColor.auto}`}>
          {runMode}
        </span>
      </div>

      {/* Store + index */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] text-white/40 font-mono truncate">{storeName}</p>
        <span className="text-[10px] font-semibold tracking-wider text-white/30 uppercase shrink-0">
          {indexLabel[indexType] ?? indexType.toUpperCase()} · {metric}
        </span>
      </div>

      {/* Hyperparams */}
      <div className="bg-black/40 rounded-lg px-2 py-1.5 border border-white/5 mb-2">
        <p className="text-[10px] text-white/40 font-mono">
          top_k={topK}
          {(d.config?.topP as number | undefined) ? ` · top_p=${d.config?.topP}` : ''}
        </p>
      </div>

      {/* Running */}
      {status === 'running' && (
        <div className="flex items-center gap-2 py-1 px-2 rounded-lg bg-violet-500/8 border border-violet-500/15">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-[11px] text-violet-300/70 font-mono truncate">
            {runMode === 'index' ? 'Indexing…' : 'Querying…'}
          </span>
        </div>
      )}

      {/* Done */}
      {status === 'done' && (
        <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/4 border border-white/6">
          <span className="text-[11px] font-mono text-violet-300">
            {(meta?.vectorCount ?? 0)} {runMode === 'index' ? 'stored' : 'matched'}
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
            {meta?.errorMsg ?? 'Vector op failed'}
          </span>
        </div>
      )}
    </div>
  )
}

export default memo(VectorNode, (prev, next) =>
  (prev.data as NodeData).runStatus === (next.data as NodeData).runStatus &&
  (prev.data as NodeData).runOutput === (next.data as NodeData).runOutput &&
  (prev.data as NodeData).runMeta   === (next.data as NodeData).runMeta   &&
  (prev.data as NodeData).config    === (next.data as NodeData).config    &&
  prev.selected === next.selected
)
