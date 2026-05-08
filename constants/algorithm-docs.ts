// Reference docs for vector index algorithms surfaced by AlgorithmInfoModal.
// Diagrams are ASCII; formulas are LaTeX source paired with a Unicode-rendered
// plain-text fallback so the modal stays dependency-free.

export interface AlgorithmFormula {
  label: string
  latex: string
  plain: string
  note?: string
}

export interface AlgorithmDoc {
  key:        string
  name:       string
  tagline:    string
  complexity: { build: string; query: string; memory: string }
  diagram:    string
  useCases:   string[]
  formulas:   AlgorithmFormula[]
  tracing:    string[]
}

const FLAT: AlgorithmDoc = {
  key:     'flat',
  name:    'Flat (Brute-Force Exact Search)',
  tagline: 'Compare the query against every stored vector — perfect recall, no index structure.',
  complexity: {
    build:  'O(1) — vectors appended as-is',
    query:  'O(N · d) per search',
    memory: 'O(N · d) — raw vectors only',
  },
  diagram: `query q ──┐
            │   compare against every vector
            ▼
   ┌────┬────┬────┬────┬────┬────┬────┐
   │ v1 │ v2 │ v3 │ v4 │ v5 │ …  │ vN │
   └─┬──┴─┬──┴─┬──┴─┬──┴─┬──┴────┴─┬──┘
     │    │    │    │    │         │
     ▼    ▼    ▼    ▼    ▼         ▼
   sim  sim  sim  sim  sim  …    sim
            │
            ▼
       sort desc, take top-K`,
  useCases: [
    'Small corpora (≤ ~50k vectors) where exact recall matters more than latency.',
    'Evaluation baseline — compare an ANN index against ground truth from Flat.',
    'Highly volatile data where rebuilding an ANN index every write would dominate cost.',
    'Compliance / audit queries that cannot tolerate approximate misses.',
  ],
  formulas: [
    {
      label: 'Cosine similarity',
      latex: '\\mathrm{sim}(q, v) = \\frac{q \\cdot v}{\\lVert q \\rVert \\, \\lVert v \\rVert}',
      plain: 'sim(q, v) = (q · v) / (‖q‖ · ‖v‖)',
    },
    {
      label: 'Top-K retrieval',
      latex: '\\mathrm{TopK}(q) = \\underset{S \\subseteq V,\\ |S|=K}{\\arg\\max} \\sum_{v \\in S} \\mathrm{sim}(q, v)',
      plain: 'TopK(q) = argmax over K-subsets S ⊆ V of Σ sim(q, v)',
    },
    {
      label: 'Total comparisons',
      latex: 'C(N) = N',
      plain: 'C(N) = N   (one dot product per stored vector)',
      note:  'Linear in corpus size — the headline cost of Flat.',
    },
  ],
  tracing: [
    'Receive query embedding q ∈ ℝᵈ from the Embedder node.',
    'Iterate every row v_i in the embeddings table for this store.',
    'Compute sim(q, v_i) using the configured metric (cosine / dot / L2).',
    'Push (i, score) into a bounded min-heap of size K.',
    'After the scan, drain the heap in descending order — those are the top-K hits.',
    'Apply the top_p similarity floor (drop hits below threshold) before returning.',
  ],
}

const HNSW: AlgorithmDoc = {
  key:     'hnsw',
  name:    'HNSW (Hierarchical Navigable Small World)',
  tagline: 'Layered proximity graph — greedy descent from a sparse top layer to a dense base layer.',
  complexity: {
    build:  'O(N · log N · M) — M = max neighbors per node',
    query:  'O(log N · ef) — ef = search-time beam width',
    memory: 'O(N · (d + M)) — vectors + adjacency lists',
  },
  diagram: `Layer 2 (sparse)         ●──────────────●
                          \\            /
Layer 1                    ●───●───●──●
                            \\  |  /  |
Layer 0 (full graph)   ●─●─●─●─●─●─●─●─●─●

  query enters at top, greedily walks toward q,
  drops a layer, repeats — refines on the dense base.`,
  useCases: [
    'Online RAG over millions of chunks where p99 query latency matters.',
    'Real-time semantic search (chatbots, IDE autocomplete) needing < 50ms recall.',
    'Hybrid stacks where HNSW returns ~k=200 candidates fed to a reranker.',
    'Corpora that fit in RAM — HNSW is memory-hungry by design.',
  ],
  formulas: [
    {
      label: 'Layer assignment for a new node',
      latex: 'l = \\left\\lfloor -\\ln(\\mathrm{rand}(0,1)) \\cdot m_L \\right\\rfloor',
      plain: 'l = ⌊ −ln(U) · m_L ⌋,   U ~ Uniform(0,1)',
      note:  'm_L ≈ 1/ln(M); this gives the geometric layer distribution that yields log-N hops.',
    },
    {
      label: 'Neighbor pruning (heuristic)',
      latex: 'N(v) = \\underset{|N|=M}{\\arg\\min} \\sum_{u \\in N} d(v, u) \\quad \\text{s.t. diversity}',
      plain: 'N(v) = M nearest candidates, filtered for diversity',
      note:  'Each layer caps degree at M; layer 0 may use 2M for extra robustness.',
    },
    {
      label: 'Search beam',
      latex: 'W_{t+1} = \\mathrm{TopEf}\\bigl(W_t \\cup \\mathrm{neighbors}(\\mathrm{best}(W_t))\\bigr)',
      plain: 'W_{t+1} = TopEf( W_t ∪ neighbors(best(W_t)) )',
      note:  'ef controls the recall/latency trade-off at query time.',
    },
  ],
  tracing: [
    'Build phase: for each new vector v, sample its top layer l from the geometric distribution.',
    'Insert v into every layer 0..l, connecting to up to M nearest neighbors per layer.',
    'Query phase: enter at the top layer through a fixed entry point.',
    'Greedy-descend: at each layer, hop to the neighbor closest to q; drop a layer when no neighbor improves distance.',
    'On layer 0, run a beam search of width ef collecting candidate neighbors.',
    'Return the K best from the final candidate set; apply top_p floor.',
  ],
}

