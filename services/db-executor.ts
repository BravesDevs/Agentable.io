// Multi-driver DB executor. Currently implements Postgres via @neondatabase/serverless
// (works for both Neon hosts and any vanilla Postgres URL the driver can dial).
// Other drivers throw an explicit "not implemented" error so the UI can surface it.

import { neon } from '@neondatabase/serverless'
import type {
  DBConnectionInfo,
  DBDriver,
  DBNodeConfig,
  DBQueryResult,
  DBSchema,
  DBTable,
} from '@/types/db'
import { DB_DEFAULT_ROW_LIMIT } from '@/types/db'

// ─── Connection parsing / sanitization ───────────────────────────────────────

export function parseConnectionInfo(driver: DBDriver, raw: string): DBConnectionInfo {
  const info: DBConnectionInfo = { driver }
  if (!raw) return info
  try {
    const u = new URL(raw)
    info.host     = u.hostname || undefined
    info.database = u.pathname.replace(/^\//, '') || undefined
    if (u.username) {
      info.user = u.username.length <= 2
        ? u.username[0] + '***'
        : u.username[0] + '***' + u.username.slice(-1)
    }
  } catch {
    // Non-URL connection strings (e.g. mongo+srv with custom params): leave fields blank.
  }
  return info
}

// ─── Postgres ────────────────────────────────────────────────────────────────

interface PgColumnRow {
  table_schema:  string
  table_name:    string
  column_name:   string
  data_type:     string
  is_nullable:   string                       // 'YES' | 'NO'
  is_primary:    boolean
  is_foreign:    boolean
}

const SYSTEM_SCHEMAS = new Set(['pg_catalog', 'information_schema', 'pg_toast'])

async function introspectPostgres(connectionString: string): Promise<DBSchema> {
  const sql = neon(connectionString)
  const rows = (await sql`
    SELECT
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema   = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema    = c.table_schema
          AND tc.table_name      = c.table_name
          AND kcu.column_name    = c.column_name
      ) AS is_primary,
      EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema   = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema    = c.table_schema
          AND tc.table_name      = c.table_name
          AND kcu.column_name    = c.column_name
      ) AS is_foreign
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `) as unknown as PgColumnRow[]

  const tableMap = new Map<string, DBTable>()
  for (const r of rows) {
    if (SYSTEM_SCHEMAS.has(r.table_schema)) continue
    const key = `${r.table_schema}.${r.table_name}`
    let t = tableMap.get(key)
    if (!t) {
      t = { schema: r.table_schema, name: r.table_name, columns: [] }
      tableMap.set(key, t)
    }
    t.columns.push({
      name:      r.column_name,
      dataType:  r.data_type,
      nullable:  r.is_nullable === 'YES',
      isPrimary: r.is_primary,
      isForeign: r.is_foreign,
    })
  }

  return {
    driver:    'postgres',
    tables:    Array.from(tableMap.values()),
    fetchedAt: Date.now(),
  }
}

// Heuristic: detect the leading verb so the UI can colour SELECT vs mutating commands.
function detectCommand(query: string): string | undefined {
  const m = query.trim().match(/^(\w+)/)
  return m ? m[1].toUpperCase() : undefined
}

function applyRowLimit(query: string, limit: number): string {
  const trimmed = query.trim().replace(/;+\s*$/, '')
  // Only auto-limit SELECT-ish statements that don't already have one.
  if (!/^select\b/i.test(trimmed)) return query
  if (/\blimit\s+\d+/i.test(trimmed))   return query
  return `${trimmed} LIMIT ${limit}`
}

async function queryPostgres(connectionString: string, rawQuery: string, rowLimit: number): Promise<DBQueryResult> {
  const sql = neon(connectionString, { fullResults: true })
  const limited = applyRowLimit(rawQuery, rowLimit)

  const t0 = Date.now()
  const result = await sql.query(limited) as {
    rows:     Array<Record<string, unknown>>
    fields?:  Array<{ name: string }>
    rowCount: number
    command?: string
  }
  const durationMs = Date.now() - t0

  const columns = result.fields?.map((f) => f.name)
    ?? (result.rows[0] ? Object.keys(result.rows[0]) : [])

  return {
    columns,
    rows:       result.rows,
    rowCount:   result.rowCount ?? result.rows.length,
    durationMs,
    command:    result.command ?? detectCommand(rawQuery),
    truncated:  limited !== rawQuery,
  }
}

// ─── Public surface ──────────────────────────────────────────────────────────

export async function introspect(driver: DBDriver, connectionString: string): Promise<DBSchema> {
  if (!connectionString) throw new Error('Connection string is empty')
  switch (driver) {
    case 'postgres': return introspectPostgres(connectionString)
    case 'mysql':
    case 'mongodb':
    case 'sqlite':
      throw new Error(`Driver "${driver}" introspection is not yet supported`)
  }
}

export async function runQuery(
  driver:           DBDriver,
  connectionString: string,
  query:            string,
  rowLimit:         number = DB_DEFAULT_ROW_LIMIT,
): Promise<DBQueryResult> {
  if (!connectionString) throw new Error('Connection string is empty')
  if (!query.trim())     throw new Error('Query is empty')
  switch (driver) {
    case 'postgres': return queryPostgres(connectionString, query, rowLimit)
    case 'mysql':
    case 'mongodb':
    case 'sqlite':
      throw new Error(`Driver "${driver}" query execution is not yet supported`)
  }
}

export async function executeNode(cfg: DBNodeConfig): Promise<{
  schema?:     DBSchema
  result?:     DBQueryResult
  connection:  DBConnectionInfo
}> {
  const connection = parseConnectionInfo(cfg.driver, cfg.connectionString)
  if (cfg.mode === 'introspect') {
    const schema = await introspect(cfg.driver, cfg.connectionString)
    return { schema, connection }
  }
  const result = await runQuery(
    cfg.driver,
    cfg.connectionString,
    cfg.query,
    cfg.rowLimit ?? DB_DEFAULT_ROW_LIMIT,
  )
  return { result, connection }
}
