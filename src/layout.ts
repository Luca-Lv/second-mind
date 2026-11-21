import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import type { EdgeRow, IdentityRow, Kind, NodeRow } from './types'

export interface GNode {
  key: string
  kind: 'identity' | 'node'
  id: number
  identityId: number | null
  parentKey: string | null
  title: string
  nodeKind: Kind | 'identity'
  colorIndex: number
  degree: number
  childCount: number
  r: number
  x: number
  y: number
  vx?: number
  vy?: number
  progress: number | null
  status: string | null
  raw: IdentityRow | NodeRow
}

export interface GLink {
  source: any
  target: any
  kind: 'hierarchy' | 'reference'
}

export interface Graph {
  nodes: GNode[]
  links: GLink[]
}

const identityKey = (id: number) => `i${id}`
const nodeKey = (id: number) => `n${id}`

/** 黄金角散布 + 稳定哈希：同一份数据每次得到相同的初始位置，空间记忆不会漂。 */
function seedAngle(i: number) {
  return i * 2.399963229728653
}

export function buildGraph(
  identities: IdentityRow[],
  nodes: NodeRow[],
  edges: EdgeRow[],
  focus: number | null = null,
  known?: Map<string, { x: number; y: number }>,
): Graph {
  const visibleIds = new Set(nodes.map((n) => n.id))
  const idents = focus == null ? identities : identities.filter((i) => i.id === focus)
  const identSet = new Set(idents.map((i) => i.id))
  const ns = focus == null ? nodes.filter((n) => n.identity_id != null && identSet.has(n.identity_id)) : nodes.filter((n) => n.identity_id === focus)

  const childCount = new Map<number, number>()
  for (const n of ns) {
    if (n.parent_id != null) childCount.set(n.parent_id, (childCount.get(n.parent_id) ?? 0) + 1)
  }

  const out: GNode[] = []
  idents.forEach((it, i) => {
    const kids = ns.filter((n) => n.identity_id === it.id && n.parent_id == null).length
    const deg = kids + edges.filter((e) => (e.source_kind === 'identity' && e.source_id === it.id) || (e.target_kind === 'identity' && e.target_id === it.id)).length
    const r = Math.min(40, 18 + 4 * Math.sqrt(Math.max(1, deg)))
    const a = seedAngle(i) % (Math.PI * 2)
    const rad = 120 + i * 26
    out.push({
      key: identityKey(it.id),
      kind: 'identity',
      id: it.id,
      identityId: it.id,
      parentKey: null,
      title: it.name,
      nodeKind: 'identity',
      colorIndex: it.color % 8,
      degree: deg,
      childCount: kids,
      r,
      x: Math.cos(a) * rad,
      y: Math.sin(a) * rad,
      progress: null,
      status: null,
      raw: it,
    })
  })

  ns.forEach((n, i) => {
    const cc = childCount.get(n.id) ?? 0
    const deg = cc + edges.filter((e) => (e.source_kind === 'node' && e.source_id === n.id) || (e.target_kind === 'node' && e.target_id === n.id)).length
    const ident = identities.find((x) => x.id === n.identity_id)
    const a = seedAngle(i + idents.length) % (Math.PI * 2)
    const rad = 80 + (i % 7) * 22
    out.push({
      key: nodeKey(n.id),
      kind: 'node',
      id: n.id,
      identityId: n.identity_id,
      parentKey: n.parent_id != null && visibleIds.has(n.parent_id) ? nodeKey(n.parent_id) : n.identity_id != null ? identityKey(n.identity_id) : null,
      title: n.title,
      nodeKind: n.kind,
      colorIndex: (ident?.color ?? 0) % 8,
      degree: deg,
      childCount: cc,
      r: cc > 0 ? 5.5 : 3.5,
      x: Math.cos(a) * rad,
      y: Math.sin(a) * rad,
      progress: n.progress,
      status: n.status,
      raw: n,
    })
  })

  // 复用上一轮的位置：每次增量同步都重新炸开会毁掉空间记忆
  for (const n of out) {
    const k = known?.get(n.key)
    if (k) {
      n.x = k.x
      n.y = k.y
    }
  }
  // 新节点贴着父节点出生，而不是从原点飞过来
  const posByKey = new Map(out.map((n) => [n.key, n]))
  for (const n of out) {
    if (known?.has(n.key)) continue
    const p = n.parentKey ? posByKey.get(n.parentKey) : null
    if (p) {
      const a = (n.id * 2.399963229728653) % (Math.PI * 2)
      n.x = p.x + Math.cos(a) * 46
      n.y = p.y + Math.sin(a) * 46
    }
  }

  const byKey = new Map(out.map((n) => [n.key, n]))
  const links: GLink[] = []
  for (const n of out) {
    if (n.kind === 'node' && n.parentKey) {
      const p = byKey.get(n.parentKey)
      if (p) links.push({ source: p, target: n, kind: 'hierarchy' })
    }
  }
  for (const e of edges) {
    const sk = e.source_kind === 'identity' ? identityKey(e.source_id) : nodeKey(e.source_id)
    const tk = e.target_kind === 'identity' ? identityKey(e.target_id) : nodeKey(e.target_id)
    const s = byKey.get(sk)
    const t = byKey.get(tk)
    if (s && t && !(s === t)) links.push({ source: s, target: t, kind: 'reference' })
  }

  return { nodes: out, links }
}

