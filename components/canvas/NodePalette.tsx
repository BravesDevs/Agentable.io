'use client'

import { useState } from 'react'
import { useStore, type AgentNodeKind } from '@/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDraggable } from '@/hooks/useDraggable'

interface PaletteItem {
  kind:  AgentNodeKind
  label: string
  dot:   string
  hover: string
  icon:  React.ReactNode
}

const ICON_CLS = 'w-4 h-4 stroke-current shrink-0'

const PALETTE: PaletteItem[] = [
  {
    kind: 'input',
    label: 'Input',
    dot:   'bg-indigo-400',
    hover: 'group-hover:border-indigo-400/40 group-hover:bg-indigo-400/5',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 10h6M7 14h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    kind: 'prompt',
    label: 'Prompt',
    dot:   'bg-purple-400',
    hover: 'group-hover:border-purple-400/40 group-hover:bg-purple-400/5',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <path d="M4 5h16M4 10h12M4 15h16M4 20h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    kind: 'llm',
    label: 'LLM',
    dot:   'bg-blue-400',
    hover: 'group-hover:border-blue-400/40 group-hover:bg-blue-400/5',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    kind: 'tool',
    label: 'Tool',
    dot:   'bg-amber-400',
    hover: 'group-hover:border-amber-400/40 group-hover:bg-amber-400/5',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <path d="M14.7 6.3a4 4 0 1 0 3 3l-3.4 3.4-3-3 3.4-3.4z" strokeLinejoin="round" />
        <path d="M11.3 12.7L4 20l1.5 1.5 7.3-7.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    kind: 'memory',
    label: 'Memory',
    dot:   'bg-teal-400',
    hover: 'group-hover:border-teal-400/40 group-hover:bg-teal-400/5',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
        <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </svg>
    ),
  },
  {
    kind: 'output',
    label: 'Output',
    dot:   'bg-green-400',
    hover: 'group-hover:border-green-400/40 group-hover:bg-green-400/5',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <path d="M5 12h11M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="2" y="4" width="3" height="16" rx="1" />
      </svg>
    ),
  },
]

export const PALETTE_DRAG_MIME = 'application/agentcraft-node'

export default function NodePalette() {
  const runId         = useStore((s) => s.runId)
  const hasRunState   = useStore((s) =>
    s.nodes.some((n) =>
      (n.data.runHistory && n.data.runHistory.length > 0) ||
      n.data.runOutput !== undefined ||
      (n.data.runStatus && n.data.runStatus !== 'idle')
    )
  )
  const clearRunState = useStore((s) => s.clearRunState)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isRunning = runId !== null
  const disabled  = isRunning || !hasRunState
  const tooltip   = isRunning
    ? 'A flow is running — stop it before clearing memory'
    : !hasRunState
      ? 'Nothing to clear'
      : 'Clear all run state (preserves graph and node configs)'

  const { ref: paletteRef, style: paletteStyle, initialized, dragging, handleProps } = useDraggable(
    () => ({ x: 16, y: Math.max(80, Math.floor((typeof window !== 'undefined' ? window.innerHeight : 720) / 2 - 220)) }),
    'agentcraft:node-palette-pos',
  )

  return (
    <aside
      ref={paletteRef}
      style={paletteStyle}
      className={`absolute z-30 flex flex-col gap-1.5 p-2 rounded-xl bg-[#0f0f11]/90 border border-white/8 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${initialized ? '' : 'left-3 top-1/2 -translate-y-1/2'} ${dragging ? 'select-none' : ''}`}
    >
      <div
        {...handleProps}
        className={`flex items-center justify-between px-1.5 pt-0.5 pb-1.5 -mx-0.5 cursor-grab active:cursor-grabbing select-none rounded-md ${dragging ? 'bg-white/5' : 'hover:bg-white/3'}`}
        title="Drag to move"
      >
        <span className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">Palette</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
          <circle cx="9" cy="6"  r="1" /><circle cx="15" cy="6"  r="1" />
          <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" />
        </svg>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setConfirmOpen(true)}
        title={tooltip}
        className="group flex items-center gap-2 w-32 px-2.5 py-2 rounded-lg border border-white/8 bg-white/2 text-left transition-colors enabled:hover:border-rose-400/40 enabled:hover:bg-rose-400/5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        <span className="text-white/60 group-enabled:group-hover:text-white/90 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
            <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-xs font-medium text-white/70 group-enabled:group-hover:text-white/95 transition-colors">
          Clear Memory
        </span>
      </button>

      <div className="h-px bg-white/8 mx-1" />

      <div className="text-[9px] font-semibold tracking-widest text-white/30 uppercase px-1.5 pb-1">
        Nodes
      </div>
      {PALETTE.map((item) => (
        <button
          key={item.kind}
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(PALETTE_DRAG_MIME, item.kind)
            e.dataTransfer.effectAllowed = 'move'
          }}
          className={`group flex items-center gap-2 w-32 px-2.5 py-2 rounded-lg border border-white/8 bg-white/2 text-left cursor-grab active:cursor-grabbing transition-colors ${item.hover}`}
          title={`Drag to add ${item.label} node`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
          <span className="text-white/60 group-hover:text-white/90 transition-colors">{item.icon}</span>
          <span className="text-xs font-medium text-white/70 group-hover:text-white/95 transition-colors">
            {item.label}
          </span>
        </button>
      ))}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md bg-[#0f0f11] border border-white/10 p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-white/8">
            <DialogTitle className="text-sm font-semibold text-white/90">Clear memory?</DialogTitle>
            <DialogDescription className="text-[11px] text-white/40 mt-0.5 leading-relaxed">
              Drops the current run, every node&apos;s output, run history, and any accumulated context.
              Your graph and node configurations are preserved. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-6 py-4 border-t border-white/8 gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-white/10 text-black/80 hover:bg-white/5 hover:text-white/70"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-400/30 hover:border-rose-400/50"
              onClick={() => {
                clearRunState()
                setConfirmOpen(false)
              }}
            >
              Clear Memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
