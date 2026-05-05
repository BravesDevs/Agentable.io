'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeData, RunStatus } from '@/store'
import type { DBDriver, DBMode } from '@/types/db'

const statusBorder: Record<RunStatus, string> = {
  idle:    'border-white/10',
  running: 'border-[#00ff88] shadow-[0_0_18px_rgba(0,255,136,0.45)] ring-1 ring-[#00ff88]/30',
  done:    'border-[#00ff88]/50',
  error:   'border-red-500',
}

const driverColor: Record<DBDriver, string> = {
  postgres: 'bg-sky-500/15    text-sky-300    border-sky-500/20',
  mysql:    'bg-orange-500/15 text-orange-300 border-orange-500/20',
  mongodb:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  sqlite:   'bg-slate-500/15  text-slate-300  border-slate-500/20',
}

const driverLabel: Record<DBDriver, string> = {
  postgres: 'PG',
  mysql:    'MYSQL',
  mongodb:  'MONGO',
  sqlite:   'SQLITE',
}

const commandColor = (cmd?: string): string => {
  if (!cmd) return 'text-white/40'
  switch (cmd.toUpperCase()) {
    case 'SELECT': return 'text-sky-300'
    case 'INSERT': return 'text-emerald-300'
    case 'UPDATE': return 'text-amber-300'
    case 'DELETE': return 'text-rose-300'
    default:       return 'text-white/60'
  }
}

interface DBRunMeta {
  rowCount?:    number
  tableCount?:  number
  command?:     string
  durationMs?:  number
  errorMsg?:    string
  truncated?:   boolean
}

function DatabaseNode({ data, selected }: NodeProps) {
  const d         = data as NodeData
  const status    = d.runStatus ?? 'idle'
  const border    = statusBorder[status]
  const selRing   = selected ? 'ring-1 ring-cyan-400/60' : ''
  const driver    = ((d.config?.driver as DBDriver | undefined) ?? 'postgres')
  const mode      = ((d.config?.mode   as DBMode   | undefined) ?? 'query')
  const conn      = (d.config?.connectionString as string | undefined) ?? ''
  const queryRaw  = ((d.config?.query as string | undefined) ?? '').trim()
  const queryPrev = queryRaw.length > 60 ? queryRaw.slice(0, 60) + '…' : queryRaw
  const meta      = (d.runMeta ?? {}) as DBRunMeta

  // Connection display: host (or "no connection")
  let connHost = ''
  try {
    if (conn) connHost = new URL(conn).hostname
  } catch { connHost = conn ? '(invalid url)' : '' }
  const connPrev = connHost.length > 30 ? connHost.slice(0, 30) + '…' : connHost

  return (
    <div className={`w-60 px-4 py-3 bg-[#131316] rounded-xl border shadow-lg transition-shadow duration-300 ${border} ${selRing}`}>
      <Handle type="target" position={Position.Top}    id="trigger-in" data-port-type="any"  className="!bg-white/40 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="json-out"   data-port-type="json" className="!bg-cyan-400 !w-3 !h-3" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400" />
        <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">Database</span>
        <span className={`ml-auto text-[10px] font-bold rounded px-1.5 py-0.5 border ${driverColor[driver]}`}>
          {driverLabel[driver]}
        </span>
      </div>

      {/* Connection + mode */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] text-white/40 font-mono truncate">
          {connPrev || 'No connection'}
        </p>
        <span className="text-[9px] font-semibold tracking-widest text-white/30 uppercase shrink-0">
          {mode === 'introspect' ? 'Schema' : 'Query'}
        </span>
      </div>

      {/* Query / introspect preview */}
      {mode === 'query' ? (
        <div className="bg-black/40 rounded-lg px-2 py-1.5 border border-white/5 mb-2 max-h-12 overflow-hidden">
          <p className="text-[10px] text-white/50 font-mono break-all leading-relaxed">
            {queryPrev || '-- no query --'}
          </p>
        </div>
      ) : (
        <div className="bg-black/40 rounded-lg px-2 py-1.5 border border-white/5 mb-2">
          <p className="text-[10px] text-white/40 font-mono">
            information_schema.columns
          </p>
        </div>
      )}

      {/* Running */}
      {status === 'running' && (
        <div className="flex items-center gap-2 py-1 px-2 rounded-lg bg-cyan-500/8 border border-cyan-500/15">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[11px] text-cyan-300/70 font-mono truncate">
            {mode === 'introspect' ? 'Inspecting…' : 'Executing…'}
          </span>
        </div>
      )}

      {/* Done — schema (table count) or query (rows + duration) */}
      {status === 'done' && (
        <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/4 border border-white/6">
          {mode === 'introspect' ? (
            <span className="text-[11px] font-mono text-cyan-300">
              {(meta.tableCount ?? 0)} table{meta.tableCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span className={`text-[11px] font-mono font-bold ${commandColor(meta.command)}`}>
              {meta.command ?? 'OK'}&nbsp;· {meta.rowCount ?? 0} row{meta.rowCount === 1 ? '' : 's'}
              {meta.truncated && <span className="ml-1 text-amber-400/80">⌁</span>}
            </span>
          )}
          <span className="text-[10px] text-white/20 font-mono">
            {meta.durationMs != null ? `${meta.durationMs}ms` : ''}
          </span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <span className="text-[11px] text-red-400/80 font-mono break-words line-clamp-2">
            {meta.errorMsg ?? 'Query failed'}
          </span>
        </div>
      )}
    </div>
  )
}

export default memo(DatabaseNode, (prev, next) =>
  (prev.data as NodeData).runStatus === (next.data as NodeData).runStatus &&
  (prev.data as NodeData).runOutput === (next.data as NodeData).runOutput &&
  (prev.data as NodeData).runMeta   === (next.data as NodeData).runMeta   &&
  (prev.data as NodeData).config    === (next.data as NodeData).config    &&
  prev.selected === next.selected
)
