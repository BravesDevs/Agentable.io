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

function fmt(ms?: number) {
  if (!ms) return ''
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function isJsonOutput(str: string): boolean {
  const s = str.trimStart()
  return s.startsWith('{') || s.startsWith('[')
}

function LLMNode({ data, selected }: NodeProps) {
  const d              = data as NodeData
  const status         = d.runStatus ?? 'idle'
  const border         = statusBorder[status]
  const selRing        = selected ? 'ring-1 ring-blue-400/60' : ''
  const model          = (d.config?.model as string | undefined) ?? 'claude-sonnet-4-6'
  const meta           = d.runMeta
  const isStructured   = Boolean(d.config?.structuredOutput)
  const isThinking     = status === 'running' && !d.runOutput
  const isStructuring  = status === 'running' && isStructured && Boolean(d.runOutput)
  const outputIsJson   = d.runOutput ? isJsonOutput(d.runOutput) : false

  // Running label shown in footer
  const runningLabel = isStructured ? 'Structuring…' : 'Streaming'

  return (
    <div className={`w-56 px-4 py-3 bg-[#131316] rounded-xl border shadow-lg transition-shadow duration-300 ${border} ${selRing}`}>
      {/* Handles */}
      <Handle type="target" position={Position.Top}    id="messages-in"  data-port-type="messages" className="!bg-purple-500 !w-3 !h-3 !left-1/3" />
      <Handle type="target" position={Position.Top}    id="system-in"    data-port-type="string"   className="!bg-white/40  !w-3 !h-3 !left-2/3" />
      <Handle type="source" position={Position.Bottom} id="messages-out" data-port-type="messages" className="!bg-purple-500 !w-3 !h-3 !left-1/3" />
      <Handle type="source" position={Position.Bottom} id="text-out"     data-port-type="string"   className="!bg-blue-400  !w-3 !h-3 !left-2/3" />

      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">LLM</span>
          {isStructured && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-violet-500/15 text-violet-300 border-violet-500/25 uppercase tracking-wide">
              JSON
            </span>
          )}
        </div>
        {status === 'running' && (
          <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse shadow-[0_0_6px_#00ff88]" />
        )}
        {status === 'done' && (
          <span className="text-[10px] text-[#00ff88]/70 font-mono">{fmt(meta?.durationMs)}</span>
        )}
        {status === 'error' && (
          <span className="text-[10px] text-red-400 font-mono">Error</span>
        )}
      </div>

      {/* Model name */}
      <p className="text-[11px] text-white/30 mb-2 truncate font-mono">{model}</p>

      {/* Thinking state — no output yet */}
      {isThinking && (
        <div className="flex items-center gap-2 py-1">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-bounce [animation-delay:120ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-bounce [animation-delay:240ms]" />
          </div>
          <span className="text-[11px] text-[#00ff88]/60 font-mono">
            {isStructured ? 'Generating schema…' : 'Thinking…'}
          </span>
        </div>
      )}

      {/* Output block */}
      {d.runOutput && (
        <div className={`rounded-lg max-h-28 overflow-y-auto border ${
          outputIsJson
            ? 'bg-violet-950/30 border-violet-500/15 px-2.5 py-2'
            : 'bg-black/40 border-white/5 px-3 py-2'
        }`}>
          <span className={`font-mono text-xs break-words whitespace-pre-wrap leading-relaxed ${
            outputIsJson ? 'text-violet-200/70' : 'text-white/70'
          }`}>
            {d.runOutput}
          </span>
          {/* Cursor for text streaming; spinner ring for structured */}
          {status === 'running' && !isStructured && (
            <span className="inline-block w-1 h-3 bg-[#00ff88] animate-pulse ml-0.5 align-text-bottom" />
          )}
          {isStructuring && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse ml-1 align-middle" />
          )}
        </div>
      )}

      {/* Error output */}
      {status === 'error' && !d.runOutput && (
        <div className="bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
          <p className="text-xs text-red-400 font-mono">{meta?.httpError ?? 'Node failed'}</p>
        </div>
      )}

      {/* Footer stats */}
      {(status === 'done' || (status === 'running' && d.runOutput)) && (
        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-white/5">
          <span className="text-[10px] text-white/20 font-mono">
            {status === 'running' ? runningLabel : (isStructured ? 'Structured' : 'Generated')}
          </span>
          <span className="text-[10px] text-white/30 font-mono tabular-nums">
            {d.runOutput?.length ?? 0} chars
          </span>
        </div>
      )}
    </div>
  )
}

export default memo(LLMNode, (prev, next) =>
  (prev.data as NodeData).runStatus === (next.data as NodeData).runStatus &&
  (prev.data as NodeData).runOutput  === (next.data as NodeData).runOutput  &&
  (prev.data as NodeData).runMeta    === (next.data as NodeData).runMeta    &&
  (prev.data as NodeData).config     === (next.data as NodeData).config     &&
  prev.selected === next.selected
)
