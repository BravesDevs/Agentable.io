import type { AgentNode, AgentNodeKind, AnnotationKind } from '@/store'

const AGENT_DEFAULTS: Record<AgentNodeKind, Record<string, unknown>> = {
  input:  { inputType: 'text' },
  prompt: { template: 'You are a helpful assistant.\n\nUser: {{input}}' },
  llm:    { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7, maxTokens: 1000 },
  tool:   { method: 'GET', url: '', headers: '{}', body: '', forwardInput: false },
  memory: { k: 10 },
  output: {},
}

const PORT_MAP: Record<AgentNodeKind, { inputs: AgentNode['data']['inputs']; outputs: AgentNode['data']['outputs'] }> = {
  input:  { inputs: [],                                                outputs: [{ id: 'text-out',    type: 'string'   }] },
  prompt: { inputs: [{ id: 'vars-in',     type: 'any' }],             outputs: [{ id: 'text-out',    type: 'string'   }] },
  llm:    { inputs: [{ id: 'messages-in', type: 'messages' }, { id: 'system-in', type: 'string' }], outputs: [{ id: 'messages-out', type: 'messages' }, { id: 'text-out', type: 'string' }] },
  tool:   { inputs: [{ id: 'trigger-in',  type: 'any' }],             outputs: [{ id: 'json-out',    type: 'json'     }] },
  memory: { inputs: [{ id: 'messages-in', type: 'messages' }],        outputs: [{ id: 'messages-out',type: 'messages' }] },
  output: { inputs: [{ id: 'text-in',     type: 'string'   }],        outputs: []                                       },
}

const AGENT_LABELS: Record<AgentNodeKind, string> = {
  input: '+ Input', prompt: '+ Prompt', llm: '+ LLM',
  tool: '+ Tool', memory: '+ Memory', output: '+ Output',
}

export const AGENT_NODE_LABELS = AGENT_LABELS

export function createAgentNode(kind: AgentNodeKind, position: { x: number; y: number }): AgentNode {
  return {
    id:       crypto.randomUUID(),
    type:     kind,
    position,
    data: {
      label:    kind.charAt(0).toUpperCase() + kind.slice(1),
      nodeType: kind,
      config:   { ...AGENT_DEFAULTS[kind] },
      ...PORT_MAP[kind],
    },
  }
}

// ─── Annotation factories ────────────────────────────────────────────────────

export function createShapeNode(
  shape: 'rectangle' | 'ellipse',
  position: { x: number; y: number },
  size: { width: number; height: number },
  color: string,
): AgentNode {
  return {
    id:       crypto.randomUUID(),
    type:     'shape',
    position,
    width:    size.width,
    height:   size.height,
    selectable: true,
    draggable:  true,
    data: {
      label:    shape === 'ellipse' ? 'Ellipse' : 'Rectangle',
      nodeType: 'shape',
      config:   { shape, color, text: '' },
      shape,
      color,
      text:     '',
      editing:  false,
      vAlign:   'center',
      hAlign:   'center',
      inputs:   [],
      outputs:  [],
    },
  }
}

export function createTextNode(
  position: { x: number; y: number },
  color: string,
  text = '',
): AgentNode {
  return {
    id:       crypto.randomUUID(),
    type:     'text',
    position,
    width:    180,
    height:   40,
    selectable: true,
    draggable:  true,
    data: {
      label:    'Text',
      nodeType: 'text',
      config:   { text, color, fontSize: 14 },
      text,
      color,
      fontSize: 14,
      inputs:   [],
      outputs:  [],
    },
  }
}

export interface DrawingPoint { x: number; y: number }

export function createDrawingNode(
  pointsAbsolute: DrawingPoint[],
  color: string,
  strokeWidth = 2,
): AgentNode | null {
  if (pointsAbsolute.length < 2) return null

  // Compute bounding box in absolute (flow) coords
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pointsAbsolute) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const pad = strokeWidth + 4
  const width  = Math.max(2, maxX - minX) + pad * 2
  const height = Math.max(2, maxY - minY) + pad * 2

  // Translate points so they sit inside the bounding box (with pad)
  const pointsLocal = pointsAbsolute.map((p) => ({
    x: p.x - minX + pad,
    y: p.y - minY + pad,
  }))

  return {
    id:       crypto.randomUUID(),
    type:     'drawing',
    position: { x: minX - pad, y: minY - pad },
    width,
    height,
    selectable: true,
    draggable:  true,
    data: {
      label:    'Drawing',
      nodeType: 'drawing',
      config:   { points: pointsLocal, color, strokeWidth, viewBoxW: width, viewBoxH: height },
      points:   pointsLocal,
      color,
      strokeWidth,
      viewBoxW: width,
      viewBoxH: height,
      inputs:   [],
      outputs:  [],
    },
  }
}

export function isAnnotationNodeKind(kind: string | undefined): kind is AnnotationKind {
  return kind === 'shape' || kind === 'text' || kind === 'drawing'
}
