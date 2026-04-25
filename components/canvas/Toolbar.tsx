'use client'

import { Button }    from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useStore, type AgentNode, type NodeKind } from '@/store'
import { useSSERunner } from '@/hooks/useSSERunner'

// ─── Default configs per node type ───────────────────────────────────────────

const DEFAULTS: Record<NodeKind, Record<string, unknown>> = {
  input:  {},
  prompt: { template: 'You are a helpful assistant.\n\nUser: {{input}}' },
  llm:    { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7, maxTokens: 1000 },
  tool:   { method: 'GET', url: '', headers: '{}', body: '' },
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

interface ToolbarProps {
  flowId:    string | null
  flowName?: string
}

export default function Toolbar({ flowId, flowName }: ToolbarProps) {
  const addNode = useStore((s) => s.addNode)
  const nodes   = useStore((s) => s.nodes)
  const runId   = useStore((s) => s.runId)
  const { runFlow, stopRun } = useSSERunner()

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

  async function handleRun() {
    if (!flowId) return
    const userInput = window.prompt('Enter flow input:') ?? ''
    if (userInput === null) return   // user cancelled

    // Build a FlowGraph from current store state for inline execution
    const storeNodes = useStore.getState().nodes
    const storeEdges = useStore.getState().edges

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runFlow(flowId, userInput, { id: flowId, nodes: storeNodes as any, edges: storeEdges })
  }

  return (
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
          onClick={handleRun}
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
  )
}
