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

const methodColor: Record<string, string> = {
  GET:    'bg-green-500/15 text-green-400 border-green-500/20',
  POST:   'bg-blue-500/15  text-blue-400  border-blue-500/20',
  PUT:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
  DELETE: 'bg-red-500/15   text-red-400   border-red-500/20',
}

const httpStatusColor = (code?: number) => {
  if (!code) return 'text-white/40'
  if (code < 300) return 'text-[#00ff88]'
  if (code < 400) return 'text-amber-400'
  return 'text-red-400'
}

function ToolNode({ data, selected }: NodeProps) {
  const d       = data as NodeData
  const status  = d.runStatus ?? 'idle'
  const border  = statusBorder[status]
  const selRing = selected ? 'ring-1 ring-amber-400/60' : ''
  const method  = (d.config?.method as string | undefined) ?? 'GET'
  const url     = (d.config?.url    as string | undefined) ?? ''
  const urlPrev = url.length > 36 ? url.slice(0, 36) + '…' : url
  const meta    = d.runMeta

  // Try to extract a response preview from runOutput (JSON string)
  let responsePreview = ''
  if (d.runOutput) {
    try {
      const parsed = JSON.parse(d.runOutput)
      responsePreview = JSON.stringify(parsed, null, 0).slice(0, 80)
      if (responsePreview.length === 80) responsePreview += '…'
    } catch {
      responsePreview = d.runOutput.slice(0, 80)
    }
  }

  return (
    <div className={`w-56 px-4 py-3 bg-[#131316] rounded-xl border shadow-lg transition-shadow duration-300 ${border} ${selRing}`}>
      <Handle type="target" position={Position.Top}    id="trigger-in" data-port-type="any"  className="!bg-white/40  !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="json-out"   data-port-type="json" className="!bg-amber-400 !w-3 !h-3" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">Tool</span>
        <span className={`ml-auto text-[10px] font-bold rounded px-1.5 py-0.5 border ${methodColor[method] ?? 'bg-white/10 text-white/50 border-white/10'}`}>
          {method}
        </span>
      </div>

      {/* URL preview */}
      <p className="text-[11px] text-white/30 font-mono truncate mb-2">
        {urlPrev || 'No URL set'}
      </p>

      {/* Requesting state */}
      {status === 'running' && (
        <div className="flex items-center gap-2 py-1 px-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] text-amber-300/70 font-mono truncate">Requesting…</span>
        </div>
      )}

      {/* Done — HTTP status + response preview */}
      {status === 'done' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/4 border border-white/6">
            <span className={`text-[11px] font-mono font-bold ${httpStatusColor(meta?.httpStatus)}`}>
              {meta?.httpStatus ? `${meta.httpStatus}` : '200'}&nbsp;OK
            </span>
            <span className="text-[10px] text-white/20 font-mono">
              {meta?.durationMs ? `${meta.durationMs}ms` : ''}
            </span>
          </div>
          {responsePreview && (
            <div className="bg-black/40 rounded-lg px-2 py-1.5 border border-white/5 max-h-16 overflow-hidden">
              <p className="text-[10px] text-white/40 font-mono break-all leading-relaxed">
                {responsePreview}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <span className={`text-[11px] font-mono font-bold ${httpStatusColor(meta?.httpStatus)}`}>
            {meta?.httpStatus ?? '—'}
          </span>
          <span className="text-[11px] text-red-400/80 font-mono truncate">
            {meta?.httpError ?? 'Request failed'}
          </span>
        </div>
      )}
    </div>
  )
}

export default memo(ToolNode, (prev, next) =>
  (prev.data as NodeData).runStatus === (next.data as NodeData).runStatus &&
  (prev.data as NodeData).runOutput  === (next.data as NodeData).runOutput  &&
  (prev.data as NodeData).runMeta    === (next.data as NodeData).runMeta    &&
  (prev.data as NodeData).config     === (next.data as NodeData).config     &&
  prev.selected === next.selected
)
