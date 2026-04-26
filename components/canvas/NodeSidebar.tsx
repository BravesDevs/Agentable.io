'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useShallow } from 'zustand/react/shallow'
import { Dialog as RadixDialog } from 'radix-ui'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
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
import { useStore, type AgentNodeKind, type RunHistoryEntry } from '@/store'
import type { ToolRunSnapshot } from '@/lib/types'

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
  method:       z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  url:          z.string(),
  headers:      z.string(),
  body:         z.string(),
  forwardInput: z.boolean().optional(),
})

type LLMForm  = z.infer<typeof llmSchema>
type ToolForm = z.infer<typeof toolSchema>

// ─── Design tokens ────────────────────────────────────────────────────────────

const NODE_META: Record<AgentNodeKind, { label: string; color: string; dot: string }> = {
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

const DEFAULT_OUTPUT_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    result:    { type: 'string', description: 'The main answer or result' },
    reasoning: { type: 'string', description: 'Step-by-step reasoning' },
  },
  required: ['result'],
}, null, 2)

function LLMForm({ config, onSave }: { config: Record<string, unknown>; onSave: (v: Record<string, unknown>) => void }) {
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

  const [structuredOutput, setStructuredOutput] = useState(Boolean(config.structuredOutput))
  const [schemaStr, setSchemaStr]               = useState(
    config.outputSchema ? JSON.stringify(config.outputSchema, null, 2) : DEFAULT_OUTPUT_SCHEMA,
  )
  const [schemaError, setSchemaError] = useState<string | null>(null)

  function handleSave(formValues: LLMForm) {
    if (structuredOutput) {
      try {
        JSON.parse(schemaStr)
        setSchemaError(null)
      } catch {
        setSchemaError('Invalid JSON — fix the schema before applying.')
        return
      }
    }
    onSave({
      ...formValues,
      structuredOutput,
      ...(structuredOutput ? { outputSchema: JSON.parse(schemaStr) } : {}),
    })
  }

  return (
    <form onSubmit={handleSubmit(handleSave)} className="space-y-5">
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

      {/* ── Structured Output ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
        {/* Toggle row */}
        <div className="flex items-center justify-between px-3.5 py-3">
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold text-white/70">Structured Output</p>
            <p className="text-[10px] text-white/30">Enforce a JSON schema on the response</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={structuredOutput}
            onClick={() => { setStructuredOutput((v) => !v); setSchemaError(null) }}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all ${
              structuredOutput ? 'border-blue-500/50 bg-blue-500/30' : 'border-white/15 bg-white/8'
            }`}
          >
            <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow-sm transition-transform ${
              structuredOutput ? 'translate-x-[18px] bg-blue-300' : 'translate-x-0.5 bg-white/60'
            }`} />
          </button>
        </div>

        {/* Schema editor — shown when enabled */}
        {structuredOutput && (
          <div className="border-t border-white/8">
            <div className="px-3.5 pt-3 pb-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">Output Schema</span>
                <span className="text-[10px] text-white/25 font-mono">JSON Schema</span>
              </div>
            </div>
            <div className={`border-t ${schemaError ? 'border-red-500/40' : 'border-white/6'}`}>
              <MonacoEditor
                height={220}
                language="json"
                theme="vs-dark"
                value={schemaStr}
                onChange={(v) => { setSchemaStr(v ?? ''); setSchemaError(null) }}
                options={{
                  minimap:              { enabled: false },
                  fontSize:             11,
                  lineNumbers:          'off',
                  wordWrap:             'on',
                  scrollBeyondLastLine: false,
                  padding:              { top: 10, bottom: 10 },
                  renderLineHighlight:  'none',
                  formatOnPaste:        true,
                }}
              />
            </div>
            {schemaError && (
              <p className="px-3.5 py-2 text-[11px] text-red-400 font-mono border-t border-red-500/20">
                {schemaError}
              </p>
            )}
            <div className="px-3.5 py-2.5 border-t border-white/6">
              <p className="text-[10px] text-white/25 leading-relaxed">
                Define the exact shape of the JSON object the model will return.
                Use <span className="font-mono text-white/40">type</span>,{' '}
                <span className="font-mono text-white/40">properties</span>, and{' '}
                <span className="font-mono text-white/40">required</span> fields.
              </p>
            </div>
          </div>
        )}
      </div>

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

const METHOD_BADGE: Record<string, string> = {
  GET:    'bg-green-500/15 text-green-300 border-green-500/25',
  POST:   'bg-blue-500/15  text-blue-300  border-blue-500/25',
  PUT:    'bg-amber-500/15 text-amber-300 border-amber-500/25',
  DELETE: 'bg-red-500/15   text-red-300   border-red-500/25',
}

function statusBadgeColor(status?: number, errored?: boolean): string {
  if (errored && !status) return 'bg-red-500/15 text-red-300 border-red-500/25'
  if (!status)            return 'bg-white/8 text-white/40 border-white/15'
  if (status < 300)       return 'bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/25'
  if (status < 400)       return 'bg-amber-500/15 text-amber-300 border-amber-500/25'
  return 'bg-red-500/15 text-red-300 border-red-500/25'
}

function ToolForm({
  config,
  onSave,
  history,
}: {
  config:  Record<string, unknown>
  onSave:  (v: ToolForm) => void
  history: RunHistoryEntry[]
}) {
  const { control, register, handleSubmit, watch, setValue } = useForm<ToolForm>({
    resolver: zodResolver(toolSchema),
    defaultValues: {
      method:       (config.method  as ToolForm['method']) ?? 'GET',
      url:          (config.url     as string)             ?? '',
      headers:      (config.headers as string)             ?? '{}',
      body:         (config.body    as string)             ?? '',
      forwardInput: (config.forwardInput as boolean | undefined) ?? false,
    },
  })

  const method        = watch('method')
  const forwardInput  = watch('forwardInput') ?? false
  const bodyAllowed   = method !== 'GET' && method !== 'DELETE'

  const [selected, setSelected] = useState<RunHistoryEntry | null>(null)
  const toolHistory = history.filter(h => h.tool)

  return (
    <>
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

        {/* Forward parent output as body */}
        <div className={`rounded-xl border bg-white/2 overflow-hidden ${
          bodyAllowed ? 'border-white/8' : 'border-white/5 opacity-50'
        }`}>
          <div className="flex items-center justify-between px-3.5 py-3">
            <div className="space-y-0.5 min-w-0 pr-3">
              <p className="text-[11px] font-semibold text-white/70">Forward parent output as body</p>
              <p className="text-[10px] text-white/30 leading-relaxed">
                Send the upstream node&apos;s output verbatim. Overrides the body field below.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={forwardInput}
              disabled={!bodyAllowed}
              onClick={() => setValue('forwardInput', !forwardInput, { shouldDirty: true })}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all disabled:cursor-not-allowed ${
                forwardInput ? 'border-amber-500/50 bg-amber-500/30' : 'border-white/15 bg-white/8'
              }`}
            >
              <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow-sm transition-transform ${
                forwardInput ? 'translate-x-[18px] bg-amber-300' : 'translate-x-0.5 bg-white/60'
              }`} />
            </button>
          </div>
          {!bodyAllowed && (
            <p className="px-3.5 pb-2.5 text-[10px] text-white/30 italic">
              {method} requests don&apos;t carry a body — switch to POST or PUT to forward parent output.
            </p>
          )}
        </div>

        <FieldRow
          label="Body (JSON)"
          hint={forwardInput && bodyAllowed ? 'overridden by parent output' : undefined}
        >
          <Textarea
            {...register('body')}
            placeholder={'{"query": "{{input}}"}'}
            rows={3}
            disabled={forwardInput && bodyAllowed}
            className={`bg-[#1a1a1e] border-white/10 text-white/80 placeholder:text-white/20 resize-none font-mono text-xs focus-visible:ring-amber-500/30 ${
              forwardInput && bodyAllowed ? 'opacity-40 cursor-not-allowed' : ''
            }`}
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

      {/* ── Server responses ─────────────────────────────────────────────── */}
      <div className="mt-6 pt-5 border-t border-white/8">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">Responses</span>
          <span className="text-[10px] tabular-nums text-white/30 font-mono">
            {toolHistory.length} call{toolHistory.length !== 1 ? 's' : ''}
          </span>
        </div>

        {toolHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 rounded-xl border border-dashed border-white/8">
            <span className="text-base">🌐</span>
            <p className="text-[11px] text-white/30 text-center">No requests yet.<br />Run the flow to call this endpoint.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {toolHistory.map((entry, idx) => {
              const tool     = entry.tool!
              const method   = tool.request.method
              const status   = tool.response?.status
              const errored  = entry.status === 'error' || !!tool.error
              const url      = tool.request.url
              const urlPrev  = url.length > 56 ? url.slice(0, 56) + '…' : url
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
                    group-hover:border-amber-400/30 group-hover:bg-amber-400/4 group-hover:shadow-[0_0_14px_rgba(251,191,36,0.08)]
                    ${isLatest ? 'border-amber-400/25' : 'border-white/8'}
                  `}>
                    {/* Card header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 border ${METHOD_BADGE[method] ?? 'bg-white/8 text-white/40 border-white/15'}`}>
                          {method}
                        </span>
                        <span className={`text-[9px] font-mono font-bold rounded px-1.5 py-0.5 border ${statusBadgeColor(status, errored)}`}>
                          {status ?? (errored ? 'ERR' : '—')}
                        </span>
                        {isLatest && (
                          <span className="text-[9px] text-amber-300/70 bg-amber-400/8 border border-amber-400/15 rounded-full px-1.5 py-0.5 font-medium">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.durationMs != null && (
                          <span className="text-[10px] text-white/20 font-mono">{fmtDuration(entry.durationMs)}</span>
                        )}
                        <span className="text-[10px] text-white/30 font-mono">{relativeTime(entry.timestamp)}</span>
                      </div>
                    </div>

                    {/* URL preview */}
                    <p className="text-[11px] text-white/55 font-mono leading-relaxed break-all line-clamp-2">
                      {urlPrev || <span className="text-white/30 italic">No URL</span>}
                    </p>

                    {tool.error && (
                      <p className="text-[10px] text-red-400/80 mt-1.5 font-mono break-all line-clamp-2">
                        {tool.error}
                      </p>
                    )}

                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15 group-hover:text-amber-400/50 transition-colors text-xs">
                      →
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <ToolDetailModal
        entry={selected}
        onClose={() => setSelected(null)}
        index={selected ? toolHistory.length - toolHistory.indexOf(selected) : 0}
      />
    </>
  )
}

// ─── Tool detail modal (tabs: Headers / Body / Status / Response) ─────────────

type ToolTab = 'headers' | 'body' | 'status' | 'response'

const TOOL_TABS: { id: ToolTab; label: string }[] = [
  { id: 'headers',  label: 'Headers' },
  { id: 'body',     label: 'Body / Query' },
  { id: 'status',   label: 'Status' },
  { id: 'response', label: 'Response' },
]

function KVTable({ rows, emptyLabel }: { rows: Record<string, string>; emptyLabel: string }) {
  const entries = Object.entries(rows)
  if (entries.length === 0) {
    return <p className="text-[11px] text-white/30 italic px-1">{emptyLabel}</p>
  }
  return (
    <div className="rounded-lg border border-white/8 overflow-hidden">
      <table className="w-full text-[11px] font-mono">
        <tbody>
          {entries.map(([k, v], i) => (
            <tr key={k} className={i % 2 === 0 ? 'bg-white/2' : ''}>
              <td className="px-3 py-1.5 text-white/55 align-top whitespace-nowrap border-r border-white/6 w-[40%]">
                {k}
              </td>
              <td className="px-3 py-1.5 text-white/80 break-all">
                {v}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ToolDetailModal({
  entry,
  onClose,
  index,
}: {
  entry:   RunHistoryEntry | null
  onClose: () => void
  index:   number
}) {
  const [tab, setTab] = useState<ToolTab>('headers')

  const tool   = entry?.tool as ToolRunSnapshot | undefined
  const status = tool?.response?.status
  const errored = entry?.status === 'error' || !!tool?.error

  return (
    <DraggableModal
      open={!!entry}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 min-w-0 w-full">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-sm font-semibold text-white/90 shrink-0">
            Request · {index || ''}
          </span>
          {tool && (
            <>
              <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 border shrink-0 ${METHOD_BADGE[tool.request.method] ?? ''}`}>
                {tool.request.method}
              </span>
              <span className={`text-[9px] font-mono font-bold rounded px-1.5 py-0.5 border shrink-0 ${statusBadgeColor(status, errored)}`}>
                {status ?? (errored ? 'ERR' : '—')}
              </span>
              <span className="text-[11px] text-white/40 font-mono truncate min-w-0">
                {tool.request.url}
              </span>
            </>
          )}
          <span className="text-[11px] text-white/25 font-mono shrink-0 ml-auto">
            {entry ? new Date(entry.timestamp).toLocaleString() : ''}
          </span>
        </div>
      }
    >
      {tool && (
        <div className="flex flex-col h-full min-h-0">
          {/* Tabs */}
          <div className="flex border-b border-white/8 bg-[#0f0f11]">
            {TOOL_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-2.5 text-[11px] font-semibold tracking-widest uppercase transition-colors ${
                  tab === t.id ? 'text-amber-300' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-amber-400 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto px-6 py-5">
            {tab === 'headers' && (
              <div className="space-y-2">
                <p className="text-[9px] font-semibold tracking-widest text-white/30 uppercase mb-2">Request Headers</p>
                <KVTable rows={tool.request.headers} emptyLabel="No request headers." />
              </div>
            )}

            {tab === 'body' && (
              <div className="space-y-5">
                {tool.request.query && Object.keys(tool.request.query).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-semibold tracking-widest text-white/30 uppercase mb-2">Query Params</p>
                    <KVTable rows={tool.request.query} emptyLabel="No query params." />
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-[9px] font-semibold tracking-widest text-white/30 uppercase mb-2">Request Body</p>
                  {tool.request.body ? (
                    <pre className="text-[11px] font-mono text-white/80 whitespace-pre-wrap break-words leading-relaxed bg-black/40 border border-white/8 rounded-lg px-3 py-2.5 max-h-[55vh] overflow-auto">
                      {tool.request.body}
                    </pre>
                  ) : (
                    <p className="text-[11px] text-white/30 italic px-1">No body sent (method: {tool.request.method}).</p>
                  )}
                </div>
              </div>
            )}

            {tab === 'status' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <StatRow label="Status Code"
                    value={tool.response?.status != null ? String(tool.response.status) : '—'}
                    mono
                    valueClass={statusBadgeColor(tool.response?.status, errored).split(' ')[1]}
                  />
                  <StatRow label="Status Text" value={tool.response?.statusText || '—'} mono />
                  <StatRow label="Duration"    value={tool.response?.durationMs != null ? `${tool.response.durationMs}ms` : '—'} mono />
                  <StatRow label="Body Size"   value={tool.response?.bodyBytes != null ? `${tool.response.bodyBytes.toLocaleString()} B` : '—'} mono />
                  <StatRow label="Content-Type" value={tool.response?.contentType ?? '—'} mono />
                  <StatRow label="Method"      value={tool.request.method} mono />
                </div>

                {tool.error && (
                  <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2.5">
                    <p className="text-[9px] font-semibold tracking-widest text-red-300/70 uppercase mb-1">Error</p>
                    <p className="text-[11px] text-red-300 font-mono break-all">{tool.error}</p>
                  </div>
                )}

                {tool.response && (
                  <div className="space-y-2 pt-2 border-t border-white/8">
                    <p className="text-[9px] font-semibold tracking-widest text-white/30 uppercase">Response Headers</p>
                    <KVTable rows={tool.response.headers} emptyLabel="No response headers." />
                  </div>
                )}
              </div>
            )}

            {tab === 'response' && (
              <div className="space-y-2">
                <p className="text-[9px] font-semibold tracking-widest text-white/30 uppercase mb-2">Response Body</p>
                {tool.response ? (
                  <pre className="text-[11px] font-mono text-white/80 whitespace-pre-wrap break-words leading-relaxed bg-black/40 border border-white/8 rounded-lg px-3 py-2.5 max-h-[60vh] overflow-auto">
                    {tool.response.body || <span className="text-white/30 italic">Empty response body.</span>}
                  </pre>
                ) : (
                  <p className="text-[11px] text-white/30 italic">No response — request failed before reaching the server.</p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/8 flex items-center justify-between bg-[#0f0f11]">
            <span className="text-[11px] text-white/20 font-mono">
              {entry ? new Date(entry.timestamp).toLocaleString() : ''}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => {
                if (!tool) return
                const copy = tab === 'response' ? (tool.response?.body ?? '') : JSON.stringify(tool, null, 2)
                navigator.clipboard.writeText(copy)
              }}
            >
              Copy {tab === 'response' ? 'response' : 'snapshot'}
            </Button>
          </div>
        </div>
      )}
    </DraggableModal>
  )
}

// ─── Memory form ──────────────────────────────────────────────────────────────

function MemoryForm({
  config,
  onSave,
  history,
}: {
  config:  Record<string, unknown>
  onSave:  (v: { k: number }) => void
  history: RunHistoryEntry[]
}) {
  const [k, setK]               = useState((config.k as number) ?? 10)
  const [selected, setSelected] = useState<RunHistoryEntry | null>(null)
  const visible                 = history.slice(0, k)

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

      {/* ── Messages list ───────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-white/8">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">Messages</span>
          <span className="text-[10px] tabular-nums text-white/30 font-mono">
            {visible.length} / {history.length}
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 rounded-xl border border-dashed border-white/8">
            <span className="text-base">💬</span>
            <p className="text-[11px] text-white/30 text-center">No messages buffered yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visible.map((entry, idx) => {
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
                    group-hover:border-teal-400/30 group-hover:bg-teal-400/4 group-hover:shadow-[0_0_14px_rgba(45,212,191,0.08)]
                    ${isLatest ? 'border-teal-400/25' : 'border-white/8'}
                  `}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isLatest && (
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_4px_rgb(45,212,191)]" />
                        )}
                        <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                          Msg {history.length - idx}
                        </span>
                        {isLatest && (
                          <span className="text-[9px] text-teal-300/70 bg-teal-400/8 border border-teal-400/15 rounded-full px-1.5 py-0.5 font-medium">
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

                    <p className="text-[11px] text-white/55 font-mono leading-relaxed whitespace-pre-wrap break-words line-clamp-3">
                      {preview}
                    </p>

                    {entry.output.length > 120 && (
                      <p className="text-[10px] text-white/25 mt-1.5">
                        {entry.output.length - 120} more chars · click to expand
                      </p>
                    )}

                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15 group-hover:text-teal-400/50 transition-colors text-xs">
                      →
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <DraggableModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
              <span className="text-sm font-semibold text-white/90 truncate">
                Message · {selected ? history.length - history.indexOf(selected) : ''}
              </span>
            </div>
            <span className="text-[11px] text-white/25 font-mono shrink-0 ml-auto">
              {selected ? new Date(selected.timestamp).toLocaleString() : ''}
            </span>
          </div>
        }
      >
        <div>
          <div className="px-6 py-5">
            <pre className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed text-white/80">
              {selected?.output}
            </pre>
          </div>
          <div className="px-6 py-3 border-t border-white/8 flex items-center justify-between">
            <span className="text-[11px] text-white/20 font-mono">
              {selected ? new Date(selected.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => { if (selected) navigator.clipboard.writeText(selected.output) }}
            >
              Copy message
            </Button>
          </div>
        </div>
      </DraggableModal>
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

// ─── Draggable + resizable modal ─────────────────────────────────────────────

interface DraggableModalProps {
  open:     boolean
  onClose:  () => void
  title:    React.ReactNode
  children: React.ReactNode
}

const INIT_W = 720
const INIT_H = 600

function DraggableModal({ open, onClose, title, children }: DraggableModalProps) {
  const [pos, setPos]   = useState<{ x: number; y: number } | null>(null)
  const modalRef        = useRef<HTMLDivElement>(null)
  const isDragging      = useRef(false)
  const dragOrigin      = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  // Why: a callback-ref that calls setState was triggering "Maximum update depth"
  // through Radix's useComposedRefs chain (Content → ContentModal → ContentImpl →
  // DismissableLayer). Position once per open via useLayoutEffect instead.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    if (typeof window === 'undefined') return
    const w = Math.min(INIT_W, window.innerWidth  - 48)
    const h = Math.min(INIT_H, window.innerHeight - 80)
    if (modalRef.current) {
      modalRef.current.style.width  = `${w}px`
      modalRef.current.style.height = `${h}px`
    }
    setPos({
      x: Math.round((window.innerWidth  - w) / 2),
      y: Math.round((window.innerHeight - h) / 2),
    })
  }, [open])

  const startDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks on interactive children
    if ((e.target as Element).closest('button,a,[data-no-drag]')) return
    if (!pos) return
    e.preventDefault()
    isDragging.current = true
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const nx = Math.max(0, Math.min(window.innerWidth  - 120, dragOrigin.current.px + ev.clientX - dragOrigin.current.mx))
      const ny = Math.max(0, Math.min(window.innerHeight - 60,  dragOrigin.current.py + ev.clientY - dragOrigin.current.my))
      setPos({ x: nx, y: ny })
    }
    const onUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [pos])

  // Why: Radix Dialog's DismissableLayer stack ensures only the topmost layer
  // processes outside-click/escape events, so a nested Dialog never bubbles its
  // events up to the parent Sheet. We then preventDefault on every dismiss path
  // so the modal can ONLY close via the explicit ✕ button.
  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[400] bg-black/55 backdrop-blur-[2px]" />
        <RadixDialog.Content
          ref={modalRef}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e)    => e.preventDefault()}
          onEscapeKeyDown={(e)      => e.preventDefault()}
          aria-describedby={undefined}
          style={{
            left:      pos?.x ?? 0,
            top:       pos?.y ?? 0,
            minWidth:  480,
            minHeight: 380,
            resize:    'both',
            overflow:  'hidden',
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="fixed z-[401] flex flex-col bg-[#0f0f11] border border-white/12 rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/5 focus:outline-none"
        >
          <RadixDialog.Title className="sr-only">Detail</RadixDialog.Title>

          {/* ── Drag handle / title bar ─────────────────────────────────────── */}
          <div
            onMouseDown={startDrag}
            className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/8 cursor-grab active:cursor-grabbing select-none shrink-0"
          >
            {/* Grip indicator */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex flex-col gap-[3px] opacity-30 shrink-0">
                {[0,1,2].map((r) => (
                  <div key={r} className="flex gap-[3px]">
                    {[0,1].map((c) => <span key={c} className="w-1 h-1 rounded-full bg-white/60" />)}
                  </div>
                ))}
              </div>
              <div className="min-w-0">{title}</div>
            </div>

            {/* Close */}
            <button
              data-no-drag
              type="button"
              onClick={onClose}
              className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white/35 hover:text-white/80 hover:bg-white/8 transition-colors text-sm"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* ── Scrollable body ─────────────────────────────────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-scroll overscroll-contain [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:bg-transparent [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-thumb:hover]:bg-white/50">
            {children}
          </div>

          {/* Resize hint */}
          <div className="absolute bottom-1.5 right-2 pointer-events-none select-none opacity-20">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M11 1L1 11M11 6L6 11M11 11H11" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

// ─── Analytics stat row ───────────────────────────────────────────────────────

function StatRow({ label, value, mono = false, valueClass }: {
  label:       string
  value:       string
  mono?:       boolean
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] text-white/35 shrink-0">{label}</span>
      <span className={`text-[11px] truncate text-right ${mono ? 'font-mono' : ''} ${valueClass ?? 'text-white/60'}`}>
        {value}
      </span>
    </div>
  )
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
      <DraggableModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              <span className="text-sm font-semibold text-white/90 truncate">
                Output · Run {selected ? history.length - history.indexOf(selected) : ''}
              </span>
              {selected?.mode === 'structured' && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-violet-500/15 text-violet-300 border-violet-500/25 uppercase tracking-wide shrink-0">
                  JSON
                </span>
              )}
            </div>
            <span className="text-[11px] text-white/25 font-mono shrink-0 ml-auto">
              {selected ? new Date(selected.timestamp).toLocaleString() : ''}
            </span>
          </div>
        }
      >
        <div>

          {/* Analytics grid */}
          {selected && (
            <div className="px-6 py-4 border-b border-white/8 grid grid-cols-2 gap-x-4 gap-y-4">

              {/* Left column — model & timing */}
              <div className="space-y-3">
                <p className="text-[9px] font-semibold tracking-widest text-white/25 uppercase mb-1">Model & Timing</p>

                <StatRow label="Model" value={selected.model ?? '—'} mono />
                <StatRow label="Mode"
                  value={selected.mode === 'structured' ? 'Structured JSON' : 'Text Streaming'}
                  valueClass={selected.mode === 'structured' ? 'text-violet-300' : 'text-[#00ff88]/70'}
                />
                <StatRow label="Total Duration"   value={fmtDuration(selected.durationMs) || '—'} mono />
                <StatRow label="Time to 1st Token"
                  value={selected.usage?.firstTokenMs != null ? `${selected.usage.firstTokenMs}ms` : '—'}
                  mono
                />
                {selected.usage && selected.durationMs && selected.usage.firstTokenMs != null && (
                  <StatRow
                    label="Generation Rate"
                    value={(() => {
                      const genMs = selected.durationMs - selected.usage!.firstTokenMs!
                      if (genMs <= 0) return '—'
                      const tps = Math.round((selected.usage!.completionTokens / genMs) * 1000)
                      return `${tps} tok/s`
                    })()}
                    mono
                  />
                )}
              </div>

              {/* Right column — token usage */}
              <div className="space-y-3">
                <p className="text-[9px] font-semibold tracking-widest text-white/25 uppercase mb-1">Token Usage</p>

                <StatRow label="Prompt (sent)"
                  value={selected.usage?.promptTokens != null ? selected.usage.promptTokens.toLocaleString() : '—'}
                  mono
                  valueClass="text-blue-300/70"
                />
                <StatRow label="Completion (received)"
                  value={selected.usage?.completionTokens != null ? selected.usage.completionTokens.toLocaleString() : '—'}
                  mono
                  valueClass="text-[#00ff88]/70"
                />
                <StatRow label="Total Tokens"
                  value={selected.usage?.totalTokens != null ? selected.usage.totalTokens.toLocaleString() : '—'}
                  mono
                  valueClass="text-white/60"
                />
                <div className="border-t border-white/6 pt-3">
                  <StatRow label="Output Length"
                    value={`${selected.output.length.toLocaleString()} chars`}
                    mono
                  />
                </div>
              </div>

              {/* Token ratio bar */}
              {selected.usage && selected.usage.totalTokens > 0 && (
                <div className="col-span-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono text-white/25">
                    <span>Prompt {Math.round((selected.usage.promptTokens / selected.usage.totalTokens) * 100)}%</span>
                    <span>Completion {Math.round((selected.usage.completionTokens / selected.usage.totalTokens) * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/6 overflow-hidden flex">
                    <div
                      className="h-full bg-blue-500/50 rounded-l-full transition-all"
                      style={{ width: `${(selected.usage.promptTokens / selected.usage.totalTokens) * 100}%` }}
                    />
                    <div
                      className="h-full bg-[#00ff88]/40 rounded-r-full transition-all"
                      style={{ width: `${(selected.usage.completionTokens / selected.usage.totalTokens) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Output text */}
          <div className="px-6 py-5">
            <pre className={`text-sm font-mono whitespace-pre-wrap break-words leading-relaxed ${
              selected?.mode === 'structured' ? 'text-violet-200/80' : 'text-white/80'
            }`}>
              {selected?.output}
            </pre>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/8 flex items-center justify-between">
            <span className="text-[11px] text-white/20 font-mono">
              {selected ? new Date(selected.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => { if (selected) navigator.clipboard.writeText(selected.output) }}
            >
              Copy output
            </Button>
          </div>

        </div>
      </DraggableModal>
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
  const meta = node && node.data.nodeType in NODE_META
    ? NODE_META[node.data.nodeType as AgentNodeKind]
    : null

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
            <ToolForm
              config={node.data.config}
              onSave={handleSave}
              history={(node.data.runHistory ?? []) as RunHistoryEntry[]}
            />
          )}
          {node?.data.nodeType === 'memory' && (
            <MemoryForm
              config={node.data.config}
              onSave={handleSave}
              history={(node.data.runHistory ?? []) as RunHistoryEntry[]}
            />
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
