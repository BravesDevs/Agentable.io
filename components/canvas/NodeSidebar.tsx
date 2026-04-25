'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useShallow } from 'zustand/react/shallow'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge }    from '@/components/ui/badge'
import { Slider }   from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useStore, type NodeKind, type RunHistoryEntry } from '@/store'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

// ─── Schemas ─────────────────────────────────────────────────────────────────

// ── Input types ──────────────────────────────────────────────────────────────

const INPUT_TYPES = [
  { value: 'text',  label: 'Text',  description: 'Plain text or prompt' },
  { value: 'file',  label: 'File',  description: 'Upload a document or CSV' },
  { value: 'image', label: 'Image', description: 'Vision model image input' },
  { value: 'json',  label: 'JSON',  description: 'Structured JSON data' },
  { value: 'url',   label: 'URL',   description: 'A web address' },
] as const

type InputTypeValue = typeof INPUT_TYPES[number]['value']

const FILE_EXT_GROUPS = [
  {
    label: 'Documents',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    exts:  ['.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt', '.md'],
  },
  {
    label: 'Spreadsheets',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    exts:  ['.csv', '.tsv', '.xls', '.xlsx', '.ods', '.numbers'],
  },
  {
    label: 'Presentations',
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    exts:  ['.ppt', '.pptx', '.odp', '.key'],
  },
  {
    label: 'Data & Config',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    exts:  ['.json', '.yaml', '.yml', '.toml', '.xml', '.env', '.ini', '.sql'],
  },
  {
    label: 'Code',
    color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    exts:  ['.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.sh', '.rb', '.go', '.rs', '.java', '.c', '.cpp'],
  },
] as const

// Flat list derived from groups (used as default)
const FILE_EXTS = FILE_EXT_GROUPS.flatMap((g) => [...g.exts])
const IMAGE_FMTS = ['.jpg','.jpeg','.png','.webp','.gif','.svg']

// ── LLM schema ───────────────────────────────────────────────────────────────

const llmSchema = z.object({
  model:       z.enum(['claude-sonnet-4-6', 'claude-opus-4-7', 'gpt-4o', 'gpt-4o-mini']),
  temperature: z.number().min(0).max(1),
  maxTokens:   z.number().min(100).max(8000),
  systemPrompt: z.string().optional(),
})

const toolSchema = z.object({
  method:  z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  url:     z.string(),
  headers: z.string(),
  body:    z.string(),
})

type LLMForm  = z.infer<typeof llmSchema>
type ToolForm = z.infer<typeof toolSchema>

// ─── Design tokens ────────────────────────────────────────────────────────────

const NODE_META: Record<NodeKind, { label: string; color: string; dot: string }> = {
  input:   { label: 'Input Node',   color: 'text-indigo-400',  dot: 'bg-indigo-400'  },
  prompt:  { label: 'Prompt Node',  color: 'text-purple-400',  dot: 'bg-purple-400'  },
  llm:     { label: 'LLM Node',     color: 'text-blue-400',    dot: 'bg-blue-400'    },
  tool:    { label: 'Tool Node',    color: 'text-amber-400',   dot: 'bg-amber-400'   },
  memory:  { label: 'Memory Node',  color: 'text-teal-400',    dot: 'bg-teal-400'    },
  output:  { label: 'Output Node',  color: 'text-green-400',   dot: 'bg-green-400'   },
}

