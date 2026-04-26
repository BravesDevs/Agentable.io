'use client'

import { useShallow } from 'zustand/react/shallow'
import { useStore, useGraphActions, type DrawingTool } from '@/store'
import type { VAlign, HAlign } from '@/components/nodes/ShapeNode'

const ICON_CLS = 'w-4 h-4 stroke-current'

interface ToolDef {
  id:    DrawingTool
  label: string
  icon:  React.ReactNode
}

const TOOLS: ToolDef[] = [
  {
    id: 'select',
    label: 'Select / move',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <path d="M5 3l14 8-6 1-1 6-7-15z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <rect x="3" y="5" width="18" height="14" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <ellipse cx="12" cy="12" rx="9" ry="6" />
      </svg>
    ),
  },
  {
    id: 'pen',
    label: 'Freehand pen',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" strokeLinejoin="round" />
        <path d="M14 6l3 3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={ICON_CLS}>
        <path d="M5 6V4h14v2M12 4v16M9 20h6" strokeLinecap="round" />
      </svg>
    ),
  },
]

const PALETTE_COLORS = [
  '#fbbf24', // amber
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#34d399', // emerald
  '#f87171', // red
  '#ffffff', // white
]

const V_ALIGNS: VAlign[] = ['top', 'center', 'bottom']
const H_ALIGNS: HAlign[] = ['left', 'center', 'right']

export default function DrawingDock() {
  const { activeTool, drawingColor, setActiveTool, setDrawingColor } = useStore(useShallow((s) => ({
    activeTool:      s.activeTool,
    drawingColor:    s.drawingColor,
    setActiveTool:   s.setActiveTool,
    setDrawingColor: s.setDrawingColor,
  })))

  // Selected shape (if any) — tracked via React Flow's `selected` flag on nodes.
  // useShallow on the projected object keeps re-renders limited to alignment changes.
  const selectedShape = useStore(useShallow((s) => {
    const sel = s.nodes.find((n) => n.selected && n.data.nodeType === 'shape')
    if (!sel) return null
    return {
      id:     sel.id,
      vAlign: ((sel.data as { vAlign?: VAlign }).vAlign ?? 'center') as VAlign,
      hAlign: ((sel.data as { hAlign?: HAlign }).hAlign ?? 'center') as HAlign,
    }
  }))

  const { updateNodeData } = useGraphActions()

  function applyAlignment(v: VAlign, h: HAlign) {
    if (!selectedShape) return
    updateNodeData(selectedShape.id, { vAlign: v, hAlign: h })
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1 p-1.5 rounded-xl bg-[#0f0f11]/90 border border-white/8 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        {TOOLS.map((tool) => {
          const active = activeTool === tool.id
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              title={tool.label}
              className={`relative w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
                active
                  ? 'border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]'
                  : 'border-transparent text-white/55 hover:text-white/90 hover:bg-white/5'
              }`}
            >
              {tool.icon}
              {active && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#00ff88]" />
              )}
            </button>
          )
        })}

        <span className="w-px h-6 bg-white/10 mx-1" />

        <div className="flex items-center gap-1 pr-1">
          {PALETTE_COLORS.map((c) => {
            const active = drawingColor.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                type="button"
                onClick={() => setDrawingColor(c)}
                title={c}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  active ? 'border-white/80 scale-110' : 'border-white/15 hover:border-white/40'
                }`}
                style={{ backgroundColor: c }}
              />
            )
          })}
        </div>

        {activeTool !== 'select' && (
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            className="ml-1 px-2 h-7 text-[10px] font-semibold tracking-wide uppercase rounded border border-white/10 bg-white/4 text-white/50 hover:text-white/90 hover:bg-white/8"
            title="Press Esc to exit drawing"
          >
            Esc
          </button>
        )}
      </div>

      {selectedShape && (
        <div className="flex items-center gap-2 p-1.5 pr-2 rounded-xl bg-[#0f0f11]/90 border border-white/8 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          <span className="pl-1 text-[10px] font-semibold tracking-wide uppercase text-white/40">Align</span>
          <div className="grid grid-cols-3 grid-rows-3 gap-0.5">
            {V_ALIGNS.map((v) => (
              H_ALIGNS.map((h) => {
                const active = selectedShape.vAlign === v && selectedShape.hAlign === h
                return (
                  <button
                    key={`${v}-${h}`}
                    type="button"
                    onClick={() => applyAlignment(v, h)}
                    title={`${v} · ${h}`}
                    className={`w-5 h-5 flex items-center justify-center rounded border transition-colors ${
                      active
                        ? 'border-[#00ff88]/50 bg-[#00ff88]/15'
                        : 'border-white/10 bg-white/4 hover:border-white/30 hover:bg-white/8'
                    }`}
                  >
                    <AlignDot v={v} h={h} active={active} />
                  </button>
                )
              })
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Tiny indicator inside each cell, positioned to mirror text placement.
function AlignDot({ v, h, active }: { v: VAlign; h: HAlign; active: boolean }) {
  const justify = h === 'left' ? 'flex-start' : h === 'right' ? 'flex-end' : 'center'
  const align   = v === 'top'  ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center'
  return (
    <div className="w-full h-full flex p-[2px]" style={{ alignItems: align, justifyContent: justify }}>
      <span
        className="block rounded-sm"
        style={{
          width: 6, height: 1.5,
          background: active ? '#00ff88' : 'rgba(255,255,255,0.55)',
        }}
      />
    </div>
  )
}
