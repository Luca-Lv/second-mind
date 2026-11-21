import { openBoard, set, useStore } from '../store'
import { KIND_LABEL, type NodeRow } from '../types'
import { Icon } from '../components/ui'

export function OutlineView() {
  const identities = useStore((s) => s.data.identities)
  const nodes = useStore((s) => s.data.nodes)

  const byParent = new Map<number | null, NodeRow[]>()
  for (const n of nodes) {
    const k = n.parent_id ?? null
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(n)
  }

  const renderKids = (parentId: number | null, identityId: number): React.ReactNode => {
    const list = byParent.get(parentId)?.filter((n) => n.identity_id === identityId) ?? []
    if (list.length === 0) return null
    return (
      <ul>
        {list.map((n) => (
          <li key={n.id}>
            <button onClick={() => set({ selected: { kind: 'node', id: n.id }, view: 'board' })}>
              <span className="tick" style={{ background: n.status === 'done' ? 'var(--success)' : 'var(--border-strong)' }} />
              <span style={{ textDecoration: n.status === 'done' ? 'line-through' : 'none', opacity: n.status === 'done' ? 0.55 : 1 }}>
                {n.title}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{KIND_LABEL[n.kind]}</span>
            </button>
            {renderKids(n.id, identityId)}
          </li>
        ))}
      </ul>
    )
  }

  if (identities.length === 0) {
    return (
      <div className="stage">
        <div className="empty">
          <Icon name="list" size={28} />
          <h2>还没有内容</h2>
          <p>先在左侧创建身份词。这个视图把同一份数据排成可键盘操作的树。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="stage" style={{ overflow: 'auto' }}>
      <div className="outline">
        <h2 style={{ marginTop: 8 }}>大纲视图</h2>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: -4 }}>
          与 Network 同一份数据。图谱对键盘和读屏不友好，这里每个节点都是可聚焦的按钮。
        </p>
        {identities.map((it) => {
          const top = byParent.get(null)?.filter((n) => n.identity_id === it.id) ?? []
          return (
            <div key={it.id} style={{ marginTop: 22 }}>
              <ul>
                <li style={{ borderLeft: 'none', marginLeft: 0, paddingLeft: 0 }}>
                  <button className="depth-0" onClick={() => openBoard(it.id)}>
                    <span className="tick" style={{ background: `var(--id-${it.color % 8})` }} />
                    {it.name}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>身份词</span>
                  </button>
                  {top.length > 0 && (
                    <ul>
                      {top.map((n) => (
                        <li key={n.id}>
                          <button onClick={() => set({ selected: { kind: 'node', id: n.id }, view: 'board' })}>
                            <span
                              className="tick"
                              style={{ background: n.status === 'done' ? 'var(--success)' : 'var(--border-strong)' }}
                            />
                            <span
                              style={{
                                textDecoration: n.status === 'done' ? 'line-through' : 'none',
                                opacity: n.status === 'done' ? 0.55 : 1,
                              }}
                            >
                              {n.title}
                            </span>
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{KIND_LABEL[n.kind]}</span>
                          </button>
                          {renderKids(n.id, it.id)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              </ul>
            </div>
          )
        })}
        <div style={{ height: 60 }} />
      </div>
    </div>
  )
}
