'use client'

import { useRef, useState } from 'react'
import { Button }    from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea }  from '@/components/ui/textarea'
import { Input }     from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useStore, type AgentNode, type NodeKind } from '@/store'
import { useSSERunner } from '@/hooks/useSSERunner'
import type { FileData } from '@/lib/types'

// ─── Node defaults ────────────────────────────────────────────────────────────

const DEFAULTS: Record<NodeKind, Record<string, unknown>> = {
  input:  { inputType: 'text' },
  prompt: { template: 'You are a helpful assistant.\n\nUser: {{input}}' },
  llm:    { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7, maxTokens: 1000 },
  tool:   { method: 'GET', url: '', headers: '{}', body: '', forwardInput: false },
  memory: { k: 10 },
  output: {},
}

const PORT_MAP: Record<NodeKind, { inputs: AgentNode['data']['inputs']; outputs: AgentNode['data']['outputs'] }> = {
  input:  { inputs: [],                                                outputs: [{ id: 'text-out',    type: 'string'   }] },
  prompt: { inputs: [{ id: 'vars-in',     type: 'any' }],             outputs: [{ id: 'text-out',    type: 'string'   }] },
  llm:    { inputs: [{ id: 'messages-in', type: 'messages' }, { id: 'system-in', type: 'string' }], outputs: [{ id: 'messages-out', type: 'messages' }, { id: 'text-out', type: 'string' }] },
  tool:   { inputs: [{ id: 'trigger-in',  type: 'any' }],             outputs: [{ id: 'json-out',    type: 'json'     }] },
  memory: { inputs: [{ id: 'messages-in', type: 'messages' }],        outputs: [{ id: 'messages-out',type: 'messages' }] },
  output: { inputs: [{ id: 'text-in',     type: 'string'   }],        outputs: []                                       },
}

const NODE_LABELS: Record<NodeKind, string> = {
  input: '+ Input', prompt: '+ Prompt', llm: '+ LLM',
  tool: '+ Tool', memory: '+ Memory', output: '+ Output',
}

// ─── Run dialog ───────────────────────────────────────────────────────────────

interface RunDialogProps {
  open:      boolean
  onClose:   () => void
  onSubmit:  (text: string, file: FileData | null) => void
  inputType: string
  maxSizeKB: number
  allowedExtensions: string[]
  allowedFormats:    string[]
}

