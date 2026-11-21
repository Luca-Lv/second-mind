import { useState } from 'react'
import { createIdentity } from '../data'
import { openBoard, set, useStore, type View } from '../store'
import { Icon, ThemeToggle } from './ui'

const NAV: { id: View; label: string; icon: 'network' | 'board' | 'list' }[] = [
  { id: 'network', label: 'Network', icon: 'network' },
  { id: 'board', label: '工作台', icon: 'board' },
  { id: 'outline', label: '大纲', icon: 'list' },
]

export function Rail() {
  const identities = useStore((s) => s.data.identities)
  const nodes = useStore((s) => s.data.nodes)
  const view = useStore((s) => s.view)
  const focus = useStore((s) => s.focusIdentity)
  const open = useStore((s) => s.rail)
  const status = useStore((s) => s.status)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const submit = () => {
    const v = name.trim()
    if (!v) return
    setName('')
    setAdding(false)
    void createIdentity(v)
  }

  return (
    <>
      {open && <div className="rail-scrim" onClick={() => set({ rail: false })} />}
      <nav className={`rail ${open ? 'open' : ''}`} aria-label="主导航">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="10.5" cy="16" r="6" fill="var(--primary)" />
            <circle cx="24" cy="10" r="3.2" fill="var(--id-1)" />
            <circle cx="24.5" cy="23" r="2.2" fill="var(--id-2)" />
            <path d="M15.6 13.8l5.5-2.9M15.8 18.2l6 3.6" stroke="var(--primary)" strokeOpacity="0.45" strokeWidth="1.4" />
          </svg>
          <div>
            <div className="brand-name">second mind</div>
            <div className="brand-sub">你的身份树</div>
          </div>
        </div>

        <div className="rail-scroll">
          <div className="nav">
            {NAV.map((n) => (
              <button
                key={n.id}
                className="nav-item"
                aria-current={view === n.id}
                onClick={() => {
                  if (n.id === 'board' && focus == null) return
                  set({ view: n.id, rail: false })
                }}
                disabled={n.id === 'board' && focus == null}
                style={n.id === 'board' && focus == null ? { opacity: 0.4 } : undefined}
              >
                <Icon name={n.icon} size={15} />
                {n.label}
              </button>
            ))}
          </div>

          <div className="section-head">
            <span className="section-title">身份词</span>
            <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setAdding(true)} aria-label="新建身份词">
              <Icon name="plus" size={14} />
            </button>
          </div>

          {adding && (
            <div style={{ padding: '0 4px 8px' }}>
              <input
                className="input"
                autoFocus
                placeholder="例如：设计师"
                value={name}
                style={{ height: 32, fontSize: 13 }}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (name.trim()) submit()
                  else setAdding(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                  if (e.key === 'Escape') {
                    setName('')
                    setAdding(false)
                  }
                }}
              />
            </div>
          )}

          <div className="id-list">
            {identities.map((it) => {
              const count = nodes.filter((n) => n.identity_id === it.id).length
              return (
                <button
                  key={it.id}
                  className="id-item"
                  aria-current={view === 'board' && focus === it.id}
                  onClick={() => openBoard(it.id)}
                >
                  <span className="id-ball" style={{ background: `var(--id-${it.color % 8})` }} />
                  <span className="id-name">{it.name}</span>
                  <span className="id-count num">{count}</span>
                </button>
              )
            })}
            {identities.length === 0 && !adding && (
              <div className="hint" style={{ padding: '4px 10px' }}>
                还没有身份词。点上面的 + 开始。
              </div>
            )}
          </div>
        </div>

        <div className="rail-foot">
          <div className="user-row">
            <span className={`status-dot ${status === 'offline' ? 'offline' : ''}`} />
            <span style={{ flex: 1 }}>{status === 'offline' ? '离线 · 改动已暂存' : '已同步'}</span>
            <ThemeToggle compact />
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => set({ settings: true })} aria-label="设置">
              <Icon name="settings" size={15} />
            </button>
          </div>
        </div>
      </nav>
    </>
  )
}