export function createNetworkSim(graph: Graph, onTick: () => void, alpha = 1) {
  const sim = forceSimulation(graph.nodes as any)
    .force(
      'link',
      forceLink(graph.links as any)
        .id((d: any) => d.key)
        .distance((l: any) => (l.kind === 'reference' ? 160 : l.source.kind === 'identity' ? 96 : 62))
        .strength((l: any) => (l.kind === 'reference' ? 0.12 : 0.6)),
    )
    .force('charge', forceManyBody().strength((d: any) => (d.kind === 'identity' ? -520 : -170)))
    .force('collide', forceCollide<any>().radius((d: any) => d.r + (d.kind === 'identity' ? 26 : 8)))
    .force('x', forceX(0).strength(0.03))
    .force('y', forceY(0).strength(0.03))
    .alphaDecay(0.026)
    .velocityDecay(0.32)
    .alpha(alpha)

  sim.on('tick', onTick)
  return sim
}

/* --------------------------- Board：整齐的树 --------------------------- */

export interface BoardPos {
  x: number
  y: number
}

const COL_W = 300
const ROW_H = 92

/**
 * 从左到右的整洁树布局：叶子按顺序占行，父节点在子节点的垂直中点。
 * 确定性布局，没有抖动 —— 每次打开看到的位置都一样。
 */
export function tidyBoard(
  identity: IdentityRow,
  nodes: NodeRow[],
  saved: Map<number, BoardPos>,
): Map<string, BoardPos> {
  const kids = new Map<number, NodeRow[]>()
  for (const n of nodes) {
    const pid = n.parent_id ?? -1
    if (!kids.has(pid)) kids.set(pid, [])
    kids.get(pid)!.push(n)
  }
  for (const arr of kids.values()) arr.sort((a, b) => a.id - b.id)

  const pos = new Map<string, BoardPos>()
  let cursor = 0

  const walk = (parentId: number, depth: number): number => {
    const children = kids.get(parentId) ?? []
    if (children.length === 0) {
      const y = cursor
      cursor += 1
      return y
    }
    const ys: number[] = []
    for (const c of children) {
      const y = walk(c.id, depth + 1)
      ys.push(y)
      const savedPos = saved.get(c.id)
      pos.set(`n${c.id}`, savedPos ?? { x: (depth + 1) * COL_W, y: y * ROW_H })
    }
    return (ys[0] + ys[ys.length - 1]) / 2
  }

  const rootY = walk(-1, -1)
  pos.set(`i${identity.id}`, saved.get(identity.id) ?? { x: -220, y: rootY * ROW_H })

  for (const n of nodes) {
    if (!pos.has(`n${n.id}`)) {
      const savedPos = saved.get(n.id)
      pos.set(`n${n.id}`, savedPos ?? { x: COL_W, y: cursor++ * ROW_H })
    }
  }
  return pos
}
