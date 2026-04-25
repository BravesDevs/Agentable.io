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

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  text:  { label: 'Text',  cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' },
  file:  { label: 'File',  cls: 'bg-amber-500/15  text-amber-300  border-amber-500/25'  },
  image: { label: 'Image', cls: 'bg-pink-500/15   text-pink-300   border-pink-500/25'   },
  json:  { label: 'JSON',  cls: 'bg-green-500/15  text-green-300  border-green-500/25'  },
  url:   { label: 'URL',   cls: 'bg-blue-500/15   text-blue-300   border-blue-500/25'   },
}

const TYPE_HINT: Record<string, string> = {
  text:  'Plain text / prompt',
  file:  'Document upload',
  image: 'Vision model input',
  json:  'Structured JSON',
  url:   'Enter a URL',
}

function InputNode({ data, selected }: NodeProps) {
  const d         = data as NodeData
  const status    = d.runStatus ?? 'idle'
  const border    = statusBorder[status]
  const selRing   = selected ? 'ring-1 ring-indigo-400/60' : ''
  const inputType = (d.config?.inputType as string | undefined) ?? 'text'
  const badge     = TYPE_BADGE[inputType] ?? TYPE_BADGE.text
  const hint      = TYPE_HINT[inputType]  ?? 'Flow input'

  // Show allowed extensions/formats as a compact hint
  const exts = (
    (d.config?.allowedExtensions as string[] | undefined) ??
    (d.config?.allowedFormats    as string[] | undefined) ??
    []
  ).slice(0, 5)

  return (
    <div className={`w-52 px-4 py-3 bg-[#131316] rounded-xl border shadow-lg transition-shadow duration-300 ${border} ${selRing}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-indigo-400" />
        <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">Input</span>
        <span className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded border ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Hint / extensions */}
      {exts.length > 0 ? (
        <p className="text-[10px] text-white/25 font-mono leading-relaxed">
          {exts.join('  ')}
          {(
            (d.config?.allowedExtensions as string[] | undefined) ??
            (d.config?.allowedFormats    as string[] | undefined) ??
            []
          ).length > 5 ? ' …' : ''}
        </p>
      ) : (
        <p className="text-xs text-white/30">{hint}</p>
      )}

      {/* Run output preview */}
      {d.runOutput && (
        <div className="mt-2 bg-black/30 rounded-lg px-2 py-1.5 border border-white/5">
          <p className="text-[10px] text-white/50 font-mono truncate">{d.runOutput}</p>
        </div>
      )}

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
  (prev.data as NodeData).config     === (next.data as NodeData).config     &&
  prev.selected === next.selected
)
