import type { DBNodeConfig, DBRunSnapshot } from '@/types/db'
import { DB_DEFAULT_ROW_LIMIT } from '@/types/db'
import { executeNode, parseConnectionInfo } from '@/services/db-executor'
import type { EmitFn, NodeContext } from '@/lib/types'

const OUTPUT_PAYLOAD_CAP = 100_000   // chars cap on the JSON we ship through SSE

function substitute(template: string, ctx: NodeContext): string {
  if (!template) return template
  return template
    .replace(/\{\{\s*input\s*\}\}/g,  ctx.input  ?? '')
    .replace(/\{\{\s*output\s*\}\}/g, ctx.output ?? '')
}

function clip(json: string): string {
  return json.length > OUTPUT_PAYLOAD_CAP
    ? json.slice(0, OUTPUT_PAYLOAD_CAP) + '\n…[truncated]'
    : json
}

export async function handleDatabase(
  nodeId:  string,
  config:  DBNodeConfig | undefined,
  context: NodeContext,
  emit:    EmitFn,
): Promise<NodeContext> {
  const cfg: DBNodeConfig = {
    driver:           config?.driver           ?? 'postgres',
    connectionString: config?.connectionString ?? '',
    database:         config?.database,
    mode:             config?.mode             ?? 'query',
    query:            substitute(config?.query ?? '', context),
    rowLimit:         config?.rowLimit         ?? DB_DEFAULT_ROW_LIMIT,
    forwardSchema:    config?.forwardSchema    ?? true,
    forwardRows:      config?.forwardRows      ?? true,
  }

  const t0 = Date.now()

  try {
    const { schema, result, connection } = await executeNode(cfg)
    const durationMs = Date.now() - t0

    const snap: DBRunSnapshot = {
      connection,
      mode:        cfg.mode,
      query:       cfg.query,
      ...(schema ? { schema } : {}),
      ...(result ? { result } : {}),
      durationMs,
    }

    const payload = cfg.mode === 'introspect'
      ? { tables: schema?.tables ?? [], fetchedAt: schema?.fetchedAt }
      : { columns: result?.columns ?? [], rows: result?.rows ?? [], rowCount: result?.rowCount ?? 0 }

    const json = clip(JSON.stringify(payload, null, 2))

    emit({ type: 'node-replace', nodeId, output: json })

    const next: NodeContext = { ...context, output: json, db: snap }
    if (cfg.forwardSchema && schema) next.dbSchema = schema
    if (cfg.forwardRows   && result) next.dbRows   = result.rows
    return next
  } catch (err) {
    const durationMs = Date.now() - t0
    const message    = err instanceof Error ? err.message : String(err)
    const snap: DBRunSnapshot = {
      connection: parseConnectionInfo(cfg.driver, cfg.connectionString),
      mode:       cfg.mode,
      query:      cfg.query,
      error:      message,
      durationMs,
    }
    emit({ type: 'node-replace', nodeId, output: JSON.stringify({ error: message }, null, 2) })
    throw Object.assign(new Error(message), { dbSnapshot: snap })
  }
}
