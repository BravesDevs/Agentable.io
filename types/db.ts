// Types for the DatabaseNode — schema inspection + query execution.
// Kept driver-agnostic so handlers can fan out to multiple backends.

export type DBDriver = 'postgres' | 'mysql' | 'mongodb' | 'sqlite'

export type DBMode = 'query' | 'introspect'

export interface DBNodeConfig {
  driver:           DBDriver
  connectionString: string         // user-provided; never logged verbatim
  database?:        string         // mongodb only
  mode:             DBMode
  query:            string         // SQL string, or JSON for mongo find/aggregate
  rowLimit?:        number         // applied when not already in query (default 100)
  forwardSchema?:   boolean        // include schema metadata in downstream context
  forwardRows?:     boolean        // include rows in downstream context
}

export interface DBColumn {
  name:       string
  dataType:   string
  nullable:   boolean
  isPrimary:  boolean
  isForeign?: boolean
}

export interface DBTable {
  schema:    string                // e.g. 'public'
  name:      string
  columns:   DBColumn[]
  rowCount?: number
}

export interface DBSchema {
  driver:    DBDriver
  database?: string
  tables:    DBTable[]
  fetchedAt: number
}

export interface DBQueryResult {
  columns:    string[]
  rows:       Array<Record<string, unknown>>
  rowCount:   number
  durationMs: number
  command?:   string               // SELECT | INSERT | UPDATE | DELETE …
  truncated?: boolean              // true when rowLimit kicked in
}

// Connection details are sanitized before they leave the executor.
// We keep host + database for display, but strip credentials.
export interface DBConnectionInfo {
  driver:   DBDriver
  host?:    string
  database?: string
  user?:    string                 // shown as 'u***' in UI; never the raw user
}

export interface DBRunSnapshot {
  connection:  DBConnectionInfo
  mode:        DBMode
  query:       string
  schema?:     DBSchema
  result?:     DBQueryResult
  error?:      string
  durationMs:  number
}

export const DB_DEFAULT_ROW_LIMIT = 100
