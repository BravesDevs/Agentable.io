'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserMenu } from './UserMenu'

const NAV_LINKS = [
  { href: '#features',   label: 'Features'  },
  { href: '#how',        label: 'How it works' },
  { href: '#flow',       label: 'Flow' },
  { href: '#footer',     label: 'About' },
] as const

const FEATURES = [
  {
    title: 'Visual Canvas',
    body : 'Drag-and-drop nodes powered by React Flow. Typed Zod ports prevent invalid wiring at design time.',
  },
  {
    title: 'MCP-First',
    body : 'Native Model Context Protocol support — paste a server URL, the tools auto-render as configurable forms.',
  },
  {
    title: 'Live Streaming',
    body : 'Server-Sent Events stream token-by-token output into the canvas while a flow runs.',
  },
  {
    title: 'One-Click Deploy',
    body : 'Every saved flow exposes a public REST endpoint with rate-limited, token-authenticated access.',
  },
  {
    title: 'TypeScript Native',
    body : 'Built on Mastra. The canvas JSON round-trips cleanly to and from Mastra’s serialized step graph.',
  },
  {
    title: 'Observability',
    body : 'Drop-in Langfuse traces — every token, tool call, node duration, and cost in one trace tree.',
  },
] as const

const FLOW_NODES = [
  { id: 'input',  x: 40,  y: 110, label: 'Input',  kind: 'I/O' },
  { id: 'prompt', x: 220, y: 60,  label: 'Prompt', kind: 'Logic' },
  { id: 'rag',    x: 220, y: 160, label: 'RAG',    kind: 'Data' },
  { id: 'llm',    x: 420, y: 110, label: 'LLM',    kind: 'Model' },
  { id: 'guard',  x: 600, y: 60,  label: 'Guard',  kind: 'Safety' },
  { id: 'mcp',    x: 600, y: 160, label: 'MCP',    kind: 'Tools' },
  { id: 'output', x: 780, y: 110, label: 'Output', kind: 'I/O' },
] as const

const FLOW_EDGES = [
  ['input', 'prompt'],
  ['input', 'rag'],
  ['prompt', 'llm'],
  ['rag', 'llm'],
  ['llm', 'guard'],
  ['llm', 'mcp'],
  ['guard', 'output'],
  ['mcp', 'output'],
] as const

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] font-mono selection:bg-white/15">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,#21262d_0%,transparent_60%),linear-gradient(180deg,#0d1117_0%,#010409_100%)]"
      />
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <InteractiveFlow />
      <Footer />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Nav                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0d1117]/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="#top" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <LogoMark />
          <span>Agentable</span>
        </Link>

        <ul className="hidden md:flex items-center gap-7 text-[13px] text-[#9198a1]">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="hover:text-white transition-colors">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {/* Show UserMenu (which conditionally shows sign in/register or user dropdown) */}
          <UserMenu />
        </div>
      </nav>
    </header>
  )
}

