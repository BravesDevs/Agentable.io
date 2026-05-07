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
  DialogFooter,
} from '@/components/ui/dialog'
import { UserMenu } from '@/components/UserMenu'
import { useStore } from '@/store'
import { useSSERunner } from '@/hooks/useSSERunner'
import type { FileData } from '@/lib/types'
import { toast } from 'sonner'

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
            className="h-8 text-xs border-white/10 text-black/80 hover:bg-white/5 hover:text-white/70"
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

// ─── New canvas confirmation dialog (unsaved-state guard) ─────────────────────

function NewCanvasDialog({
  open, onClose, onSave, onDiscard, saving,
}: {
  open:      boolean
  onClose:   () => void
  onSave:    () => void
  onDiscard: () => void
  saving:    boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose() }}>
      <DialogContent className="max-w-md bg-white border border-[#d1d9e0] text-[#1f2328] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-[#d1d9e0]">
          <DialogTitle className="text-sm font-semibold text-[#1f2328]">Save to DB?</DialogTitle>
          <DialogDescription className="text-[12px] text-[#59636e] mt-1 leading-relaxed">
            You have unsaved changes on the current canvas. Save them before starting a new one?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="px-6 py-3 border-t border-[#d1d9e0] gap-2 sm:gap-2 bg-[#f6f8fa]">
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            className="h-7 text-xs border-[#d1d9e0] bg-white text-[#1f2328] hover:bg-[#f6f8fa] hover:text-[#1f2328]"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            className="h-7 text-xs border-[#d1d9e0] bg-white text-[#cf222e] hover:bg-[#fff5f5] hover:text-[#a40e26] hover:border-[#cf222e]/40"
            onClick={onDiscard}
          >
            No, discard
          </Button>
          <Button
            size="sm"
            autoFocus
            disabled={saving}
            className="h-7 text-xs bg-[#1f883d] hover:bg-[#1a7f37] text-white border border-[#1a7f37] disabled:opacity-60"
            onClick={onSave}
          >
            {saving ? 'Saving…' : 'Yes, save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Reset confirmation dialog ────────────────────────────────────────────────

function ResetDialog({
  open, onClose, onConfirm, nodeCount, edgeCount,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  nodeCount: number
  edgeCount: number
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md bg-white border border-[#d1d9e0] text-[#1f2328] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-[#d1d9e0]">
          <DialogTitle className="text-sm font-semibold text-[#1f2328]">Reset canvas?</DialogTitle>
          <DialogDescription className="text-[12px] text-[#59636e] mt-1 leading-relaxed">
            Removes all <span className="font-medium text-[#1f2328]">{nodeCount}</span> nodes
            {edgeCount > 0 && <> and <span className="font-medium text-[#1f2328]">{edgeCount}</span> connections</>}{' '}
            from the canvas, along with any run output. This cannot be undone — save first if you want to keep it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="px-6 py-3 border-t border-[#d1d9e0] gap-2 sm:gap-2 bg-[#f6f8fa]">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-[#d1d9e0] bg-white text-[#1f2328] hover:bg-[#f6f8fa] hover:text-[#1f2328]"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            autoFocus
            className="h-7 text-xs bg-[#cf222e] hover:bg-[#a40e26] text-white border border-[#a40e26]"
            onClick={onConfirm}
          >
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

interface ToolbarProps {
  flowId:    string | null
  flowName?: string
  onRename?: (name: string) => void
}

export default function Toolbar({ flowId, flowName, onRename }: ToolbarProps) {
  const nodes      = useStore((s) => s.nodes)
  const edges      = useStore((s) => s.edges)
  const runId      = useStore((s) => s.runId)
  const dirty      = useStore((s) => s.dirty)
  const loadGraph    = useStore((s) => s.loadGraph)
  const clearRunState = useStore((s) => s.clearRunState)
  const markSaved    = useStore((s) => s.markSaved)
  const { runFlow, stopRun } = useSSERunner()

  const [dialogOpen,   setDialogOpen]   = useState(false)
  const [resetOpen,    setResetOpen]    = useState(false)
  const [newCanvasOpen, setNewCanvasOpen] = useState(false)
  const [editingName,  setEditingName]  = useState(false)
  const [savingName,   setSavingName]   = useState(false)
  const [savingFlow,   setSavingFlow]   = useState(false)
  const nameInputRef                    = useRef<HTMLInputElement>(null)

  // Read input node config to shape the run dialog
  const inputNode        = nodes.find((n) => n.data.nodeType === 'input')
  const inputType        = (inputNode?.data.config?.inputType  as string  | undefined) ?? 'text'
  const maxSizeKB        = (inputNode?.data.config?.maxSizeKB  as number  | undefined) ?? 5120
  const allowedExtensions = (inputNode?.data.config?.allowedExtensions as string[] | undefined) ?? []
  const allowedFormats   = (inputNode?.data.config?.allowedFormats    as string[] | undefined) ?? []

  async function handleRunSubmit(text: string, file: FileData | null) {
    if (!flowId) return
    const storeNodes = useStore.getState().nodes
    const storeEdges = useStore.getState().edges
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runFlow(flowId, text, { id: flowId, nodes: storeNodes as any, edges: storeEdges }, file ?? undefined)
  }

  async function commitName() {
    if (!flowId) { setEditingName(false); return }
    const trimmed = (nameInputRef.current?.value ?? '').trim()
    if (!trimmed || trimmed === flowName) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    try {
      const r = await fetch(`/api/v1/flows/${flowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!r.ok) throw new Error(`PATCH failed (${r.status})`)
      onRename?.(trimmed)
      toast.success('Canvas renamed')
    } catch (err) {
      console.error(err)
      toast.error('Could not rename canvas')
    } finally {
      setSavingName(false)
      setEditingName(false)
    }
  }

  async function saveWorkflow(): Promise<boolean> {
    if (!flowId) return false
    setSavingFlow(true)
    try {
      const storeNodes = useStore.getState().nodes
      const storeEdges = useStore.getState().edges
      const r = await fetch(`/api/v1/flows/${flowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: flowName,
          json: { nodes: storeNodes, edges: storeEdges },
        }),
      })
      if (!r.ok) throw new Error(`PATCH failed (${r.status})`)
      markSaved()
      toast.success('Saved', { description: `${storeNodes.length} nodes · ${storeEdges.length} edges` })
      return true
    } catch (err) {
      console.error(err)
      toast.error('Save failed')
      return false
    } finally {
      setSavingFlow(false)
    }
  }

  async function handleSaveAll() {
    await saveWorkflow()
  }

  function resetCanvas() {
    loadGraph([], [])
    clearRunState()
  }

  function handleReset() {
    resetCanvas()
    setResetOpen(false)
    toast.success('Canvas cleared')
  }

  function handleNewCanvasClick() {
    if (!flowId || isRunning) return
    if (dirty) {
      setNewCanvasOpen(true)
      return
    }
    resetCanvas()
    toast.success('New canvas')
  }

  async function handleNewCanvasSave() {
    const ok = await saveWorkflow()
    if (!ok) return
    resetCanvas()
    setNewCanvasOpen(false)
    toast.success('New canvas')
  }

  function handleNewCanvasDiscard() {
    resetCanvas()
    setNewCanvasOpen(false)
    toast.success('New canvas')
  }

  const canEditName = !!flowId && !savingName
  const canSave     = !!flowId && !savingFlow
  const isEmpty     = nodes.length === 0
  const isRunning   = runId !== null

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 bg-[#f6f8fa] border-b border-[#d1d9e0] h-12 shrink-0">
        {/* Logo / brand */}
        <div className="flex items-center gap-2 mr-1">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#0969da] to-[#5a61e7] flex items-center justify-center text-white text-[11px] font-bold">
            A
          </div>
        </div>

        {/* Editable flow name */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {editingName ? (
            <Input
              ref={nameInputRef}
              autoFocus
              disabled={!canEditName}
              defaultValue={flowName ?? ''}
              maxLength={120}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitName() }
                if (e.key === 'Escape') { setEditingName(false) }
              }}
              className="h-7 max-w-xs text-sm font-medium border-[#0969da] bg-white text-[#1f2328] focus-visible:ring-[#0969da]/30"
            />
          ) : (
            <button
              type="button"
              disabled={!flowId}
              onClick={() => setEditingName(true)}
              title="Click to rename"
              className="flex items-center gap-1.5 max-w-xs px-2 py-1 -mx-1 rounded text-sm font-medium text-[#1f2328] hover:bg-[#e6eaef] disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
            >
              <span className="truncate">{flowName ?? 'My flow'}</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-[#59636e] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <path d="M12 20h9" strokeLinecap="round" />
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {savingName && (
            <span className="text-[10px] text-[#59636e] font-mono">saving…</span>
          )}
        </div>

        <Separator orientation="vertical" className="h-6 bg-[#d1d9e0]" />

        {/* New / Reset / Save */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={!flowId || isRunning}
            onClick={handleNewCanvasClick}
            title={isRunning ? 'Stop the run before starting a new canvas' : dirty ? 'Save or discard, then start fresh' : 'Start a new canvas'}
            className="h-7 text-xs border-[#d1d9e0] bg-white text-[#1f2328] hover:bg-[#f6f8fa] hover:text-[#0969da] hover:border-[#0969da]/40 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" className="mr-1">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" strokeLinejoin="round" />
              <path d="M14 3v6h6" strokeLinejoin="round" />
              <path d="M12 12v6M9 15h6" strokeLinecap="round" />
            </svg>
            New
            {dirty && <span aria-hidden className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-[#bf8700]" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!flowId || isEmpty || isRunning}
            onClick={() => setResetOpen(true)}
            title={isRunning ? 'Stop the run before resetting' : isEmpty ? 'Canvas is already empty' : 'Clear the canvas'}
            className="h-7 text-xs border-[#d1d9e0] bg-white text-[#1f2328] hover:bg-[#f6f8fa] hover:text-[#cf222e] hover:border-[#cf222e]/40 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" className="mr-1">
              <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
              <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reset
          </Button>

          <Button
            size="sm"
            disabled={!canSave}
            onClick={handleSaveAll}
            title="Save canvas configuration"
            className="h-7 text-xs bg-[#1f883d] hover:bg-[#1a7f37] text-white border border-[#1a7f37] disabled:opacity-50"
          >
            {savingFlow ? (
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1 animate-spin">
                <path d="M21 12a9 9 0 1 1-6.2-8.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" className="mr-1">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinejoin="round" />
                <path d="M17 21v-8H7v8M7 3v5h8" strokeLinejoin="round" />
              </svg>
            )}
            Save
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-[#d1d9e0]" />

        {/* Run controls */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="h-7 text-xs bg-[#2da44e] hover:bg-[#1a7f37] text-white border border-[#1a7f37] disabled:opacity-50"
            onClick={() => setDialogOpen(true)}
            disabled={!flowId || isRunning}
          >
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" className="mr-1">
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
            Run
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-[#d1d9e0] bg-white text-[#1f2328] hover:bg-[#f6f8fa] disabled:opacity-50"
            onClick={stopRun}
            disabled={!isRunning}
          >
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" className="mr-1">
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
            Stop
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-[#d1d9e0]" />

        {/* User menu */}
        <div className="ml-auto">
          <UserMenu />
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

      <ResetDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        nodeCount={nodes.length}
        edgeCount={edges.length}
      />

      <NewCanvasDialog
        open={newCanvasOpen}
        onClose={() => setNewCanvasOpen(false)}
        onSave={handleNewCanvasSave}
        onDiscard={handleNewCanvasDiscard}
        saving={savingFlow}
      />
    </>
  )
}
