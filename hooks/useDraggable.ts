'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface DraggablePos { x: number; y: number }

export function useDraggable(
  initial: () => DraggablePos,
  storageKey?: string,
) {
  const [pos, setPos] = useState<DraggablePos | null>(null)
  const ref          = useRef<HTMLDivElement | null>(null)
  const drag         = useRef<{ ox: number; oy: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let next: DraggablePos | null = null
    if (storageKey && typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(storageKey)
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<DraggablePos>
          if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            next = { x: parsed.x, y: parsed.y }
          }
        }
      } catch {}
    }
    if (next === null) next = initial()
    // Initial position must be applied as a side-effect because it depends on
    // window/sessionStorage which are unavailable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!storageKey || pos === null || typeof window === 'undefined') return
    try { sessionStorage.setItem(storageKey, JSON.stringify(pos)) } catch {}
  }, [pos, storageKey])

  const clamp = useCallback((x: number, y: number): DraggablePos => {
    const el = ref.current
    if (!el) return { x, y }
    const parent = (el.offsetParent as HTMLElement | null)
    const w = el.offsetWidth
    const h = el.offsetHeight
    const maxX = (parent?.clientWidth ?? window.innerWidth) - w - 4
    const maxY = (parent?.clientHeight ?? window.innerHeight) - h - 4
    return {
      x: Math.max(4, Math.min(maxX, x)),
      y: Math.max(4, Math.min(maxY, y)),
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    drag.current = { ox: e.clientX - rect.left, oy: e.clientY - rect.top }
    setDragging(true)
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const el = ref.current
    if (!el) return
    const parent = (el.offsetParent as HTMLElement | null)
    const parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 }
    const x = e.clientX - d.ox - parentRect.left
    const y = e.clientY - d.oy - parentRect.top
    setPos(clamp(x, y))
  }, [clamp])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
  }, [])

  return {
    ref,
    pos,
    setPos,
    dragging,
    initialized: pos !== null,
    style: pos ? { left: pos.x, top: pos.y, transform: 'none' as const } : undefined,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  }
}