const IVFFLAT: AlgorithmDoc = {
  key:     'ivfflat',
  name:    'IVFFlat (Inverted File over Flat Lists)',
  tagline: 'k-means partitions the space; a query only scans vectors in its nearest cells.',
  complexity: {
    build:  'O(N · K_c · iter) — k-means training over K_c centroids',
    query:  'O(K_c · d + n_probe · (N/K_c) · d)',
    memory: 'O(N · d + K_c · d)',
  },
  diagram: `        centroid c1               centroid c2
            ★                          ★
         ╱     ╲                    ╱     ╲
       v   v   v                  v   v   v
        v   v                      v   v
                       q ●
                        nearest centroids → c2, c5
   ┌─────── inverted lists ──────────┐
   │ c1 → [v3, v7, v12, …]           │
   │ c2 → [v1, v9, v18, …]   ← scan  │
   │ c3 → [v5, v22, …]               │
   │ c4 → [v8, v14, …]               │
   │ c5 → [v6, v17, …]       ← scan  │
   └─────────────────────────────────┘`,
  useCases: [
    'Mid-to-large corpora (100k – 10M) where exact search is too slow but HNSW memory is too high.',
    'Disk-backed pgvector deployments — IVFFlat keeps cells contiguous for IO efficiency.',
    'Workloads with periodic batch ingest — k-means can be retrained off-peak.',
    'Cost-sensitive RAG where you tune n_probe to dial in recall vs. cost.',
  ],
  formulas: [
    {
      label: 'k-means objective',
      latex: 'J = \\sum_{i=1}^{N} \\min_{j \\in [K_c]} \\lVert v_i - c_j \\rVert^2',
      plain: 'J = Σᵢ minⱼ ‖vᵢ − cⱼ‖²',
      note:  'Training minimizes J; each vector is assigned to its nearest centroid.',
    },
    {
      label: 'Cell selection',
      latex: '\\mathcal{P}(q) = \\underset{j \\in [K_c]}{\\mathrm{TopN}}\\bigl( \\mathrm{sim}(q, c_j) \\bigr)',
      plain: 'P(q) = top n_probe centroids by sim(q, cⱼ)',
    },
    {
      label: 'Effective scan size',
      latex: '\\mathbb{E}[|\\mathrm{scan}|] \\approx \\frac{n_{\\mathrm{probe}}}{K_c} \\cdot N',
      plain: 'E[|scan|] ≈ (n_probe / K_c) · N',
      note:  'n_probe trades recall for latency; K_c is typically chosen ≈ √N.',
    },
  ],
  tracing: [
    'Build phase: sample a training set, run k-means to learn K_c centroids.',
    'Assign every vector v_i to its nearest centroid c_j; append v_i to inverted list L_j.',
    'Query phase: compute sim(q, c_j) for all centroids — cheap because K_c ≪ N.',
    'Pick the top n_probe centroids whose lists collectively cover the relevant region.',
    'Brute-force scan only those n_probe inverted lists, scoring each candidate against q.',
    'Merge per-list top-K heaps into a global top-K; apply top_p floor before returning.',
  ],
}

export const ALGORITHM_DOCS: Record<string, AlgorithmDoc> = {
  flat:    FLAT,
  hnsw:    HNSW,
  ivfflat: IVFFLAT,
}

export function getAlgorithmDoc(key: string): AlgorithmDoc | null {
  return ALGORITHM_DOCS[key] ?? null
}
