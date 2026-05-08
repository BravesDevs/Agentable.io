'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog as RadixDialog } from 'radix-ui'
import { XIcon } from '@phosphor-icons/react'

import type { AlgorithmDoc } from '@/constants/algorithm-docs'
import { getAlgorithmDoc } from '@/constants/algorithm-docs'

import '@/styles/modal.css'

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Box { x: number; y: number; w: number; h: number }

const MIN_W = 380
const MIN_H = 320
const MARGIN = 16
const DEFAULT_W = 680
const DEFAULT_H = 560

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function initialBox(): Box {
  if (typeof window === 'undefined') return { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H }
  const w = Math.min(DEFAULT_W, window.innerWidth  - MARGIN * 2)
  const h = Math.min(DEFAULT_H, window.innerHeight - MARGIN * 2)
  return {
    x: Math.max(MARGIN, (window.innerWidth  - w) / 2),
    y: Math.max(MARGIN, (window.innerHeight - h) / 2),
    w, h,
  }
}

// ─── Algorithm-specific modal ──────────────────────────────────────────────

export function AlgorithmInfoModal({
  open,
  onOpenChange,
  algorithmKey,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  algorithmKey: string
}) {
  const doc = getAlgorithmDoc(algorithmKey)

  return (
    <InfoModal
      open={open}
      onOpenChange={onOpenChange}
      title={doc?.name ?? 'Algorithm'}
      subtitle={doc?.tagline}
    >
      {doc ? <AlgorithmDocBody doc={doc} /> : <UnknownAlgorithmBody algorithmKey={algorithmKey} />}
    </InfoModal>
  )
}

// ─── Generic resizable info modal ─────────────────────────────────────────

export function InfoModal({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open:         boolean
  onOpenChange: (v: boolean) => void
  title:        string
  subtitle?:    string
  children:     React.ReactNode
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {open && (
        <ResizableShell title={title} subtitle={subtitle}>
          {children}
        </ResizableShell>
      )}
    </RadixDialog.Root>
  )
}

