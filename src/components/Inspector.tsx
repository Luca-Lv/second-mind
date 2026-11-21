import { useEffect, useRef, useState } from 'react'
import { createEdge, createNode, deleteEdge, deleteIdentity, deleteNode, renameIdentity, setIdentityColor, updateNode } from '../data'
import { openBoard, set, useStore } from '../store'
import { KIND_LABEL, KINDS, type Kind } from '../types'
import { Icon } from '../components/ui'

export function Inspector() {
  const selected = useStore((s) => s.selected)
  const identity = useStore((s) =>
    selected?.kind === 'identity' ? s.data.identities.find((i) => i.id === selected.id) ?? null : null,
  )
  const node = useStore((s) => (selected?.kind === 'node' ? s.data.nodes.find((n) => n.id === selected.id) ?? null : null))
  const edges = useStore((s) => s.data.edges)
  const identities = useStore((s) => s.data.identities)
  const nodes = useStore((s) => s.data.nodes)
  const view = useStore((s) => s.view)

  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [progress, setProgress] = useState(0)
  const loadedKey = useRef('')

  const key = selected ? `${selected.kind}:${selected.id}` : ''

  // 只在切换对象时重置草稿；之后由 rev 变化（他人改动）追平
  useEffect(() => {
    if (loadedKey.current === key) return
    loadedKey.current = key
    setTitle(node?.title ?? identity?.name ?? '')
    setNote(node?.note ?? '')
    setProgress(node?.progress ?? 0)
  }, [key, node, identity])

  useEffect(() => {
    if (!node) return
    setTitle(node.title)
  }, [node?.rev]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!node) return
    setNote(node.note ?? '')
    setProgress(node.progress ?? 0)
  }, [node?.rev]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!identity) return
    setTitle(identity.name)
  }, [identity?.rev]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!selected || (!node && !identity)) return null

  const myLinks = edges.filter((e) =>
    selected.kind === 'identity'
      ? (e.source_kind === 'identity' && e.source_id === selected.id) || (e.target_kind === 'identity' && e.target_id === selected.id)
      : (e.source_kind === 'node' && e.source_id === selected.id) || (e.target_kind === 'node' && e.target_id === selected.id),
  )

  const labelOf = (kind: string, id: number) =>
    kind === 'identity' ? identities.find((i) => i.id === id)?.name ?? '已删除' : nodes.find((n) => n.id === id)?.title ?? '已删除'

  const close = () => set({ selected: null })

  const commitTitle = () => {
    const v = title.trim()
    if (!v) {
      setTitle(node?.title ?? identity?.name ?? '')
      return
    }
    if (node && v !== node.title) void updateNode(node.id, { title: v })
    if (identity && v !== identity.name) void renameIdentity(identity.id, v)
  }

  const commitNote = () => {
    if (!node) return
    if ((note ?? '') !== (node.note ?? '')) void updateNode(node.id, { note })
  }

  return (
    <aside className="inspector" aria-label="详情面板">
      <div className="insp-head">
        <div className="spacer" />
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{identity ? '身份词' : KIND_LABEL[node!.kind]}</span>
        <button className="icon-btn" onClick={close} aria-label="关闭面板">
          <Icon name="close" size={15} />
        </button>
      </div>

      <div className="insp-body">
        <label className="field" style={{ marginBottom: 12 }}>
          <span className="label">{identity ? '身份词' : '标题'}</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>

        {identity && (
          <>
            <div className="field">
              <span className="label">颜色</span>
              <div className="color-row">
                {Array.from({ length: 8 }, (_, i) => (
                  <button
                    key={i}
                    className="color-dot"
                    aria-label={`颜色 ${i + 1}`}
                    aria-pressed={identity.color === i}
                    style={{ background: `var(--id-${i})`, color: `var(--id-${i})` }}
                    onClick={() => void setIdentityColor(identity.id, i)}
                  />
                ))}
              </div>
            </div>
            <div className="insp-section">
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => openBoard(identity.id)}>
                  <Icon name="board" size={13} /> 进入搭建台
                </button>
                <button className="btn btn-sm" onClick={() => void createNode({ identityId: identity.id, kind: 'skill' })}>
                  <Icon name="plus" size={13} /> 加技能
                </button>
              </div>
            </div>
            <div className="insp-section">
              <button
                className="btn btn-danger btn-block btn-sm"
                onClick={() => {
                  const n = nodes.filter((x) => x.identity_id === identity.id).length
                  if (confirm(`删除「${identity.name}」？它的 ${n} 个节点也会一并删除。`)) {
                    void deleteIdentity(identity.id)
                    close()
                  }
                }}
              >
                <Icon name="trash" size={13} /> 删除这个身份词
              </button>
            </div>
          </>
        )}

        {node && (
          <>
            <div className="field">
              <span className="label">类型</span>
              <div className="kind-grid">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    className="kind-chip"
                    aria-pressed={node.kind === k}
                    onClick={() => {
                      const patch: any = { kind: k }
                      if (k === 'todo' && !node.status) patch.status = 'open'
                      if (k === 'progress' && node.progress == null) patch.progress = 0
                      void updateNode(node.id, patch)
                    }}
                  >
                    {KIND_LABEL[k as Kind]}
                  </button>
                ))}
              </div>
            </div>

            {node.kind === 'todo' && (
              <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={node.status === 'done'}
                  onChange={(e) => void updateNode(node.id, { status: e.target.checked ? 'done' : 'open' })}
                />
                <span style={{ fontSize: 13 }}>已完成</span>
              </label>
            )}

            {node.kind === 'progress' && (
              <div className="field">
                <span className="label">
                  进度 <span className="num">{progress}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  onPointerUp={() => void updateNode(node.id, { progress })}
                  onKeyUp={() => void updateNode(node.id, { progress })}
                  style={{ width: '100%' }}
                  aria-label="进度"
                />
              </div>
            )}

            <label className="field">
              <span className="label">备注</span>
              <textarea
                className="textarea"
                value={note}
                placeholder="为什么它重要？下一步是什么？"
                onChange={(e) => setNote(e.target.value)}
                onBlur={commitNote}
              />
            </label>

            <div className="insp-section">
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-sm"
                  onClick={() => void createNode({ identityId: node.identity_id!, parentId: node.id, kind: 'step' })}
                >
                  <Icon name="plus" size={13} /> 子节点
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const target = identities.find((i) => i.id !== node.identity_id)
                    if (!target) return
                    void createEdge({ kind: 'node', id: node.id }, { kind: 'identity', id: target.id })
                  }}
                >
                  <Icon name="link" size={13} /> 跨身份连接
                </button>
              </div>

              <span className="label" style={{ marginBottom: 4 }}>
                关联（{myLinks.length}）
              </span>
              {myLinks.length === 0 && <div className="hint">还没有连线。在工作台里从卡片右侧圆点拖到目标卡片即可。</div>}
              {myLinks.map((e) => {
                const out = e.source_kind === selected.kind && e.source_id === selected.id
                const otherKind = out ? e.target_kind : e.source_kind
                const otherId = out ? e.target_id : e.source_id
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="link-row" style={{ flex: 1, cursor: 'default' }}>
                      <span className="link-arrow">{out ? '→' : '←'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {labelOf(otherKind, otherId)}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)' }}>
                        {otherKind === 'identity' ? '身份' : '节点'}
                      </span>
                    </span>
                    <button className="mini-btn" aria-label="删除连线" onClick={() => void deleteEdge(e.id)}>
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="insp-section">
              <button
                className="btn btn-danger btn-block btn-sm"
                onClick={() => {
                  void deleteNode(node.id)
                  close()
                }}
              >
                <Icon name="trash" size={13} /> 删除节点
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