// ─── Reusable field row ───────────────────────────────────────────────────────

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">{label}</span>
        {hint && <span className="text-[11px] tabular-nums text-white/50 font-mono">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// ─── Multi-toggle (extension / format chips) ──────────────────────────────────

function MultiToggle({
  options, value, onChange, accentCls = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
}: {
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  accentCls?: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? value.filter((x) => x !== opt) : [...value, opt])}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              active ? accentCls : 'bg-white/4 text-white/30 border-white/8 hover:border-white/20 hover:text-white/50'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// ─── Grouped file extensions ─────────────────────────────────────────────────

function GroupedExtensions({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const allExts = FILE_EXT_GROUPS.flatMap((g) => [...g.exts])

  return (
    <div className="space-y-3">
      {/* Global all/none */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/25">
          {value.length} / {allExts.length} selected
        </span>
        <div className="flex gap-3">
          <button type="button" onClick={() => onChange([...allExts])}
            className="text-[10px] text-white/30 hover:text-white/70 transition-colors">
            All
          </button>
          <button type="button" onClick={() => onChange([])}
            className="text-[10px] text-white/30 hover:text-white/70 transition-colors">
            None
          </button>
        </div>
      </div>

      {FILE_EXT_GROUPS.map((group) => {
        const exts         = group.exts as readonly string[]
        const groupActive  = exts.filter((e) => value.includes(e))
        const allOn        = groupActive.length === exts.length
        const someOn       = groupActive.length > 0 && !allOn

        function toggleGroup() {
          if (allOn) {
            onChange(value.filter((e) => !exts.includes(e)))
          } else {
            const merged = Array.from(new Set([...value, ...exts]))
            onChange(merged)
          }
        }

        return (
          <div key={group.label} className="space-y-1.5">
            {/* Group header */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-widest text-white/35 uppercase">
                {group.label}
              </span>
              <button
                type="button"
                onClick={toggleGroup}
                className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                  allOn  ? group.color :
                  someOn ? 'bg-white/8 text-white/40 border-white/15' :
                           'bg-white/4 text-white/20 border-white/8 hover:border-white/20'
                }`}
              >
                {allOn ? 'Deselect all' : someOn ? `${groupActive.length}/${exts.length}` : 'Select all'}
              </button>
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-1.5">
              {exts.map((ext) => {
                const active = value.includes(ext)
                return (
                  <button
                    key={ext}
                    type="button"
                    onClick={() => onChange(active ? value.filter((x) => x !== ext) : [...value, ext])}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                      active ? group.color : 'bg-white/4 text-white/25 border-white/8 hover:border-white/20 hover:text-white/50'
                    }`}
                  >
                    {ext}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Input form ───────────────────────────────────────────────────────────────

function InputForm({ config, onSave }: { config: Record<string, unknown>; onSave: (v: Record<string, unknown>) => void }) {
  const [type, setType]           = useState<InputTypeValue>((config.inputType as InputTypeValue) ?? 'text')
  const [maxSizeKB, setMaxSizeKB] = useState<number>((config.maxSizeKB as number) ?? 5120)
  const [extensions, setExtensions] = useState<string[]>((config.allowedExtensions as string[]) ?? FILE_EXTS)
  const [formats, setFormats]       = useState<string[]>((config.allowedFormats    as string[]) ?? IMAGE_FMTS)

  function handleSave() {
    onSave({
      inputType: type,
      maxSizeKB,
      ...(type === 'file'  ? { allowedExtensions: extensions } : {}),
      ...(type === 'image' ? { allowedFormats:    formats    } : {}),
    })
  }

  const needsSize = type === 'file' || type === 'image'
  const sizeMB    = (maxSizeKB / 1024).toFixed(1)

  return (
    <div className="space-y-5">
      {/* Type selector */}
      <FieldRow label="Input Type">
        <Select value={type} onValueChange={(v) => setType(v as InputTypeValue)}>
          <SelectTrigger className="bg-[#1a1a1e] border-white/10 text-white/80 focus:ring-indigo-500/30 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1e] border-white/10 text-white/80">
            {INPUT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <span className="font-medium">{t.label}</span>
                <span className="ml-2 text-white/35 text-[11px]">{t.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      {/* Max file size */}
      {needsSize && (
        <FieldRow label="Max File Size" hint={`${sizeMB} MB`}>
          <Slider
            min={100} max={20480} step={100}
            value={[maxSizeKB]}
            onValueChange={([v]) => setMaxSizeKB(v)}
            className="[&_[role=slider]]:bg-indigo-400 [&_[role=slider]]:border-indigo-400 [&_.bg-primary]:bg-indigo-400"
          />
        </FieldRow>
      )}

      {/* Allowed extensions — file (grouped by category) */}
      {type === 'file' && (
        <FieldRow label="Allowed Extensions">
          <GroupedExtensions value={extensions} onChange={setExtensions} />
        </FieldRow>
      )}

      {/* Allowed formats — image */}
      {type === 'image' && (
        <FieldRow label="Allowed Formats">
          <MultiToggle
            options={IMAGE_FMTS}
            value={formats}
            onChange={setFormats}
            accentCls="bg-pink-500/20 text-pink-300 border-pink-500/30"
          />
        </FieldRow>
      )}

      <Button
        size="sm"
        className="w-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50"
        onClick={handleSave}
      >
        Apply
      </Button>
    </div>
  )
}

// ─── LLM form ─────────────────────────────────────────────────────────────────

function LLMForm({ config, onSave }: { config: Record<string, unknown>; onSave: (v: LLMForm) => void }) {
  const { control, handleSubmit, watch } = useForm<LLMForm>({
    resolver: zodResolver(llmSchema),
    defaultValues: {
      model:        (config.model        as LLMForm['model']) ?? 'claude-sonnet-4-6',
      temperature:  (config.temperature  as number)           ?? 0.7,
      maxTokens:    (config.maxTokens    as number)           ?? 1000,
      systemPrompt: (config.systemPrompt as string)           ?? '',
    },
  })

  const temp      = watch('temperature')
  const maxTokens = watch('maxTokens')

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-5">
      <FieldRow label="Model">
        <Controller
          name="model"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="bg-[#1a1a1e] border-white/10 text-white/80 focus:ring-blue-500/30 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1e] border-white/10 text-white/80">
                <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                <SelectItem value="claude-opus-4-7">Claude Opus 4.7</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </FieldRow>

      <FieldRow label="Temperature" hint={temp.toFixed(2)}>
        <Controller
          name="temperature"
          control={control}
          render={({ field }) => (
            <Slider
              min={0} max={1} step={0.01}
              value={[field.value]}
              onValueChange={([v]) => field.onChange(v)}
              className="[&_[role=slider]]:bg-blue-400 [&_[role=slider]]:border-blue-400 [&_.bg-primary]:bg-blue-400"
            />
          )}
        />
      </FieldRow>

      <FieldRow label="Max Tokens" hint={maxTokens.toLocaleString()}>
        <Controller
          name="maxTokens"
          control={control}
          render={({ field }) => (
            <Slider
              min={100} max={8000} step={100}
              value={[field.value]}
              onValueChange={([v]) => field.onChange(v)}
              className="[&_[role=slider]]:bg-blue-400 [&_[role=slider]]:border-blue-400 [&_.bg-primary]:bg-blue-400"
            />
          )}
        />
      </FieldRow>

      <FieldRow label="System Prompt">
        <Controller
          name="systemPrompt"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              rows={4}
              placeholder="You are a helpful assistant…"
              className="bg-[#1a1a1e] border-white/10 text-white/80 placeholder:text-white/20 resize-none font-mono text-xs focus-visible:ring-blue-500/30"
            />
          )}
        />
      </FieldRow>

      <Button
        type="submit"
        size="sm"
        className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 hover:border-blue-400/50"
      >
        Apply
      </Button>
    </form>
  )
}

// ─── Prompt form ──────────────────────────────────────────────────────────────

function PromptForm({ config, onSave }: { config: Record<string, unknown>; onSave: (v: { template: string }) => void }) {
  const [val, setVal] = useState((config.template as string) ?? '')
  const vars = [...new Set((val.match(/\{\{(\w+)\}\}/g) ?? []).map((m) => m.replace(/\{|\}/g, '')))]

  return (
    <div className="space-y-4">
      <FieldRow label="Template">
        <div className="rounded-lg overflow-hidden border border-white/10">
          <MonacoEditor
            height={220}
            language="handlebars"
            theme="vs-dark"
            value={val}
            onChange={(v) => setVal(v ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'off',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 10, bottom: 10 },
              renderLineHighlight: 'none',
            }}
          />
        </div>
      </FieldRow>

      {vars.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">Variables</span>
          <div className="flex flex-wrap gap-1.5">
            {vars.map((v) => (
              <Badge
                key={v}
                variant="secondary"
                className="bg-purple-500/15 text-purple-300 border border-purple-500/20 font-mono text-[10px]"
              >
                {'{{' + v + '}}'}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Button
        size="sm"
        className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30"
        onClick={() => onSave({ template: val })}
      >
        Apply
      </Button>
    </div>
  )
}

// ─── Tool form ────────────────────────────────────────────────────────────────

function ToolForm({ config, onSave }: { config: Record<string, unknown>; onSave: (v: ToolForm) => void }) {
  const { control, register, handleSubmit } = useForm<ToolForm>({
    resolver: zodResolver(toolSchema),
    defaultValues: {
      method:  (config.method  as ToolForm['method']) ?? 'GET',
      url:     (config.url     as string)             ?? '',
      headers: (config.headers as string)             ?? '{}',
      body:    (config.body    as string)             ?? '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <FieldRow label="Method">
        <Controller
          name="method"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="bg-[#1a1a1e] border-white/10 text-white/80 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1e] border-white/10 text-white/80">
                {(['GET','POST','PUT','DELETE'] as const).map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FieldRow>

      <FieldRow label="URL">
        <Input
          {...register('url')}
          placeholder="https://api.example.com/v1/endpoint"
          className="bg-[#1a1a1e] border-white/10 text-white/80 placeholder:text-white/20 font-mono text-xs h-9 focus-visible:ring-amber-500/30"
        />
      </FieldRow>

      <FieldRow label="Headers (JSON)">
        <Textarea
          {...register('headers')}
          placeholder={'{"Authorization": "Bearer ..."}'}
          rows={3}
          className="bg-[#1a1a1e] border-white/10 text-white/80 placeholder:text-white/20 resize-none font-mono text-xs focus-visible:ring-amber-500/30"
        />
      </FieldRow>

      <FieldRow label="Body (JSON)">
        <Textarea
          {...register('body')}
          placeholder={'{"query": "{{input}}"}'}
          rows={3}
          className="bg-[#1a1a1e] border-white/10 text-white/80 placeholder:text-white/20 resize-none font-mono text-xs focus-visible:ring-amber-500/30"
        />
      </FieldRow>

      <Button
        type="submit"
        size="sm"
        className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
      >
        Apply
      </Button>
    </form>
  )
}

// ─── Memory form ──────────────────────────────────────────────────────────────

function MemoryForm({ config, onSave }: { config: Record<string, unknown>; onSave: (v: { k: number }) => void }) {
  const [k, setK] = useState((config.k as number) ?? 10)

  return (
    <div className="space-y-5">
      <FieldRow label="Context Window" hint={`${k} msgs`}>
        <Slider
          min={1} max={100} step={1}
          value={[k]}
          onValueChange={([v]) => setK(v)}
          className="[&_[role=slider]]:bg-teal-400 [&_[role=slider]]:border-teal-400 [&_.bg-primary]:bg-teal-400"
        />
      </FieldRow>
      <p className="text-[11px] text-white/30">
        Keeps the last <strong className="text-white/60">{k}</strong> message
        {k !== 1 ? 's' : ''} in context. Older turns are summarised.
      </p>
      <Button
        size="sm"
        className="w-full bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30"
        onClick={() => onSave({ k })}
      >
        Apply
      </Button>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000)  return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(ms?: number): string {
  if (!ms) return ''
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

// ─── Output history panel ─────────────────────────────────────────────────────

function OutputHistory({ history }: { history: RunHistoryEntry[] }) {
  const [selected, setSelected] = useState<RunHistoryEntry | null>(null)

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3">
        <div className="w-10 h-10 rounded-full bg-white/4 border border-white/8 flex items-center justify-center">
          <span className="text-lg">📭</span>
        </div>
        <p className="text-sm text-white/30 text-center">No runs yet.<br />Hit ▶ Run to generate output.</p>
      </div>
    )
  }

  return (
    <>
      {/* Cards */}
      <div className="space-y-2.5">
        {history.map((entry, idx) => {
          const preview = entry.output.length > 120
            ? entry.output.slice(0, 120) + '…'
            : entry.output
          const isLatest = idx === 0

          return (
            <button
              key={entry.id}
              onClick={() => setSelected(entry)}
              className="w-full text-left group relative"
            >
              <div className={`
                rounded-xl border px-4 py-3.5 bg-[#131316]
                transition-all duration-150
                group-hover:border-[#00ff88]/30 group-hover:bg-[#00ff88]/4 group-hover:shadow-[0_0_14px_rgba(0,255,136,0.08)]
                ${isLatest ? 'border-[#00ff88]/25' : 'border-white/8'}
              `}>
                {/* Card header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isLatest && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shadow-[0_0_4px_#00ff88]" />
                    )}
                    <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                      Run {history.length - idx}
                    </span>
                    {isLatest && (
                      <span className="text-[9px] text-[#00ff88]/60 bg-[#00ff88]/8 border border-[#00ff88]/15 rounded-full px-1.5 py-0.5 font-medium">
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.durationMs && (
                      <span className="text-[10px] text-white/20 font-mono">{fmtDuration(entry.durationMs)}</span>
                    )}
                    <span className="text-[10px] text-white/30 font-mono">{relativeTime(entry.timestamp)}</span>
                  </div>
                </div>

                {/* Output preview */}
                <p className="text-[11px] text-white/55 font-mono leading-relaxed whitespace-pre-wrap break-words line-clamp-3">
                  {preview}
                </p>

                {entry.output.length > 120 && (
                  <p className="text-[10px] text-white/25 mt-1.5">
                    {entry.output.length - 120} more chars · click to expand
                  </p>
                )}

                {/* Hover arrow */}
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15 group-hover:text-[#00ff88]/50 transition-colors text-xs">
                  →
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-w-2xl bg-[#0f0f11] border border-white/10 p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-white/8">
            <DialogTitle className="text-sm font-semibold text-white/90 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Output · Run {selected ? history.length - history.indexOf(selected) : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">Full output from this run</DialogDescription>
            <div className="flex items-center gap-3 mt-1">
              {selected?.durationMs && (
                <span className="text-[11px] text-white/30 font-mono">{fmtDuration(selected.durationMs)}</span>
              )}
              <span className="text-[11px] text-white/30 font-mono">
                {selected ? new Date(selected.timestamp).toLocaleString() : ''}
              </span>
              <span className="text-[11px] text-white/20 font-mono ml-auto">
                {selected?.output.length ?? 0} chars
              </span>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="px-6 py-5">
              <pre className="text-sm text-white/80 font-mono whitespace-pre-wrap break-words leading-relaxed">
                {selected?.output}
              </pre>
            </div>
          </ScrollArea>

          <div className="px-6 py-3 border-t border-white/8 flex justify-between items-center">
            <span className="text-[11px] text-white/20">
              {selected ? new Date(selected.timestamp).toLocaleDateString() : ''}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-white/10 text-white/50 hover:bg-white/5 hover:text-white/80"
              onClick={() => {
                if (selected) navigator.clipboard.writeText(selected.output)
              }}
            >
              Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── NodeSidebar ──────────────────────────────────────────────────────────────

export default function NodeSidebar() {
  const { selectedNodeId, sidebarOpen, closeSidebar } = useStore(useShallow((s) => ({
    selectedNodeId: s.selectedNodeId,
    sidebarOpen:    s.sidebarOpen,
    closeSidebar:   s.closeSidebar,
  })))

  const nodes          = useStore(useShallow((s) => s.nodes))
  const updateNodeData = useStore((s) => s.updateNodeData)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setSaved(false) }, [selectedNodeId])

  const node = nodes.find((n) => n.id === selectedNodeId)
  const meta = node ? NODE_META[node.data.nodeType] : null

  function handleSave(config: Record<string, unknown>) {
    if (!selectedNodeId) return
    updateNodeData(selectedNodeId, { config })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <Sheet open={sidebarOpen} onOpenChange={(open) => { if (!open) closeSidebar() }}>
      <SheetContent
        side="right"
        className="w-[360px] p-0 bg-[#0f0f11] border-l border-white/8 flex flex-col gap-0 overflow-hidden"
      >
        {/* Visually hidden title + description satisfy Radix Dialog a11y requirements */}
        <SheetTitle className="sr-only">
          {meta?.label ?? 'Node Config'}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {node?.data.nodeType === 'output'
            ? 'View output history for this node.'
            : `Configure the selected ${node?.data.nodeType ?? 'node'} node settings.`}
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            {meta && <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />}
            <span className="text-sm font-semibold text-white/90">
              {meta?.label ?? 'Node Config'}
            </span>
          </div>
          {saved && (
            <span className="text-[11px] font-medium text-[#00ff88] bg-[#00ff88]/10 border border-[#00ff88]/20 rounded-full px-2.5 py-0.5">
              Saved ✓
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          {!node && (
            <p className="text-sm text-white/30 text-center mt-8">Select a node to configure it.</p>
          )}

          {node?.data.nodeType === 'llm' && (
            <LLMForm config={node.data.config} onSave={handleSave} />
          )}
          {node?.data.nodeType === 'prompt' && (
            <PromptForm config={node.data.config} onSave={handleSave} />
          )}
          {node?.data.nodeType === 'tool' && (
            <ToolForm config={node.data.config} onSave={handleSave} />
          )}
          {node?.data.nodeType === 'memory' && (
            <MemoryForm config={node.data.config} onSave={handleSave} />
          )}
          {node?.data.nodeType === 'output' && (
            <OutputHistory history={(node.data.runHistory ?? []) as RunHistoryEntry[]} />
          )}
          {node?.data.nodeType === 'input' && (
            <InputForm config={node.data.config} onSave={handleSave} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
