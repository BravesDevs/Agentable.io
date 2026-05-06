import type { AgentNode, AgentEdge } from '@/store'

export interface SampleWorkflow {
  id:          string
  name:        string
  tagline:     string
  description: string
  tags:        string[]
  graph:       { nodes: AgentNode[]; edges: AgentEdge[] }
}

// Stable IDs so the cloned graph round-trips and is easier to read in storage.
const ids = {
  noteHeader:  'note-header',
  noteIndex:   'note-index',
  noteQuery:   'note-query',
  fileInput:   'input-csv',
  fileEmbed:   'embed-index',
  vecIndex:    'vector-index',
  textInput:   'input-question',
  queryEmbed:  'embed-query',
  vecQuery:    'vector-query',
  llm:         'llm-answer',
  output:      'output-final',
} as const

const STORE_NAME = 'csv-knowledge-base'

const csvRagFlow = {
  nodes: [
    // ── Header annotation ─────────────────────────────────────────────────
    {
      id:       ids.noteHeader,
      type:     'text',
      position: { x: 80, y: 40 },
      width:    560,
      height:   72,
      selectable: true,
      draggable:  true,
      data: {
        label:    'Text',
        nodeType: 'text',
        config:   {
          text:
            'RAG over CSV — vectorize a CSV with an embedding model, then ' +
            'query the same store with the same model to ground the LLM.',
          color:    '#facc15',
          fontSize: 14,
        },
        text:
          'RAG over CSV — vectorize a CSV with an embedding model, then ' +
          'query the same store with the same model to ground the LLM.',
        color:    '#facc15',
        fontSize: 14,
        inputs:   [],
        outputs:  [],
      },
    },

    // ── Indexing path ────────────────────────────────────────────────────
    {
      id:       ids.noteIndex,
      type:     'text',
      position: { x: 80, y: 150 },
      width:    280,
      height:   48,
      selectable: true,
      draggable:  true,
      data: {
        label:    'Text',
        nodeType: 'text',
        config: {
          text:    '① Index — upload a CSV file as input',
          color:   '#a3e635',
          fontSize: 13,
        },
        text:    '① Index — upload a CSV file as input',
        color:   '#a3e635',
        fontSize: 13,
        inputs:  [],
        outputs: [],
      },
    },
    {
      id:       ids.fileInput,
      type:     'input',
      position: { x: 80, y: 220 },
      data: {
        label:    'CSV File',
        nodeType: 'input',
        config:   {
          inputType:         'file',
          maxSizeKB:         5120,
          allowedExtensions: ['.csv', '.tsv', '.txt'],
        },
        inputs:  [],
        outputs: [{ id: 'text-out', type: 'string' }],
      },
    },
    {
      id:       ids.fileEmbed,
      type:     'embedding',
      position: { x: 380, y: 220 },
      data: {
        label:    'Embed CSV',
        nodeType: 'embedding',
        config: {
          provider:     'openai',
          model:        'text-embedding-3-small',
          dimensions:   1536,
          chunkSize:    512,
          chunkOverlap: 64,
          sourceField:  'auto',
        },
        inputs:  [{ id: 'source-in', type: 'any' }],
        outputs: [{ id: 'vectors-out', type: 'json' }],
      },
    },
    {
      id:       ids.vecIndex,
      type:     'vector',
      position: { x: 680, y: 220 },
      data: {
        label:    'Index Store',
        nodeType: 'vector',
        config: {
          storeName:  STORE_NAME,
          indexType:  'flat',
          metric:     'cosine',
          mode:       'index',
          topK:       5,
          topP:       0,
          injectInto: 'context',
          replace:    false,
        },
        inputs:  [{ id: 'vectors-in', type: 'any' }],
        outputs: [
          { id: 'context-out', type: 'string' },
          { id: 'json-out',    type: 'json'   },
        ],
      },
    },

    // ── Query path ───────────────────────────────────────────────────────
    {
      id:       ids.noteQuery,
      type:     'text',
      position: { x: 80, y: 380 },
      width:    320,
      height:   48,
      selectable: true,
      draggable:  true,
      data: {
        label:    'Text',
        nodeType: 'text',
        config: {
          text:    '② Ask — type a question to retrieve & answer',
          color:   '#60a5fa',
          fontSize: 13,
        },
        text:    '② Ask — type a question to retrieve & answer',
        color:   '#60a5fa',
        fontSize: 13,
        inputs:  [],
        outputs: [],
      },
    },
    {
      id:       ids.textInput,
      type:     'input',
      position: { x: 80, y: 450 },
      data: {
        label:    'Question',
        nodeType: 'input',
        config:   { inputType: 'text' },
        inputs:   [],
        outputs:  [{ id: 'text-out', type: 'string' }],
      },
    },
    {
      id:       ids.queryEmbed,
      type:     'embedding',
      position: { x: 380, y: 450 },
      data: {
        label:    'Embed Query',
        nodeType: 'embedding',
        config: {
          provider:     'openai',
          model:        'text-embedding-3-small',
          dimensions:   1536,
          chunkSize:    512,
          chunkOverlap: 64,
          sourceField:  'auto',
        },
        inputs:  [{ id: 'source-in', type: 'any' }],
        outputs: [{ id: 'vectors-out', type: 'json' }],
      },
    },
    {
      id:       ids.vecQuery,
      type:     'vector',
      position: { x: 680, y: 450 },
      data: {
        label:    'Retrieve',
        nodeType: 'vector',
        config: {
          storeName:  STORE_NAME,
          indexType:  'flat',
          metric:     'cosine',
          mode:       'query',
          topK:       5,
          topP:       0,
          injectInto: 'context',
        },
        inputs:  [{ id: 'vectors-in', type: 'any' }],
        outputs: [
          { id: 'context-out', type: 'string' },
          { id: 'json-out',    type: 'json'   },
        ],
      },
    },
    {
      id:       ids.llm,
      type:     'llm',
      position: { x: 980, y: 450 },
      data: {
        label:    'LLM',
        nodeType: 'llm',
        config: {
          provider:    'anthropic',
          model:       'claude-sonnet-4-6',
          temperature: 0.2,
          maxTokens:   1000,
          systemPrompt:
            'You answer using only the retrieved CSV context. ' +
            'Cite specific row values; if the answer is not in context, say so.',
        },
        inputs: [
          { id: 'messages-in', type: 'messages' },
          { id: 'system-in',   type: 'string'   },
        ],
        outputs: [
          { id: 'messages-out', type: 'messages' },
          { id: 'text-out',     type: 'string'   },
        ],
      },
    },
    {
      id:       ids.output,
      type:     'output',
      position: { x: 1280, y: 450 },
      data: {
        label:    'Answer',
        nodeType: 'output',
        config:   {},
        inputs:   [{ id: 'text-in', type: 'string' }],
        outputs:  [],
      },
    },
  ] satisfies AgentNode[],

  edges: [
    { id: 'e1', source: ids.fileInput,  sourceHandle: 'text-out',    target: ids.fileEmbed,  targetHandle: 'source-in'   },
    { id: 'e2', source: ids.fileEmbed,  sourceHandle: 'vectors-out', target: ids.vecIndex,   targetHandle: 'vectors-in'  },
    { id: 'e3', source: ids.textInput,  sourceHandle: 'text-out',    target: ids.queryEmbed, targetHandle: 'source-in'   },
    { id: 'e4', source: ids.queryEmbed, sourceHandle: 'vectors-out', target: ids.vecQuery,   targetHandle: 'vectors-in'  },
    { id: 'e5', source: ids.vecQuery,   sourceHandle: 'context-out', target: ids.llm,        targetHandle: 'messages-in' },
    { id: 'e6', source: ids.llm,        sourceHandle: 'text-out',    target: ids.output,     targetHandle: 'text-in'     },
  ] satisfies AgentEdge[],
}

export const SAMPLE_WORKFLOWS: SampleWorkflow[] = [
  {
    id:      'rag-csv-embedding',
    name:    'RAG over CSV',
    tagline: 'Vectorize a CSV, then ask questions grounded in the data',
    description:
      'Upload a CSV to embed and store as vectors, then ask natural-language ' +
      'questions. The same embedding model is used for indexing and querying so ' +
      'similarity scoring is consistent end-to-end.',
    tags:  ['RAG', 'Embedding', 'Vector Store', 'CSV'],
    graph: csvRagFlow,
  },
]

export function getSampleWorkflow(id: string): SampleWorkflow | undefined {
  return SAMPLE_WORKFLOWS.find((w) => w.id === id)
}
