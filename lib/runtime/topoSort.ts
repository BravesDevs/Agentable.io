import type { GraphEdge, GraphNode } from '@/lib/types'

/**
 * Kahn's algorithm — returns nodes in topological order.
 * Throws if the graph contains a cycle (would loop forever at runtime).
 */
export function topoSort(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const inDegree = new Map<string, number>(nodes.map(n => [n.id, 0]))
  const adjacency = new Map<string, string[]>(nodes.map(n => [n.id, []]))

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const sorted: GraphNode[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = nodeMap.get(id)
    if (node) sorted.push(node)

    for (const neighbor of adjacency.get(id) ?? []) {
      const next = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, next)
      if (next === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error(`Graph contains a cycle — ${nodes.length - sorted.length} node(s) unreachable`)
  }

  return sorted
}
