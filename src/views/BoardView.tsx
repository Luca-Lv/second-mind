import { useEffect, useMemo, useRef, useState } from 'react'
import { createEdge, createNode, deleteNode, saveIdentityPosition, saveNodePosition, updateNode } from '../data'
import { tidyBoard, type BoardPos } from '../layout'
import { childNodes, set, useStore } from '../store'
import { KIND_LABEL, KINDS, type Kind, type NodeRow, type Ref } from '../types'
import { Icon } from '../components/ui'

const CARD_W = 224
const IDENT_W = 208

interface DragState {
  key: string
  ref: Ref
  startX: number
  startY: number
  origX: number
  origY: number
  moved: boolean
}

export function BoardView() {
  const focus = useStore((s) => s.focusIdentity)
  const identity = useStore((s) => s.data.identities.find((i) => i.id === s.focusIdentity) ?? null)
  const allNodes = useStore((s) => s.data.nodes)
  const edges = useStore((s) => s.data.edges)
  const selected = useStore((s) => s.selected)

  const nodes = useMemo(() => allNodes.filter((n) => n.identity_id === focus), [allNodes, focus])

  const saved = useMemo(() => {
    const m = new Map<number, BoardPos>()
    if (identity?.x != null && identity?.y != null) m.set(identity.id, { x: identity.x, y: identity.y })
    for (const n of nodes) if (n.x != null && n.y != null) m.set(n.id, { x: n.x, y: n.y })
    return m
  }, [identity, nodes])

  const base = useMemo(() => (identity ? tidyBoard(identity, nodes, saved) : new Map<string, BoardPos>()), [identity, nodes, saved])

  const [override, setOverride] = useState<Map<string, BoardPos>>(new Map())
  const [linking, setLinking] = useState<{ from: Ref; x: number; y: number } | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const planeRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)

  const pos = useMemo(() => {
    const m = new Map<string, BoardPos>()
    for (const [k, v] of base) m.set(k, override.get(k) ?? v)
    for (const [k, v] of override) if (!m.has(k)) m.set(k, v)
    return m
  }, [base, override])

  // 边界只按布局基准算：拖拽过程中的临时位置不参与，否则画布会跟着手指一起漂
  const bbox = useMemo(() => {
    let minX = 0
    let minY = 0
    let maxX = 800
    let maxY = 600
    for (const [k, p] of base) {
      const isIdent = k.startsWith('i')
      minX = Math.min(minX, p.x - 40)
      minY = Math.min(minY, p.y - 60)
      maxX = Math.max(maxX, p.x + (isIdent ? IDENT_W : CARD_W) + 60)
      maxY = Math.max(maxY, p.y + 80)
    }
    return { ox: 60 - minX, oy: 60 - minY, w: maxX - minX + 120, h: maxY - minY + 140 }
  }, [base])

  const at = (k: string): BoardPos => {
    const p = pos.get(k) ?? { x: 0, y: 0 }
    return { x: p.x + bbox.ox, y: p.y + bbox.oy }
  }

  // 进入某个身份的工作台时，把身份球滚到视野里
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !identity) return
    const p = base.get(`i${identity.id}`)
    if (!p) return
    wrap.scrollLeft = Math.max(0, p.x + bbox.ox - 100)
    wrap.scrollTop = Math.max(0, p.y + bbox.oy - wrap.clientHeight / 2)
  }, [identity?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------ 拖拽 ------------------------------ */

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (d) {
        const dx = e.clientX - d.startX
        const dy = e.clientY - d.startY
        if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
        setOverride((prev) => {
          const m = new Map(prev)
          m.set(d.key, { x: d.origX + dx, y: d.origY + dy })
          return m
        })
        return
      }
      if (linking) {
        const r = wrapRef.current?.getBoundingClientRect()
        if (!r) return
        const x = e.clientX - r.left + (wrapRef.current?.scrollLeft ?? 0) - bbox.ox
        const y = e.clientY - r.top + (wrapRef.current?.scrollTop ?? 0) - bbox.oy
        setLinking({ ...linking, x, y })
      }
    }
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current
      if (d) {
        dragRef.current = null
        if (d.moved) {
          const p = overrideRef.current.get(d.key) ?? base.get(d.key)
          if (p) {
            if (d.ref.kind === 'identity') void saveIdentityPosition(d.ref.id, p.x, p.y)
            else void saveNodePosition(d.ref.id, p.x, p.y)
          }
        }
      }
      if (linking) {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        const host = el?.closest('[data-nid]') as HTMLElement | null
        if (host) {
          const kind = (host.dataset.nkind as 'identity' | 'node') ?? 'node'
          const id = Number(host.dataset.nid)
          if (id && !(kind === linking.from.kind && id === linking.from.id)) {
            void createEdge(linking.from, { kind, id })
          }
        }
        setLinking(null)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [linking, base, bbox.ox, bbox.oy])

  const overrideRef = useRef(override)
  overrideRef.current = override

  if (!identity) {
    return (
      <div className="stage">
        <div className="empty">
          <Icon name="board" size={28} />
          <h2>还没有选中身份词</h2>
          <p>在 Network 里点一个身份球，或从左侧列表里选一个，就能进入它的搭建台。</p>
        </div>
      </div>
    )
  }

  const startDrag = (e: React.PointerEvent, key: string, ref: Ref) => {
    if ((e.target as HTMLElement).closest('button, input, .anchor')) return
    const el = e.currentTarget as HTMLElement
    const p = at(key)
    dragRef.current = {
      key,
      ref,
      startX: e.clientX,
      startY: e.clientY,
      origX: p.x - bbox.ox,
      origY: p.y - bbox.oy,
      moved: false,
    }
    el.classList.add('dragging')
    const clear = () => {
      el.classList.remove('dragging')
      window.removeEventListener('pointerup', clear)
    }
    window.addEventListener('pointerup', clear)
  }

  const startLink = (e: React.PointerEvent, ref: Ref) => {
    e.stopPropagation()
    e.preventDefault()
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return
    const x = e.clientX - r.left + (wrapRef.current?.scrollLeft ?? 0) - bbox.ox
    const y = e.clientY - r.top + (wrapRef.current?.scrollTop ?? 0) - bbox.oy
    setLinking({ from: ref, x, y })
  }

  const addChild = (parent: NodeRow | null, kind: Kind) => {
    void createNode({
      identityId: identity.id,
      parentId: parent?.id ?? null,
      kind,
      title: undefined,
    })
    setAdding(false)
  }

  const links = edges.filter((e) => {
    const ids = new Set(nodes.map((n) => n.id))
    const sOk = e.source_kind === 'identity' ? e.source_id === identity.id : ids.has(e.source_id)
    const tOk = e.target_kind === 'identity' ? e.target_id === identity.id : ids.has(e.target_id)
    return sOk && tOk
  })

  const selectedNode = selected?.kind === 'node' ? nodes.find((n) => n.id === selected.id) ?? null : null

  return (
    <div className="stage">
      <div className="board-wrap" ref={wrapRef} onPointerDown={(e) => e.target === e.currentTarget && set({ selected: null })}>
        <div className="board-plane" ref={planeRef} style={{ width: bbox.w, height: bbox.h }}>
          <svg className="board-edges" width={bbox.w} height={bbox.h} aria-hidden="true">
            {nodes.map((n) => {
              const parentKey = n.parent_id != null ? `n${n.parent_id}` : `i${identity.id}`
              if (!pos.has(parentKey)) return null
              const s = at(parentKey)
              const t = at(`n${n.id}`)
              const sx = s.x + (parentKey.startsWith('i') ? IDENT_W : CARD_W)
              const mx = (sx + t.x) / 2
              return (
                <path
                  key={`h${n.id}`}
                  d={`M${sx} ${s.y} C${mx} ${s.y} ${mx} ${t.y} ${t.x} ${t.y}`}
                  fill="none"
                  stroke="var(--border-strong)"
                  strokeWidth="1"
                />
              )
            })}
            {links.map((e) => {
              const sk = e.source_kind === 'identity' ? `i${e.source_id}` : `n${e.source_id}`
              const tk = e.target_kind === 'identity' ? `i${e.target_id}` : `n${e.target_id}`
              if (!pos.has(sk) || !pos.has(tk)) return null
              const s = at(sk)
              const t = at(tk)
              const sx = s.x + (sk.startsWith('i') ? IDENT_W : CARD_W)
              return (
                <path
                  key={`r${e.id}`}
                  d={`M${sx} ${s.y} C${(sx + t.x) / 2} ${s.y} ${(sx + t.x) / 2} ${t.y} ${t.x} ${t.y}`}
                  fill="none"
                  stroke="var(--primary)"
                  strokeOpacity="0.5"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
              )
            })}
            {linking &&
              (() => {
                const sk = linking.from.kind === 'identity' ? `i${linking.from.id}` : `n${linking.from.id}`
                const s = at(sk)
                const sx = s.x + (sk.startsWith('i') ? IDENT_W : CARD_W)
                return (
                  <path
                    d={`M${sx} ${s.y} L${linking.x} ${linking.y}`}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                  />
                )
              })()}
          </svg>

          <div
            className={`card card-ident ${selected?.kind === 'identity' && selected.id === identity.id ? 'selected' : ''}`}
            data-nid={identity.id}
            data-nkind="identity"
            style={{ left: at(`i${identity.id}`).x, top: at(`i${identity.id}`).y - 46 }}
            onPointerDown={(e) => startDrag(e, `i${identity.id}`, { kind: 'identity', id: identity.id })}
            onClick={() => set({ selected: { kind: 'identity', id: identity.id } })}
          >
            <div className="ident-ball" style={{ background: `var(--id-${identity.color % 8})` }}>
              {identity.name.slice(0, 1)}
            </div>
            <div className="ident-name">{identity.name}</div>
            <div className="ident-meta">{nodes.length} 个节点</div>
            <div className="anchor" onPointerDown={(e) => startLink(e, { kind: 'identity', id: identity.id })} title="拖出以连接" />
          </div>

          {nodes.map((n) => {
            const p = at(`n${n.id}`)
            const isSel = selected?.kind === 'node' && selected.id === n.id
            const kids = childNodes(useStore.getState(), n.id).length
            const done = n.status === 'done'
            return (
              <div
                key={n.id}
                className={`card ${isSel ? 'selected' : ''} ${done ? 'done' : ''}`}
                data-nid={n.id}
                data-nkind="node"
                style={{ left: p.x, top: p.y - 30 }}
                onPointerDown={(e) => startDrag(e, `n${n.id}`, { kind: 'node', id: n.id })}
                onClick={() => set({ selected: { kind: 'node', id: n.id } })}
                tabIndex={0}
                role="button"
                aria-label={`${KIND_LABEL[n.kind]}：${n.title}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') set({ selected: { kind: 'node', id: n.id } })
                }}
              >
                <div className="card-top">
                  <span className="kind-tag">{KIND_LABEL[n.kind]}</span>
                  {kids > 0 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{kids} 子项</span>}
                </div>

                {n.kind === 'todo' ? (
                  <div className="card-todo">
                    <span
                      className="check"
                      data-on={done}
                      role="checkbox"
                      aria-checked={done}
                      aria-label={done ? '标记为未完成' : '标记为已完成'}
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        void updateNode(n.id, { status: done ? 'open' : 'done' })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          void updateNode(n.id, { status: done ? 'open' : 'done' })
                        }
                      }}
                    >
                      {done && <Icon name="check" size={11} />}
                    </span>
                    <span className="card-title">{n.title}</span>
                  </div>
                ) : editing === n.id ? (
                  <input
                    className="input"
                    autoFocus
                    defaultValue={n.title}
                    style={{ height: 30, fontSize: 13 }}
                    onBlur={(e) => {
                      setEditing(null)
                      const v = e.target.value.trim()
                      if (v && v !== n.title) void updateNode(n.id, { title: v })
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="card-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setEditing(n.id)
                    }}
                  >
                    {n.title}
                  </div>
                )}

                {n.kind === 'progress' && (
                  <>
                    <div className="progress-bar">
                      <i style={{ width: `${n.progress ?? 0}%` }} />
                    </div>
                    <div className="card-meta">
                      <span className="num">{n.progress ?? 0}%</span>
                    </div>
                  </>
                )}

                <div className="card-actions">
                  <button
                    className="mini-btn"
                    title="添加子节点"
                    aria-label="添加子节点"
                    onClick={(e) => {
                      e.stopPropagation()
                      void createNode({ identityId: identity.id, parentId: n.id, kind: 'step' })
                    }}
                  >
                    <Icon name="plus" size={13} />
                  </button>
                  <button
                    className="mini-btn"
                    title="删除"
                    aria-label={`删除 ${n.title}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      void deleteNode(n.id)
                    }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
                <div className="anchor" onPointerDown={(e) => startLink(e, { kind: 'node', id: n.id })} title="拖出以连接" />
              </div>
            )
          })}
        </div>
      </div>

      {nodes.length === 0 && (
        <div className="board-empty">
          <Icon name="board" size={26} />
          <div>这个身份还没有内容。先加一个技能，再往下拆步骤。</div>
          <button className="btn btn-primary" onClick={() => addChild(null, 'skill')}>
            <Icon name="plus" size={14} /> 添加第一个节点
          </button>
        </div>
      )}

      <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          <Icon name="plus" size={14} /> 新节点
        </button>
        {adding && (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--shadow-2)',
              padding: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
            }}
          >
            {KINDS.map((k) => (
              <button key={k} className="kind-chip" onClick={() => addChild(selectedNode, k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-3)', paddingBottom: 8 }}>
          从卡片右侧圆点拖到另一张卡片即可连线
        </div>
      </div>
    </div>
  )
}
