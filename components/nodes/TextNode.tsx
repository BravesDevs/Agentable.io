'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'

interface TextData {
  text:     string
  color:    string
  fontSize: number
}

function TextNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as TextData
  const color    = d.color ?? '#ffffff'
  const fontSize = d.fontSize ?? 14

  const { updateNodeData } = useReactFlow()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(d.text ?? '')
  const taRef                  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      taRef.current?.focus()
      taRef.current?.select()
    }
  }, [editing])

  // Keep draft in sync if the node data changes externally
  useEffect(() => { setDraft(d.text ?? '') }, [d.text])

  function commit() {
    setEditing(false)
    if (draft !== d.text) updateNodeData(id, { text: draft })
  }

  return (
    <>
      <NodeResizer
        isVisible={selected && !editing}
        minWidth={60}
        minHeight={28}
        color={color}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <div
        className="w-full h-full flex items-start"
        onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
        style={{ color, fontSize }}
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
            className="w-full h-full bg-transparent border-none outline-none resize-none font-medium leading-snug"
            style={{ color, fontSize }}
            placeholder="Type…"
          />
        ) : (
          <span className="font-medium leading-snug whitespace-pre-wrap break-words w-full">
            {d.text || <span style={{ opacity: 0.4 }}>Double-click to edit</span>}
          </span>
        )}
      </div>
    </>
  )
}

export default memo(TextNode)
