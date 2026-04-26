'use client'

import { memo } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { Arrowheads, LineStyle } from '@/lib/nodeFactory'

interface ArrowData {
  color:      string
  thickness:  number
  arrowheads: Arrowheads
  lineStyle:  LineStyle
  curved:     boolean
  dirX:       1 | -1
  dirY:       1 | -1
}

// Stroke dash patterns. We scale the second value with thickness so dashed
// lines remain visually distinct as the user thickens them.
function dashFor(style: LineStyle, thickness: number): string | undefined {
  if (style === 'solid')  return undefined
  if (style === 'dashed') return `${thickness * 4} ${thickness * 3}`
  return `${thickness} ${thickness * 2.5}` // dotted
}

function ArrowNode({ id, data, selected, width, height }: NodeProps) {
  const d         = data as unknown as ArrowData
  const color     = d.color      ?? '#fbbf24'
  const thickness = d.thickness  ?? 2
  const heads     = d.arrowheads ?? 'end'
  const style     = d.lineStyle  ?? 'solid'
  const curved    = d.curved     ?? false
  const dirX      = d.dirX       ?? 1
  const dirY      = d.dirY       ?? 1

  const w = Math.max(1, width  ?? 100)
  const h = Math.max(1, height ?? 100)

  // Inset the endpoints so arrowheads don't get clipped at the box edge.
  // The marker extends by ~markerSize, which scales with thickness.
  const pad = Math.max(8, thickness * 4)
  const sx = dirX === 1 ? pad : w - pad
  const sy = dirY === 1 ? pad : h - pad
  const ex = dirX === 1 ? w - pad : pad
  const ey = dirY === 1 ? h - pad : pad

  // Curved variant: quadratic bezier with a perpendicular offset on the midpoint.
  let pathD: string
  if (curved) {
    const mx  = (sx + ex) / 2
    const my  = (sy + ey) / 2
    const dx  = ex - sx
    const dy  = ey - sy
    const len = Math.hypot(dx, dy) || 1
    const nx  = -dy / len
    const ny  =  dx / len
    const off = Math.min(80, len * 0.28)
    pathD = `M ${sx} ${sy} Q ${mx + nx * off} ${my + ny * off} ${ex} ${ey}`
  } else {
    pathD = `M ${sx} ${sy} L ${ex} ${ey}`
  }

  const dashArray   = dashFor(style, thickness)
  const startMarker = `arr-s-${id}`
  const endMarker   = `arr-e-${id}`
  const markerSize  = Math.max(6, thickness * 3)

  const showStart = heads === 'start' || heads === 'both'
  const showEnd   = heads === 'end'   || heads === 'both'

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={24}
        minHeight={24}
        color={color}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <svg
        width="100%"
        height="100%"
        style={{
          display: 'block',
          overflow: 'visible',
          // Subtle dashed selection outline so users can grab/move the arrow easily
          outline: selected ? `1px dashed ${color}80` : 'none',
          outlineOffset: 2,
        }}
      >
        <defs>
          <marker
            id={endMarker} viewBox="0 0 10 10"
            refX="9" refY="5"
            markerWidth={markerSize} markerHeight={markerSize}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
          <marker
            id={startMarker} viewBox="0 0 10 10"
            refX="1" refY="5"
            markerWidth={markerSize} markerHeight={markerSize}
            orient="auto"
          >
            <path d="M 10 0 L 0 5 L 10 10 z" fill={color} />
          </marker>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(dashArray ? { strokeDasharray: dashArray } : {})}
          markerStart={showStart ? `url(#${startMarker})` : undefined}
          markerEnd={showEnd     ? `url(#${endMarker})`   : undefined}
        />
      </svg>
    </>
  )
}

export default memo(ArrowNode, (prev, next) => {
  const a = prev.data as unknown as ArrowData
  const b = next.data as unknown as ArrowData
  return (
    prev.selected === next.selected &&
    prev.width    === next.width    &&
    prev.height   === next.height   &&
    a.color      === b.color      &&
    a.thickness  === b.thickness  &&
    a.arrowheads === b.arrowheads &&
    a.lineStyle  === b.lineStyle  &&
    a.curved     === b.curved     &&
    a.dirX       === b.dirX       &&
    a.dirY       === b.dirY
  )
})
