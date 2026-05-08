# Agentable — Visual AI Agent Builder

A TypeScript-native drag-and-drop canvas for building, running, and deploying AI agents. Wire up LLMs, tools, memory, and file inputs visually — then ship as a live REST endpoint in one click.

## Features

- **Visual canvas** — drag-and-drop nodes, animated SSE edge flow, real-time status indicators
- **Multi-modal inputs** — Text, File (PDF, CSV, Excel, PPTX, code…), Image (vision), JSON, URL
- **Live streaming** — tokens stream token-by-token into LLM nodes as they're generated
- **Multi-provider LLMs** — Claude (Sonnet 4.6, Opus 4.7) and OpenAI (GPT-4o, GPT-4o mini) via Vercel AI SDK
- **Tool nodes** — HTTP calls (GET/POST/PUT/DELETE) with response preview inline
- **Output history** — every run saved; click any output node to browse past results
- **SSE protocol** — `node-start` → `node-delta` → `node-end` → `run-complete` events
- **Autosave** — graph persisted to Postgres (Neon) on every change with 600ms debounce
- **REST endpoint** — every flow gets `POST /api/v1/flows/:id/run` out of the box

---

## Tech Stack

| Layer | Package |
|---|---|
| Framework | Next.js 16.2.4 (App Router) |
| Canvas | `@xyflow/react` v12 |
| State | `zustand` + `useShallow` |
| LLMs | `ai` (Vercel AI SDK v6) + `@ai-sdk/anthropic` + `@ai-sdk/openai` |
| Agent runtime | `@mastra/core` |
| Schema validation | `zod` |
| Database | `@neondatabase/serverless` + `drizzle-orm` |
| MCP protocol | `@modelcontextprotocol/sdk` |
| Observability | `langfuse` |
| Rate limiting | `@upstash/ratelimit` |
| UI components | `shadcn/ui` + Tailwind CSS v4 |
| Code editor | `@monaco-editor/react` |
| Forms | `react-hook-form` + `@hookform/resolvers` |

---

## Local Setup

### Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- A [Neon](https://neon.tech) Postgres database (free tier works)
- An Anthropic API key and/or OpenAI API key
- An [Auth0](https://auth0.com) tenant (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/BravesDevs/Agentable.io.git
cd Agentable.io
pnpm install
```

### 2. Environment variables

Copy `sample.env` to `.env.local` in the project root:

```bash
cp sample.env .env.local
```

Then fill in each value. Here's where to get them:

```env
# Database — Neon serverless Postgres
# Get from: https://console.neon.tech → create project → Connection Details → copy the pooled connection string
DATABASE_URL="postgres://user:password@ep-xxx.neon.tech/dbname?sslmode=require"

# Anthropic (Claude) API key
# Get from: https://console.anthropic.com/settings/keys → "Create Key"
ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI API key
# Get from: https://platform.openai.com/api-keys → "Create new secret key"
OPENAI_API_KEY="sk-..."

# Secret used to sign/verify per-flow API tokens for the public /api/v1/flows/:id/run endpoint
# Generate locally with: `openssl rand -hex 32`
API_KEY_SECRET="<random-64-char-hex-string>"

# Local development user id (single-user mode — matches NEXT_PUBLIC_DEV_USER_ID convention)
# Any non-empty string works for local dev, e.g. "demo" or your email
DEV_USER_ID="demo"

# Auth0 Configuration
# Create a tenant at https://manage.auth0.com → Applications → Create Application
# Choose "Regular Web Application" and grab the values from the application's Settings tab.
AUTH0_DOMAIN="your-tenant.us.auth0.com"   # Settings → Domain
CLIENT_ID="..."                            # Settings → Client ID
CLIENT_SECRET="..."                        # Settings → Client Secret
```

> **Tip:** Never commit `.env.local`. It's already gitignored. The `sample.env` file in the repo is the source of truth for the variable list — keep it in sync if you add new vars.

### 3. Push the database schema

```bash
pnpm db:push
```

This creates three tables: `flows`, `runs`, `run_events` plus a `pgvector` embeddings table for RAG.

### 4. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Running a Flow

1. **Add nodes** from the toolbar — Input, LLM, Output is the minimal working graph
2. **Connect them** — drag from the bottom handle of one node to the top handle of the next
3. **Configure** — click any node to open the sidebar:
   - **Input node**: choose input type (Text / File / Image / JSON / URL), set allowed file extensions and max size
   - **LLM node**: pick provider + model, set temperature, max tokens, and system prompt
   - **Tool node**: set HTTP method, URL, headers, and body template
4. **Click ▶ Run** — a dialog collects your input (text box, file picker, or image upload depending on type)
5. Watch tokens stream live into the LLM node; the Output node shows the result with a run history

---

## Node Types

| Node | Description |
|---|---|
| **Input** | Entry point — accepts Text, File, Image, JSON, or URL |
| **Prompt** | Handlebars template that interpolates `{{input}}` and other variables |
| **LLM** | Calls Claude or GPT with streaming; shows thinking dots + live token count |
| **Tool** | HTTP request node with inline response/status preview |
| **Memory** | Conversation buffer — keeps last N turns in context |
| **Output** | Captures final result; click to browse full run history |

---

## Supported File Types (Input node)

| Category | Extensions |
|---|---|
| Documents | `.pdf` `.doc` `.docx` `.odt` `.rtf` `.txt` `.md` |
| Spreadsheets | `.csv` `.tsv` `.xls` `.xlsx` `.ods` `.numbers` |
| Presentations | `.ppt` `.pptx` `.odp` `.key` |
| Data & Config | `.json` `.yaml` `.yml` `.toml` `.xml` `.env` `.ini` `.sql` |
| Code | `.py` `.js` `.ts` `.jsx` `.tsx` `.html` `.css` `.sh` `.rb` `.go` `.rs` `.java` `.c` `.cpp` |
| Images (vision) | `.jpg` `.jpeg` `.png` `.webp` `.gif` `.svg` |

Images are passed as multimodal content to vision-capable models. Text and structured files are decoded and embedded in the prompt. Max upload size is configurable per node (default 5 MB).

---

## API

Every saved flow exposes a public REST endpoint:

```bash
curl -X POST http://localhost:3000/api/v1/flows/<flow-id>/run \
  -H "Content-Type: application/json" \
  -d '{"input": "Summarise this for me"}'
```

The response is an SSE stream:

```
event: node-start
data: {"nodeId":"llm-1","timestamp":1234567890}

event: node-delta
data: {"nodeId":"llm-1","token":"Hello"}

event: node-end
data: {"nodeId":"llm-1","status":"done","durationMs":1240}

event: run-complete
data: {"runId":"abc","status":"done"}
```

---

## Project Structure

```
agentable/
├── app/
│   ├── page.tsx                      # Canvas page
│   └── api/v1/
│       ├── flows/[id]/run/route.ts   # POST — start a run
│       └── runs/[id]/stream/route.ts # GET  — SSE event stream
├── components/
│   ├── canvas/
│   │   ├── Canvas.tsx                # ReactFlow wrapper
│   │   ├── Toolbar.tsx               # Node palette + Run dialog
│   │   └── NodeSidebar.tsx           # Per-node config panel
│   └── nodes/                        # One component per node type
├── store/index.ts                    # Zustand store (graph + run + ui)
├── hooks/
│   ├── useSSERunner.ts               # EventSource → Zustand
│   └── useFlowPersist.ts             # Debounced autosave
├── lib/
│   ├── types.ts                      # Shared types (FlowGraph, FileData, SSEEvent…)
│   ├── runtime/
│   │   ├── execute.ts                # Graph executor (topological walk)
│   │   ├── topoSort.ts               # Kahn's algorithm
│   │   └── handlers/                 # llm.ts  input.ts  prompt.ts  output.ts
│   └── db/
│       ├── schema.ts                 # Drizzle schema
│       └── client.ts                 # Neon client
└── drizzle.config.ts
```

---

## Commands

```bash
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build
pnpm start        # Start production server
pnpm db:push      # Push Drizzle schema to Neon
pnpm db:studio    # Open Drizzle Studio (database browser)
eslint            # Lint (flat config)
```

---

## License

MIT
