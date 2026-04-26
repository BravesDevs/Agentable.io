'use client'

import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'

interface Point { x: number; y: number }

interface DrawingData {
  points:      Point[]   // coordinates relative to the node's bounding box
  color:       string
  strokeWidth: number
  viewBoxW:    number
  viewBoxH:    number
}

function pointsToPath(points: Point[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return [`M ${first.x} ${first.y}`, ...rest.map((p) => `L ${p.x} ${p.y}`)].join(' ')
}

function DrawingNode({ data, selected }: NodeProps) {
  const d = data as unknown as DrawingData
  const path = pointsToPath(d.points ?? [])

  return (
    <div
      className="w-full h-full"
      style={{
        border:       selected ? `1px dashed ${d.color}80` : '1px dashed transparent',
        borderRadius: 4,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${d.viewBoxW || 1} ${d.viewBoxH || 1}`}
        preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <path
          d={path}
          fill="none"
          stroke={d.color ?? '#fbbf24'}
          strokeWidth={d.strokeWidth ?? 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

export default memo(DrawingNode, (prev, next) =>
  prev.selected === next.selected &&
  (prev.data as unknown as DrawingData).points === (next.data as unknown as DrawingData).points &&
  (prev.data as unknown as DrawingData).color  === (next.data as unknown as DrawingData).color
)