function RunDialog({ open, onClose, onSubmit, inputType, maxSizeKB, allowedExtensions, allowedFormats }: RunDialogProps) {
  const [text, setText]             = useState('')
  const [file, setFile]             = useState<FileData | null>(null)
  const [preview, setPreview]       = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [jsonValid, setJsonValid]   = useState(true)
  const fileRef                     = useRef<HTMLInputElement>(null)

  function reset() {
    setText('')
    setFile(null)
    setPreview(null)
    setError(null)
    setJsonValid(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)

    if (f.size > maxSizeKB * 1024) {
      setError(`File exceeds max size of ${(maxSizeKB / 1024).toFixed(1)} MB`)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64  = dataUrl.split(',')[1]
      setFile({ name: f.name, mimeType: f.type || 'application/octet-stream', size: f.size, data: base64 })
      if (inputType === 'image') setPreview(dataUrl)
    }
    reader.readAsDataURL(f)
  }

  function handleSubmit() {
    if (inputType === 'json') {
      try { JSON.parse(text) }
      catch { setJsonValid(false); return }
    }
    onSubmit(text, file)
    reset()
    onClose()
  }

  // Derive accept string
  const acceptAttr = inputType === 'image'
    ? allowedFormats.map(f => `image/${f.replace('.', '')}`).join(',') || 'image/*'
    : allowedExtensions.join(',') || '*/*'

  const canSubmit = inputType === 'file' || inputType === 'image'
    ? file !== null
    : text.trim().length > 0 || inputType === 'url' ? text.trim().length > 0 : text.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="max-w-lg bg-[#0f0f11] border border-white/10 p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-white/8">
          <DialogTitle className="text-sm font-semibold text-white/90">Run Flow</DialogTitle>
          <DialogDescription className="text-[11px] text-white/35 mt-0.5">
            {inputType === 'text'  && 'Enter the text input for this flow.'}
            {inputType === 'file'  && `Upload a file (${allowedExtensions.slice(0,4).join(' ')}${allowedExtensions.length > 4 ? ' …' : ''} · max ${(maxSizeKB/1024).toFixed(1)} MB)`}
            {inputType === 'image' && `Upload an image for vision processing (max ${(maxSizeKB/1024).toFixed(1)} MB)`}
            {inputType === 'json'  && 'Paste valid JSON to pass as structured input.'}
            {inputType === 'url'   && 'Enter the URL to pass into the flow.'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Text / JSON input */}
          {(inputType === 'text' || inputType === 'json') && (
            <Textarea
              autoFocus
              placeholder={inputType === 'json' ? '{"key": "value"}' : 'Type your input…'}
              value={text}
              onChange={(e) => { setText(e.target.value); setJsonValid(true) }}
              rows={5}
              className={`bg-[#1a1a1e] border-white/10 text-white/80 placeholder:text-white/20 resize-none font-mono text-sm focus-visible:ring-indigo-500/30 ${!jsonValid ? 'border-red-500/50' : ''}`}
            />
          )}
          {!jsonValid && <p className="text-[11px] text-red-400 -mt-2">Invalid JSON — fix before running.</p>}

          {/* URL input */}
          {inputType === 'url' && (
            <Input
              autoFocus
              type="url"
              placeholder="https://example.com/data"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="bg-[#1a1a1e] border-white/10 text-white/80 placeholder:text-white/20 font-mono text-sm h-10 focus-visible:ring-indigo-500/30"
            />
          )}

          {/* File upload */}
          {(inputType === 'file' || inputType === 'image') && (
            <div className="space-y-3">
              {/* Drop zone / button */}
              <label className={`
                flex flex-col items-center justify-center gap-2.5 h-32 rounded-xl border-2 border-dashed
                cursor-pointer transition-colors
                ${file ? 'border-[#00ff88]/40 bg-[#00ff88]/4' : 'border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/4'}
              `}>
                <input
                  ref={fileRef}
                  type="file"
                  accept={acceptAttr}
                  onChange={handleFileChange}
                  className="sr-only"
                />
                {!file && (
                  <>
                    <span className="text-2xl">{inputType === 'image' ? '🖼️' : '📄'}</span>
                    <span className="text-sm text-white/40">Click to choose a {inputType}</span>
                    <span className="text-[11px] text-white/20">
                      {inputType === 'image'
                        ? allowedFormats.join('  ')
                        : allowedExtensions.slice(0, 6).join('  ')}
                    </span>
                  </>
                )}
                {file && !preview && (
                  <>
                    <span className="text-2xl">✅</span>
                    <span className="text-sm text-[#00ff88]/80 font-mono">{file.name}</span>
                    <span className="text-[11px] text-white/30">{Math.round(file.size / 1024)} KB</span>
                  </>
                )}
              </label>

              {/* Image preview */}
              {preview && (
                <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Preview" className="w-full max-h-40 object-contain" />
                  <div className="absolute bottom-2 right-2 bg-black/70 rounded-lg px-2 py-1 text-[10px] text-white/60 font-mono">
                    {file?.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white/60 hover:text-white/90 text-xs flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Optional text annotation */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold tracking-widest text-white/30 uppercase">
                  Optional instruction
                </span>
                <Textarea
                  placeholder={inputType === 'image' ? 'Describe or ask about this image…' : 'Additional instructions…'}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  className="bg-[#1a1a1e] border-white/10 text-white/80 placeholder:text-white/20 resize-none font-mono text-xs focus-visible:ring-indigo-500/30"
                />
              </div>
            </div>
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-white/8 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-white/10 text-white/40 hover:bg-white/5 hover:text-white/70"
            onClick={() => { reset(); onClose() }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-[#00ff88]/15 hover:bg-[#00ff88]/25 text-[#00ff88] border border-[#00ff88]/30 hover:border-[#00ff88]/50 disabled:opacity-40"
            disabled={!canSubmit && inputType !== 'file' && inputType !== 'image'}
            onClick={handleSubmit}
          >
            ▶ Run
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

interface ToolbarProps {
  flowId:    string | null
  flowName?: string
}

export default function Toolbar({ flowId, flowName }: ToolbarProps) {
  const addNode = useStore((s) => s.addNode)
  const nodes   = useStore((s) => s.nodes)
  const runId   = useStore((s) => s.runId)
  const { runFlow, stopRun } = useSSERunner()

  const [dialogOpen, setDialogOpen] = useState(false)

  // Read input node config to shape the run dialog
  const inputNode        = nodes.find((n) => n.data.nodeType === 'input')
  const inputType        = (inputNode?.data.config?.inputType  as string  | undefined) ?? 'text'
  const maxSizeKB        = (inputNode?.data.config?.maxSizeKB  as number  | undefined) ?? 5120
  const allowedExtensions = (inputNode?.data.config?.allowedExtensions as string[] | undefined) ?? []
  const allowedFormats   = (inputNode?.data.config?.allowedFormats    as string[] | undefined) ?? []

  function handleAdd(kind: NodeKind) {
    const x = 200 + Math.random() * 300
    const y = 200 + Math.random() * 200

    const node: AgentNode = {
      id:       crypto.randomUUID(),
      type:     kind,
      position: { x, y },
      data: {
        label:    kind.charAt(0).toUpperCase() + kind.slice(1),
        nodeType: kind,
        config:   { ...DEFAULTS[kind] },
        ...PORT_MAP[kind],
      },
    }
    addNode(node)
  }

  async function handleRunSubmit(text: string, file: FileData | null) {
    if (!flowId) return
    const storeNodes = useStore.getState().nodes
    const storeEdges = useStore.getState().edges
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runFlow(flowId, text, { id: flowId, nodes: storeNodes as any, edges: storeEdges }, file ?? undefined)
  }

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 h-12 shrink-0">
        {/* Add node buttons */}
        <div className="flex items-center gap-1">
          {(Object.keys(NODE_LABELS) as NodeKind[]).map((kind) => (
            <Button
              key={kind}
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => handleAdd(kind)}
            >
              {NODE_LABELS[kind]}
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Flow name */}
        <span className="text-sm font-medium text-gray-700 flex-1 truncate px-2">
          {flowName ?? 'My flow'}
        </span>

        <Separator orientation="vertical" className="h-6" />

        {/* Run controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs bg-green-500 hover:bg-green-600 text-white"
            onClick={() => setDialogOpen(true)}
            disabled={!flowId || runId !== null}
          >
            ▶ Run
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={stopRun}
            disabled={runId === null}
          >
            ■ Stop
          </Button>
        </div>
      </div>

      <RunDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleRunSubmit}
        inputType={inputType}
        maxSizeKB={maxSizeKB}
        allowedExtensions={allowedExtensions}
        allowedFormats={allowedFormats}
      />
    </>
  )
}
