import { pgTable, uuid, text, jsonb, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core'

// ─── Flows ────────────────────────────────────────────────────────────────────

export const flows = pgTable('flows', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       text('name').notNull().default('Untitled'),
  json:       jsonb('json').notNull().default({}),
  apiToken:   text('api_token'),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
  updatedAt:  timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
})

// ─── Runs ─────────────────────────────────────────────────────────────────────
// One row per execution of a flow. File contents are never stored here —
// only metadata (filename, mime type, input type).

export const runs = pgTable('runs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  flowId:      uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }).notNull(),

  // Lifecycle
  status:      text('status').notNull().default('pending'),  // pending | running | done | error
  startedAt:   timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  durationMs:  integer('duration_ms'),

  // Input metadata — NO file contents, NO API keys
  userInput:   text('user_input'),          // text the user typed (truncated to 10 KB)
  inputType:   text('input_type'),          // text | file | image | json | url
  fileName:    text('file_name'),           // original filename only

  // Output
  finalOutput: text('final_output'),        // last output node result (truncated to 10 KB)
  error:       text('error'),               // run-level error message

  // Aggregates (for quick dashboards without joining run_nodes)
  nodeCount:   integer('node_count'),       // total nodes in the graph at run time
  totalTokens: integer('total_tokens'),     // sum of all LLM token usage in this run
})

// ─── Run nodes ────────────────────────────────────────────────────────────────
// One row per node that executed within a run.

export const runNodes = pgTable('run_nodes', {
  id:               uuid('id').primaryKey().defaultRandom(),
  runId:            uuid('run_id').references(() => runs.id, { onDelete: 'cascade' }).notNull(),

  // Identity
  nodeId:           text('node_id').notNull(),    // canvas node ID
  nodeType:         text('node_type').notNull(),   // input | prompt | llm | tool | output …
  nodeLabel:        text('node_label'),

  // Execution result
  status:           text('status').notNull(),      // done | error
  durationMs:       integer('duration_ms'),
  output:           text('output'),                // node output (truncated to 10 KB)
  error:            text('error'),

  // LLM-specific analytics (null for non-LLM nodes)
  model:            text('model'),
  mode:             text('mode'),                  // text | structured
  promptTokens:     integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens:      integer('total_tokens'),
  firstTokenMs:     integer('first_token_ms'),     // ms from request to first token

  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

// ─── Run events ───────────────────────────────────────────────────────────────
// Reserved for future fine-grained event replay. Not written to in the current MVP.

export const runEvents = pgTable('run_events', {
  id:      uuid('id').primaryKey().defaultRandom(),
  runId:   uuid('run_id').references(() => runs.id, { onDelete: 'cascade' }).notNull(),
  nodeId:  text('node_id').notNull(),
  type:    text('type').notNull(),
  payload: jsonb('payload').notNull().default({}),
})

// ─── API keys ─────────────────────────────────────────────────────────────────
// One row per (user, provider). Keys are encrypted at rest with AES-256-GCM.

export const apiKeys = pgTable(
  'api_keys',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    userId:         text('user_id').notNull(),
    provider:       text('provider').notNull(),
    keyEncrypted:   text('key_encrypted').notNull(),
    createdAt:      timestamp('created_at').notNull().defaultNow(),
    updatedAt:      timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('api_keys_user_provider_idx').on(t.userId, t.provider)],
)
