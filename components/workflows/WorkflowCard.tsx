'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface NodeShape { type?: string; data?: { nodeType?: string } }

export interface WorkflowCardProps {
  id:           string
  name:         string
  description?: string
  tags?:        string[]
  createdAt?:   string | Date
  nodeCount?:   number
  /** Node-type counts so the card can render small icon-bands */
  nodeTypes?:   string[]
  variant:      'user' | 'sample'
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  input:     { label: 'Input',     className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  prompt:    { label: 'Prompt',    className: 'bg-amber-500/15  text-amber-300  border-amber-500/30'  },
  llm:       { label: 'LLM',       className: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  tool:      { label: 'Tool',      className: 'bg-cyan-500/15   text-cyan-300   border-cyan-500/30'   },
  memory:    { label: 'Memory',    className: 'bg-pink-500/15   text-pink-300   border-pink-500/30'   },
  database:  { label: 'Database',  className: 'bg-slate-500/15  text-slate-300  border-slate-500/30'  },
  embedding: { label: 'Embedding', className: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  vector:    { label: 'Vector',    className: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' },
  output:    { label: 'Output',    className: 'bg-rose-500/15   text-rose-300   border-rose-500/30'   },
}

const RUNNABLE_TYPES = new Set(Object.keys(TYPE_BADGE))

function formatDate(d?: string | Date): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function WorkflowCard(props: WorkflowCardProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<'idle' | 'opening' | 'cloning' | 'deleting'>('idle')

  const usedTypes = (props.nodeTypes ?? [])
    .filter((t) => RUNNABLE_TYPES.has(t))
    // de-dupe while preserving order
    .filter((t, i, a) => a.indexOf(t) === i)

  async function handleOpen() {
    setBusy('opening')
    router.push(`/canvas?flowId=${props.id}`)
  }

  async function handleClone() {
    setBusy('cloning')
    try {
      const r = await fetch(`/api/v1/workflows/clone-sample`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sampleId: props.id }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const flow = await r.json() as { id: string; name: string }
      toast.success('Template added', { description: flow.name })
      router.push(`/canvas?flowId=${flow.id}`)
    } catch (err) {
      console.error(err)
      toast.error('Could not clone template')
      setBusy('idle')
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${props.name}"? This cannot be undone.`)) return
    setBusy('deleting')
    try {
      const r = await fetch(`/api/v1/flows/${props.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      toast.success('Workflow deleted')
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('Could not delete workflow')
      setBusy('idle')
    }
  }

  const isSample = props.variant === 'sample'

  return (
    <div
      className={`group relative flex flex-col rounded-xl border p-5 transition-all ${
        isSample
          ? 'border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent hover:border-indigo-400/50'
          : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'
      }`}
    >
      {isSample && (
        <span className="absolute -top-2 left-4 rounded-full bg-indigo-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-md">
          Template
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-white">{props.name}</h3>
          {props.description && (
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-white/55">
              {props.description}
            </p>
          )}
        </div>
      </div>

      {usedTypes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {usedTypes.map((t) => {
            const meta = TYPE_BADGE[t]
            return (
              <span
                key={t}
                className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${meta.className}`}
              >
                {meta.label}
              </span>
            )
          })}
        </div>
      )}

      {props.tags && props.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {props.tags.map((t) => (
            <span
              key={t}
              className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10.5px] text-white/55"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-white/40">
        <span>
          {typeof props.nodeCount === 'number'
            ? `${props.nodeCount} ${props.nodeCount === 1 ? 'node' : 'nodes'}`
            : ' '}
        </span>
        <span>{formatDate(props.createdAt)}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {isSample ? (
          <Button
            size="sm"
            onClick={handleClone}
            disabled={busy !== 'idle'}
            className="h-8 flex-1 bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {busy === 'cloning' ? 'Adding…' : 'Use this template'}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              onClick={handleOpen}
              disabled={busy !== 'idle'}
              className="h-8 flex-1 bg-[#0969da] text-white hover:bg-[#0860ca] disabled:opacity-50"
            >
              {busy === 'opening' ? 'Opening…' : 'Open'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={busy !== 'idle'}
              className="h-8 border-white/10 bg-transparent text-white/60 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
            >
              {busy === 'deleting' ? '…' : 'Delete'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export type { NodeShape }
