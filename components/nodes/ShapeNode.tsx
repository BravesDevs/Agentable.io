'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'

export type VAlign = 'top' | 'center' | 'bottom'
export type HAlign = 'left' | 'center' | 'right'

interface ShapeData {
  shape:    'rectangle' | 'ellipse'
  color:    string
  text?:    string
  editing?: boolean
  vAlign?:  VAlign
  hAlign?:  HAlign
}

const V_TO_FLEX: Record<VAlign, string> = {
  top:    'flex-start',
  center: 'center',
  bottom: 'flex-end',
}
const H_TO_FLEX: Record<HAlign, string> = {
  left:   'flex-start',
  center: 'center',
  right:  'flex-end',
}
const H_TO_TEXT: Record<HAlign, 'left' | 'center' | 'right'> = {
  left:   'left',
  center: 'center',
  right:  'right',
}

function ShapeNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ShapeData
  const color  = d.color  ?? '#fbbf24'
  const vAlign = d.vAlign ?? 'center'
  const hAlign = d.hAlign ?? 'center'

  const { updateNodeData } = useReactFlow()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(d.text ?? '')
  const taRef                  = useRef<HTMLTextAreaElement>(null)

  // External "open editor" trigger: text tool clicked on this shape, or
  // factory created the shape with editing pre-flagged. We consume the
  // flag once and clear it so we don't re-enter on later renders.
  useEffect(() => {
    if (d.editing) {
      setEditing(true)
      updateNodeData(id, { editing: false })
    }
  }, [d.editing, id, updateNodeData])

  useEffect(() => {
    if (editing) {
      taRef.current?.focus()
      taRef.current?.select()
    }
  }, [editing])

  useEffect(() => { setDraft(d.text ?? '') }, [d.text])

  function commit() {
    setEditing(false)
    if (draft !== (d.text ?? '')) updateNodeData(id, { text: draft })
  }

  return (
    <>
      <NodeResizer
        isVisible={selected && !editing}
        minWidth={40}
        minHeight={40}
        color={color}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <div
        className="w-full h-full flex p-2 select-none"
        onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
        style={{
          border:         `2px solid ${color}`,
          background:     `${color}14`,
          borderRadius:   d.shape === 'ellipse' ? '50%' : 6,
          alignItems:     V_TO_FLEX[vAlign],
          justifyContent: H_TO_FLEX[hAlign],
        }}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDraft(d.text ?? ''); setEditing(false) }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Type…"
            className="w-full h-full bg-transparent border-none outline-none resize-none font-medium leading-snug placeholder:opacity-40"
            style={{ color, fontSize: 14, textAlign: H_TO_TEXT[hAlign] }}
          />
        ) : d.text ? (
          <span
            className="font-medium leading-snug whitespace-pre-wrap break-words"
            style={{ color, fontSize: 14, textAlign: H_TO_TEXT[hAlign] }}
          >
            {d.text}
          </span>
        ) : null}
      </div>
    </>
  )
}

export default memo(ShapeNode, (prev, next) => {
  const a = prev.data as unknown as ShapeData
  const b = next.data as unknown as ShapeData
  return (
    prev.selected === next.selected &&
    a.color    === b.color    &&
    a.shape    === b.shape    &&
    a.text     === b.text     &&
    a.editing  === b.editing  &&
    a.vAlign   === b.vAlign   &&
    a.hAlign   === b.hAlign
  )
})
