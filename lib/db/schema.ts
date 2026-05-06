import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ─── Roles ────────────────────────────────────────────────────────────────────
// Postgres ENUM. Add new roles by extending this list and running db:push.

export const roleEnum = pgEnum('role', ['admin', 'user', 'guest'])
export type Role = (typeof roleEnum.enumValues)[number]

// ─── Users ────────────────────────────────────────────────────────────────────
// PK is the Auth0 `sub` claim (e.g. `auth0|...`, `google-oauth2|...`, `github|...`).
// Storing the sub directly avoids an extra join and matches what every other table
// references via FK.

export const users = pgTable(
  'users',
  {
    id:            text('id').primaryKey(),
    email:         text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    name:          text('name'),
    picture:       text('picture'),
    role:          roleEnum('role').notNull().default('user'),
    provider:      text('provider'),                       // auth0 | google-oauth2 | github | email
    lastLoginAt:   timestamp('last_login_at'),
    createdAt:     timestamp('created_at').notNull().defaultNow(),
    updatedAt:     timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
)

// ─── Profiles ─────────────────────────────────────────────────────────────────
// Per-user preferences. Split from `users` so identity (auth-derived) stays
// distinct from app-level settings the user can edit.

export const profiles = pgTable(
  'profiles',
  {
    id:              uuid('id').primaryKey().defaultRandom(),
    userId:          text('user_id')
                       .notNull()
                       .references(() => users.id, { onDelete: 'cascade' }),
    displayName:     text('display_name'),
    bio:             text('bio'),
    avatarUrl:       text('avatar_url'),
    defaultProvider: text('default_provider'),
    defaultModel:    text('default_model'),
    preferences:     jsonb('preferences').notNull().default({}),
    createdAt:       timestamp('created_at').notNull().defaultNow(),
    updatedAt:       timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('profiles_user_idx').on(t.userId)],
)

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
    userId:         text('user_id')
                      .notNull()
                      .references(() => users.id, { onDelete: 'cascade' }),
    provider:       text('provider').notNull(),
    keyEncrypted:   text('key_encrypted').notNull(),
    createdAt:      timestamp('created_at').notNull().defaultNow(),
    updatedAt:      timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('api_keys_user_provider_idx').on(t.userId, t.provider)],
)

// ─── Vector stores ────────────────────────────────────────────────────────────
// One row per VectorNode on a flow. Holds the model + index hyperparams the
// node was configured with so the runtime can recreate query behaviour later.
// Embeddings themselves live in `embeddings`, FK'd by `storeId`.

export const vectorStores = pgTable(
  'vector_stores',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    flowId:     uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }).notNull(),
    nodeId:     text('node_id').notNull(),               // canvas node id
    name:       text('name').notNull().default('default'),
    provider:   text('provider').notNull(),              // openai | google | …
    model:      text('model').notNull(),                 // e.g. text-embedding-3-small
    dimensions: integer('dimensions').notNull(),
    indexType:  text('index_type').notNull().default('flat'),  // flat | hnsw | ivfflat
    metric:     text('metric').notNull().default('cosine'),    // cosine | l2 | dot
    config:     jsonb('config').notNull().default({}),         // hyperparams (topK, topP, …)
    createdAt:  timestamp('created_at').notNull().defaultNow(),
    updatedAt:  timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('vector_stores_flow_node_idx').on(t.flowId, t.nodeId)],
)

// ─── Embeddings ───────────────────────────────────────────────────────────────
// Vector + chunk content. `embedding` is a portable jsonb number[] so the table
// works without the pgvector extension; the service layer scores in-process.
// When pgvector is enabled the column can be migrated to vector(d) without a
// data shape change.

export const embeddings = pgTable('embeddings', {
  id:         uuid('id').primaryKey().defaultRandom(),
  storeId:    uuid('store_id').references(() => vectorStores.id, { onDelete: 'cascade' }).notNull(),
  flowId:     uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }).notNull(),
  chunkIndex: integer('chunk_index').notNull().default(0),
  content:    text('content').notNull(),
  embedding:  jsonb('embedding').notNull(),              // number[]
  metadata:   jsonb('metadata').notNull().default({}),   // { source, page, … }
  createdAt:  timestamp('created_at').notNull().defaultNow(),
})

// ─── Inferred row types ───────────────────────────────────────────────────────

export type User         = typeof users.$inferSelect
export type NewUser      = typeof users.$inferInsert
export type Profile      = typeof profiles.$inferSelect
export type NewProfile   = typeof profiles.$inferInsert
export type ApiKey       = typeof apiKeys.$inferSelect
export type VectorStore  = typeof vectorStores.$inferSelect
export type NewVectorStore = typeof vectorStores.$inferInsert
export type Embedding    = typeof embeddings.$inferSelect
export type NewEmbedding = typeof embeddings.$inferInsert
