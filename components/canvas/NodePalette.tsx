'use client'

import type { AgentNodeKind } from '@/store'

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
  return (
    <aside className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1.5 p-2 rounded-xl bg-[#0f0f11]/90 border border-white/8 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
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
    </aside>
  )
}
