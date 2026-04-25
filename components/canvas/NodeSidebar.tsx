'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useShallow } from 'zustand/react/shallow'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
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
import { useStore, type NodeKind } from '@/store'

// Monaco must not run on the server
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

// ─── Zod schemas per node type ────────────────────────────────────────────────

const llmSchema = z.object({
  model:       z.enum(['claude-sonnet-4-6', 'claude-opus-4-7', 'gpt-4o', 'gpt-4o-mini']),
  temperature: z.number().min(0).max(1),
  maxTokens:   z.number().min(100).max(8000),
})

const promptSchema = z.object({
  template: z.string(),
})

const toolSchema = z.object({
  method:  z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  url:     z.string(),
  headers: z.string(),
  body:    z.string(),
})

const memorySchema = z.object({
  k: z.number().min(1).max(100),
})

type LLMForm    = z.infer<typeof llmSchema>
type PromptForm = z.infer<typeof promptSchema>
type ToolForm   = z.infer<typeof toolSchema>
type MemoryForm = z.infer<typeof memorySchema>

const NODE_LABELS: Record<NodeKind, string> = {
  input:   'Input',
  prompt:  'Prompt',
  llm:     'LLM',
  tool:    'Tool',
  memory:  'Memory',
  output:  'Output',
}

// ─── Sub-forms ────────────────────────────────────────────────────────────────

function LLMForm({ config, onSave }: { config: Record<string, unknown>; onSave: (v: LLMForm) => void }) {
  const { register, handleSubmit, watch, setValue } = useForm<LLMForm>({
    resolver: zodResolver(llmSchema),
    defaultValues: {
      model:       (config.model       as LLMForm['model'])  ?? 'claude-sonnet-4-6',
      temperature: (config.temperature as number)            ?? 0.7,
      maxTokens:   (config.maxTokens   as number)            ?? 1000,
    },
  })

  const temp      = watch('temperature')
  const maxTokens = watch('maxTokens')

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-5">
      <div className="space-y-1.5">
        <Label>Model</Label>
        <Select
          defaultValue={(config.model as string) ?? 'claude-sonnet-4-6'}
          onValueChange={(v) => setValue('model', v as LLMForm['model'])}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
            <SelectItem value="claude-opus-4-7">Claude Opus 4.7</SelectItem>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Label>Temperature</Label>
          <span className="text-xs text-gray-500">{temp.toFixed(2)}</span>
        </div>
        <Slider
          min={0} max={1} step={0.01}
          defaultValue={[temp]}
          onValueChange={([v]) => setValue('temperature', v)}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Label>Max tokens</Label>
          <span className="text-xs text-gray-500">{maxTokens}</span>
        </div>
        <Slider
          min={100} max={8000} step={100}
          defaultValue={[maxTokens]}
          onValueChange={([v]) => setValue('maxTokens', v)}
        />
      </div>

      <input type="hidden" {...register('model')} />
      <Button type="submit" size="sm" className="w-full">Save</Button>
    </form>
  )
}

function PromptForm({ config, onSave }: { config: Record<string, unknown>; onSave: (v: PromptForm) => void }) {
  const template   = (config.template as string) ?? ''
  const [val, setVal] = useState(template)
  const vars = (val.match(/\{\{(\w+)\}\}/g) ?? []).map((m) => m.replace(/\{|\}/g, ''))

  return (
    <div className="space-y-4">
      <Label>Template</Label>
      <MonacoEditor
        height={200}
        language="handlebars"
        theme="vs-light"
        value={val}
        onChange={(v) => setVal(v ?? '')}
        options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', wordWrap: 'on' }}
      />
      {vars.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {[...new Set(vars)].map((v) => (
            <Badge key={v} variant="secondary">{'{{' + v + '}}'}</Badge>
          ))}
        </div>
      )}
      <Button size="sm" className="w-full" onClick={() => onSave({ template: val })}>Save</Button>
    </div>
  )
}

function ToolForm({ config, onSave }: { config: Record<string, unknown>; onSave: (v: ToolForm) => void }) {
  const { register, handleSubmit, setValue } = useForm<ToolForm>({
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
      <div className="space-y-1.5">
        <Label>Method</Label>
        <Select
          defaultValue={(config.method as string) ?? 'GET'}
          onValueChange={(v) => setValue('method', v as ToolForm['method'])}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(['GET','POST','PUT','DELETE'] as const).map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>URL</Label>
        <Input {...register('url')} placeholder="https://api.example.com/endpoint" />
      </div>
      <div className="space-y-1.5">
        <Label>Headers (JSON)</Label>
        <Textarea {...register('headers')} placeholder='{"Authorization":"Bearer ..."}' rows={3} className="font-mono text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label>Body (JSON)</Label>
        <Textarea {...register('body')} placeholder='{"query":"{{input}}"}' rows={3} className="font-mono text-xs" />
      </div>
      <Button type="submit" size="sm" className="w-full">Save</Button>
    </form>
  )
}

function MemoryForm({ config, onSave }: { config: Record<string, unknown>; onSave: (v: MemoryForm) => void }) {
  const [k, setK] = useState((config.k as number) ?? 10)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Label>Keep last k messages</Label>
          <span className="text-xs text-gray-500">{k}</span>
        </div>
        <Slider min={1} max={100} step={1} defaultValue={[k]} onValueChange={([v]) => setK(v)} />
      </div>
      <Button size="sm" className="w-full" onClick={() => onSave({ k })}>Save</Button>
    </div>
  )
}

// ─── NodeSidebar ──────────────────────────────────────────────────────────────

export default function NodeSidebar() {
  const { selectedNodeId, sidebarOpen, closeSidebar } = useStore(useShallow((s) => ({
    selectedNodeId: s.selectedNodeId,
    sidebarOpen:    s.sidebarOpen,
    closeSidebar:   s.closeSidebar,
  })))

  const nodes        = useStore(useShallow((s) => s.nodes))
  const updateNodeData = useStore((s) => s.updateNodeData)

  const node = nodes.find((n) => n.id === selectedNodeId)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setSaved(false) }, [selectedNodeId])

  function handleSave(config: Record<string, unknown>) {
    if (!selectedNodeId) return
    updateNodeData(selectedNodeId, { config })
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  return (
    <Sheet open={sidebarOpen} onOpenChange={(open) => { if (!open) closeSidebar() }}>
      <SheetContent side="right" className="w-[380px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center justify-between">
            {node ? NODE_LABELS[node.data.nodeType] : 'Node'}
            {saved && <Badge variant="secondary" className="text-green-600 bg-green-50">Saved</Badge>}
          </SheetTitle>
        </SheetHeader>

        {!node && <p className="text-sm text-gray-400">No node selected.</p>}

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
        {(node?.data.nodeType === 'input' || node?.data.nodeType === 'output') && (
          <p className="text-sm text-gray-400">No configuration needed.</p>
        )}
      </SheetContent>
    </Sheet>
  )
}
