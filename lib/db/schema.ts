import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const flows = pgTable('flows', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       text('name').notNull().default('Untitled'),
  json:       jsonb('json').notNull().default({}),
  apiToken:   text('api_token'),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
})

export const runs = pgTable('runs', {
  id:        uuid('id').primaryKey().defaultRandom(),
  flowId:    uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }).notNull(),
  status:    text('status').notNull().default('pending'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
})

export const runEvents = pgTable('run_events', {
  id:      uuid('id').primaryKey().defaultRandom(),
  runId:   uuid('run_id').references(() => runs.id, { onDelete: 'cascade' }).notNull(),
  nodeId:  text('node_id').notNull(),
  type:    text('type').notNull(),
  payload: jsonb('payload').notNull().default({}),
})