// Mounted only while the dialog is open — gives us a fresh `box` on every
// open without a setState-in-effect, and tears down listeners on close.
function ResizableShell({
  title,
  subtitle,
  children,
}: {
  title:     string
  subtitle?: string
  children:  React.ReactNode
}) {
  const [box, setBox] = useState<Box>(initialBox)
  const dragRef       = useRef<{ dir: ResizeDir; start: Box; mx: number; my: number } | null>(null)

  // Keep the modal inside the viewport on window resize.
  useEffect(() => {
    const onWinResize = () => {
      setBox((b) => ({
        x: clamp(b.x, MARGIN, Math.max(MARGIN, window.innerWidth  - b.w - MARGIN)),
        y: clamp(b.y, MARGIN, Math.max(MARGIN, window.innerHeight - b.h - MARGIN)),
        w: clamp(b.w, MIN_W, window.innerWidth  - MARGIN * 2),
        h: clamp(b.h, MIN_H, window.innerHeight - MARGIN * 2),
      }))
    }
    window.addEventListener('resize', onWinResize)
    return () => window.removeEventListener('resize', onWinResize)
  }, [])

  const onResizePointerDown = useCallback((dir: ResizeDir) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)

    dragRef.current = { dir, start: { ...box }, mx: e.clientX, my: e.clientY }
    document.body.classList.add('am-resizing')

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = ev.clientX - drag.mx
      const dy = ev.clientY - drag.my
      const s  = drag.start
      const next: Box = { ...s }

      const maxRight  = window.innerWidth  - MARGIN
      const maxBottom = window.innerHeight - MARGIN

      if (drag.dir.includes('e')) {
        next.w = clamp(s.w + dx, MIN_W, maxRight - s.x)
      }
      if (drag.dir.includes('w')) {
        const newW = clamp(s.w - dx, MIN_W, s.w + (s.x - MARGIN))
        next.x = s.x + (s.w - newW)
        next.w = newW
      }
      if (drag.dir.includes('s')) {
        next.h = clamp(s.h + dy, MIN_H, maxBottom - s.y)
      }
      if (drag.dir.includes('n')) {
        const newH = clamp(s.h - dy, MIN_H, s.h + (s.y - MARGIN))
        next.y = s.y + (s.h - newH)
        next.h = newH
      }

      setBox(next)
    }

    const onUp = () => {
      dragRef.current = null
      document.body.classList.remove('am-resizing')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    window.addEventListener('pointercancel', onUp)
  }, [box])

  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay
        className="fixed inset-0 z-50 bg-black/40 supports-[backdrop-filter]:backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
      />
      <RadixDialog.Content
        aria-describedby={subtitle ? 'am-modal-subtitle' : undefined}
        className="am-modal"
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/8 shrink-0 bg-[#131316]">
          <div className="min-w-0">
            <RadixDialog.Title className="text-[13px] font-semibold tracking-wide text-white/90 truncate">
              {title}
            </RadixDialog.Title>
            {subtitle && (
              <RadixDialog.Description
                id="am-modal-subtitle"
                className="mt-1 text-[11px] text-white/50 leading-relaxed"
              >
                {subtitle}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-white/50 hover:text-white hover:bg-white/8 transition-colors focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          >
            <XIcon size={14} weight="bold" />
          </RadixDialog.Close>
        </div>

        {/* Scrollable body */}
        <div className="am-modal__body px-5 py-4">
          {children}
        </div>

        {/* 4-axis resize handles */}
        {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeDir[]).map((d) => (
          <div
            key={d}
            role="separator"
            aria-orientation={d === 'n' || d === 's' ? 'horizontal' : 'vertical'}
            className={`am-resize am-resize--${d}`}
            onPointerDown={onResizePointerDown(d)}
          />
        ))}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
}

// ─── Body renderers ───────────────────────────────────────────────────────

function AlgorithmDocBody({ doc }: { doc: AlgorithmDoc }) {
  return (
    <div className="space-y-6">
      {/* Complexity strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <ComplexityCard label="Build"  value={doc.complexity.build} />
        <ComplexityCard label="Query"  value={doc.complexity.query} />
        <ComplexityCard label="Memory" value={doc.complexity.memory} />
      </div>

      {/* Diagram */}
      <Section title="Diagram">
        <pre className="am-diagram">{doc.diagram}</pre>
      </Section>

      {/* Use cases */}
      <Section title="Use Cases">
        <ul className="space-y-1.5">
          {doc.useCases.map((u, i) => (
            <li key={i} className="flex gap-2 text-[12px] text-white/75 leading-relaxed">
              <span className="text-violet-400 shrink-0 mt-0.5">▸</span>
              <span>{u}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Formulas */}
      <Section title="Math">
        <div className="space-y-2.5">
          {doc.formulas.map((f, i) => (
            <div key={i} className="am-formula">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
                {f.label}
              </div>
              <div className="am-formula__latex">{f.latex}</div>
              <div className="am-formula__plain">{f.plain}</div>
              {f.note && <div className="am-formula__note">{f.note}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Tracing */}
      <Section title="Execution Trace">
        <ol className="space-y-2">
          {doc.tracing.map((step, i) => (
            <li key={i} className="flex gap-3 text-[12px] text-white/75 leading-relaxed">
              <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/15 text-violet-300 text-[10px] font-mono border border-violet-500/25">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )
}

function UnknownAlgorithmBody({ algorithmKey }: { algorithmKey: string }) {
  return (
    <div className="text-[12px] text-white/60 leading-relaxed">
      No reference docs found for <span className="font-mono text-violet-300">{algorithmKey}</span>.
      Add an entry to <span className="font-mono text-violet-300">constants/algorithm-docs.ts</span> to
      surface diagrams, math, and tracing for this algorithm.
    </div>
  )
}

// ─── Small subcomponents ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-white/45 mb-2">
        {title}
      </h3>
      {children}
    </section>
  )
}

function ComplexityCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-0.5 text-[11px] font-mono text-violet-300/90 leading-snug break-words">
        {value}
      </div>
    </div>
  )
}