function LogoMark() {
  return (
    <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-white to-[#9198a1] text-[#0d1117] text-[11px] font-bold">
      A
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Hero                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-6xl px-6 pt-24 pb-32 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[#9198a1]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#3fb950]" />
        v0.1 — public preview
      </div>

      <h1 className="mt-6 bg-gradient-to-b from-white via-[#e6edf3] to-[#9198a1] bg-clip-text text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight text-transparent">
        Build AI agents
        <br />
        like you sketch flowcharts.
      </h1>

      <p className="mt-6 text-base md:text-lg text-[#9198a1] max-w-2xl mx-auto">
        TypeScript-native visual agent builder. Drag nodes, wire typed ports,
        watch tokens stream live, deploy with one click.
      </p>

      <p className="mt-3 text-sm text-[#6e7681] max-w-xl mx-auto">
        MCP-first. Zod-typed. Mastra under the hood. Free during preview.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/canvas"
          className="px-5 py-2.5 rounded-md text-sm font-medium bg-gradient-to-b from-[#f6f8fa] to-[#d1d9e0] text-[#0d1117] border border-white/20 hover:from-white hover:to-[#e6edf3] transition-colors"
        >
          Open the canvas →
        </Link>
        <a
          href="#flow"
          className="px-5 py-2.5 rounded-md text-sm font-medium border border-white/15 bg-white/5 hover:bg-white/10 transition-colors"
        >
          See it in action
        </a>
      </div>

      <div className="mt-20 grid grid-cols-3 gap-8 text-center max-w-2xl mx-auto">
        {[
          ['9', 'Node types'],
          ['40+', 'LLM providers'],
          ['<50ms', 'Token latency'],
        ].map(([n, l]) => (
          <div key={l}>
            <div className="text-2xl md:text-3xl font-semibold text-white">{n}</div>
            <div className="mt-1 text-xs text-[#6e7681] uppercase tracking-wider">{l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Features                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function Features() {
  return (
    <Section id="features" eyebrow="Features" title="Everything an agent needs.">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px rounded-xl overflow-hidden border border-white/10 bg-white/5">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group relative bg-[#0d1117] p-6 hover:bg-gradient-to-b hover:from-[#161b22] hover:to-[#0d1117] transition-colors"
          >
            <h3 className="text-sm font-semibold text-white">{f.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#9198a1]">{f.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  How it works                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    { n: '01', t: 'Drag nodes',     d: 'Pick from Input, Prompt, LLM, RAG, MCP, Memory, Guard, Output.' },
    { n: '02', t: 'Wire ports',     d: 'Typed Zod ports — invalid connections are blocked at design time.' },
    { n: '03', t: 'Run live',       d: 'Hit run, watch tokens stream into each node via Server-Sent Events.' },
    { n: '04', t: 'Ship endpoint',  d: 'Save the flow. POST /api/v1/flows/:id/run is now public, rate-limited.' },
  ]
  return (
    <Section id="how" eyebrow="Workflow" title="From idea to API in under five minutes.">
      <ol className="relative grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5 md:grid-cols-4">
        {steps.map((s) => (
          <li key={s.n} className="bg-[#0d1117] p-6">
            <div className="text-[11px] font-mono text-[#6e7681]">{s.n}</div>
            <div className="mt-3 text-sm font-semibold text-white">{s.t}</div>
            <div className="mt-2 text-[13px] leading-relaxed text-[#9198a1]">{s.d}</div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Interactive Flow Diagram                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function InteractiveFlow() {
  const [active,  setActive]  = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const path = (a: typeof FLOW_NODES[number], b: typeof FLOW_NODES[number]) => {
    const ax = a.x + 110
    const ay = a.y + 28
    const bx = b.x
    const by = b.y + 28
    const mx = (ax + bx) / 2
    return `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`
  }

  const isEdgeActive = (from: string, to: string) =>
    running || active === from || active === to

  return (
    <Section id="flow" eyebrow="Demo" title="An interactive look at a typical flow.">
      <p className="text-sm text-[#9198a1] mb-6">
        Hover a node to highlight its connections. Press{' '}
        <span className="text-white">Run</span> to animate the graph.
      </p>

      <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#161b22] to-[#0d1117] p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs text-[#6e7681]">
            <span className="h-2 w-2 rounded-full bg-[#f85149]" />
            <span className="h-2 w-2 rounded-full bg-[#d29922]" />
            <span className="h-2 w-2 rounded-full bg-[#3fb950]" />
            <span className="ml-2">flow.json</span>
          </div>
          <button
            onClick={() => {
              setRunning(true)
              setTimeout(() => setRunning(false), 2400)
            }}
            disabled={running}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            {running ? 'Running…' : '▶ Run'}
          </button>
        </div>

        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox="0 0 900 280"
            className="w-full min-w-[760px] h-[280px]"
            role="img"
            aria-label="Agent flow diagram"
          >
            <defs>
              <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#6e7681" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#e6edf3" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="edgeRun" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#9198a1" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>

            {FLOW_EDGES.map(([from, to]) => {
              const a = FLOW_NODES.find((n) => n.id === from)!
              const b = FLOW_NODES.find((n) => n.id === to)!
              const on = isEdgeActive(from, to)
              return (
                <path
                  key={`${from}-${to}`}
                  d={path(a, b)}
                  fill="none"
                  stroke={on ? 'url(#edgeRun)' : 'url(#edgeGrad)'}
                  strokeWidth={on ? 1.8 : 1.2}
                  strokeDasharray={on ? '6 4' : undefined}
                  className={on ? 'animate-[edge-flow_0.6s_linear_infinite]' : ''}
                  style={{ transition: 'stroke 200ms' }}
                />
              )
            })}

            {FLOW_NODES.map((n) => {
              const focused = active === n.id
              const isRunning = running
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onMouseEnter={() => setActive(n.id)}
                  onMouseLeave={() => setActive(null)}
                  className="cursor-pointer"
                >
                  <rect
                    width="110"
                    height="56"
                    rx="8"
                    fill={focused ? '#21262d' : '#161b22'}
                    stroke={focused || isRunning ? '#e6edf3' : '#30363d'}
                    strokeWidth={focused ? 1.5 : 1}
                    style={{ transition: 'all 200ms' }}
                  />
                  <text
                    x="12"
                    y="22"
                    fill="#9198a1"
                    fontSize="9"
                    fontFamily="monospace"
                    letterSpacing="1"
                  >
                    {n.kind.toUpperCase()}
                  </text>
                  <text
                    x="12"
                    y="42"
                    fill="#e6edf3"
                    fontSize="14"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {n.label}
                  </text>
                  <circle cx="0"   cy="28" r="3" fill="#6e7681" />
                  <circle cx="110" cy="28" r="3" fill="#6e7681" />
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-[#6e7681]">
          <Legend swatch="#161b22" label="Node" />
          <Legend swatch="#21262d" label="Hovered" />
          <Legend swatch="#e6edf3" label="Active edge" />
          <Legend swatch="#3fb950" label="Run status" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes edge-flow {
          from { stroke-dashoffset: 20; }
          to   { stroke-dashoffset:  0; }
        }
      `}</style>
    </Section>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rounded-sm border border-white/10"
        style={{ background: swatch }}
      />
      <span>{label}</span>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Footer                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer
      id="footer"
      className="border-t border-white/8 bg-gradient-to-b from-transparent to-[#010409]"
    >
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-2 text-sm">
            <LogoMark />
            <span className="font-semibold">Agentable</span>
            <span className="text-[#6e7681]">— visual agents for TypeScript.</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/BravesDevs/Agentable"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <GitHubIcon />
              <span>GitHub Repo</span>
              <span className="text-[#6e7681]">↗</span>
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[11px] text-[#6e7681]">
          <span>© 2026 Agentable. MIT licensed.</span>
          <div className="flex items-center gap-4">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how"      className="hover:text-white transition-colors">How it works</a>
            <a href="#flow"     className="hover:text-white transition-colors">Demo</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Section primitive                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id      : string
  eyebrow : string
  title   : string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 mx-auto max-w-6xl px-6 py-20 border-t border-white/5">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#6e7681]">{eyebrow}</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight bg-gradient-to-b from-white to-[#9198a1] bg-clip-text text-transparent">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}
