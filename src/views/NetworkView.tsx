import { useCallback, useEffect, useMemo, useRef } from 'react'
import { buildGraph, createNetworkSim, type Graph, type GNode } from '../layout'
import { openBoard, set, useStore } from '../store'
import { Icon } from '../components/ui'

interface View {
  k: number
  x: number
  y: number
}

const HOVER_DWELL = 120
const HOVER_LEAVE = 180
const PROXIMITY = 28

function palette() {
  const cs = getComputedStyle(document.documentElement)
  const get = (n: string) => cs.getPropertyValue(n).trim()
  return {
    bg: get('--bg'),
    text1: get('--text-1'),
    text3: get('--text-3'),
    grid: get('--grid'),
    border: get('--border'),
    ids: Array.from({ length: 8 }, (_, i) => get(`--id-${i}`)),
  }
}

export function NetworkView() {
  const identities = useStore((s) => s.data.identities)
  const nodes = useStore((s) => s.data.nodes)
  const edges = useStore((s) => s.data.edges)
  const theme = useStore((s) => s.theme)
  const selected = useStore((s) => s.selected)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<View>({ k: 1, x: 0, y: 0 })
  const graphRef = useRef<Graph | null>(null)
  const posRef = useRef(new Map<string, { x: number; y: number }>())
  const hoverRef = useRef<string | null>(null)
  const adjRef = useRef(new Map<string, Set<string>>())
  const rafRef = useRef(0)
  const palRef = useRef(palette())
  const settleRef = useRef(false)
  const simRef = useRef<any>(null)

  // draw 刻意不依赖 selected：否则选中节点会改变回调标识，进而重建布局、整张图抖一下
  const draw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const g = graphRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    const w = cv.clientWidth
    const h = cv.clientHeight
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    const p = palRef.current
    const v = viewRef.current
    const hover = hoverRef.current
    const adj = adjRef.current.get(hover ?? '') ?? new Set<string>()
    const selected = useStore.getState().selected

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    // 极浅点阵：给空间一个尺度感
    if (v.k > 0.32) {
      const step = 26 * v.k
      const ox = ((v.x % step) + step) % step
      const oy = ((v.y % step) + step) % step
      ctx.fillStyle = p.grid
      for (let x = ox; x < w; x += step) {
        for (let y = oy; y < h; y += step) {
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }

    if (!g) return

    ctx.save()
    ctx.translate(v.x, v.y)
    ctx.scale(v.k, v.k)

    // 连线
    for (const l of g.links) {
      const s = l.source as GNode
      const t = l.target as GNode
      const dim = hover ? !(adj.has(s.key) || adj.has(t.key)) : false
      const a = hover ? (dim ? 0.05 : l.kind === 'reference' ? 0.4 : 0.5) : l.kind === 'reference' ? 0.18 : 0.2
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      if (l.kind === 'reference') {
        ctx.setLineDash([3 / v.k, 5 / v.k])
        ctx.strokeStyle = p.ids[t.colorIndex % 8]
      } else {
        ctx.setLineDash([])
        ctx.strokeStyle = p.ids[s.colorIndex % 8]
      }
      ctx.globalAlpha = a
      ctx.lineWidth = (l.kind === 'reference' ? 1 : 1.1) / v.k
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    // 节点
    for (const n of g.nodes) {
      const isHover = hover === n.key
      const dim = hover ? !(adj.has(n.key) || isHover) : false
      const sel = selected?.kind === n.kind && selected.id === n.id
      ctx.globalAlpha = dim ? 0.18 : 1

      if (isHover) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r + 9, 0, Math.PI * 2)
        ctx.strokeStyle = p.ids[n.colorIndex % 8]
        ctx.globalAlpha = 0.28
        ctx.lineWidth = 1.5 / v.k
        ctx.stroke()
        ctx.globalAlpha = dim ? 0.18 : 1
      }

      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fillStyle = p.ids[n.colorIndex % 8]
      ctx.fill()

      if (n.kind === 'identity') {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.strokeStyle = p.bg
        ctx.globalAlpha = (dim ? 0.18 : 1) * 0.9
        ctx.lineWidth = 1.4 / v.k
        ctx.stroke()
        ctx.globalAlpha = dim ? 0.18 : 1
      }
      if (sel) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r + 4.5, 0, Math.PI * 2)
        ctx.strokeStyle = p.text1
        ctx.globalAlpha = 0.45
        ctx.lineWidth = 1.2 / v.k
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    ctx.restore()

    // 标签：屏幕坐标绘制，字号不随缩放变形
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const n of g.nodes) {
      const revealed = hover ? adj.has(n.key) || hover === n.key : false
      if (n.kind !== 'identity' && !revealed) continue
      const sx = n.x * v.k + v.x
      const sy = n.y * v.k + v.y
      if (sx < -80 || sx > w + 80 || sy < -40 || sy > h + 40) continue

      const dim = hover ? !revealed && n.kind !== 'identity' : false
      const isIdent = n.kind === 'identity'
      const size = isIdent ? 14 : 12
      ctx.font = `${isIdent ? 500 : 400} ${size}px ${
        '-apple-system, BlinkMacSystemFont, Inter, "PingFang SC", "Noto Sans SC", sans-serif'
      }`
      const label = n.title.length > 14 ? n.title.slice(0, 13) + '…' : n.title
      const lx = isIdent ? sx : sx + n.r * v.k + 7
      const ly = isIdent ? sy + n.r * v.k + 15 : sy
      ctx.textAlign = isIdent ? 'center' : 'left'

      ctx.globalAlpha = dim ? 0.3 : 0.92
      ctx.lineWidth = 3
      ctx.strokeStyle = p.bg
      ctx.strokeText(label, lx, ly)
      ctx.fillStyle = isIdent ? p.text1 : p.text1
      ctx.fillText(label, lx, ly)
    }
    ctx.globalAlpha = 1
  }, [])

  const schedule = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      draw()
    })
  }, [draw])

  const fit = useCallback(() => {
    const g = graphRef.current
    const cv = canvasRef.current
    if (!g || !cv || g.nodes.length === 0) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of g.nodes) {
      minX = Math.min(minX, n.x - n.r)
      maxX = Math.max(maxX, n.x + n.r)
      minY = Math.min(minY, n.y - n.r)
      maxY = Math.max(maxY, n.y + n.r)
    }
    const pad = 72
    const w = cv.clientWidth
    const h = cv.clientHeight
    const k = Math.max(0.3, Math.min(1.5, Math.min((w - pad * 2) / Math.max(1, maxX - minX), (h - pad * 2) / Math.max(1, maxY - minY))))
    viewRef.current = {
      k,
      x: w / 2 - ((minX + maxX) / 2) * k,
      y: h / 2 - ((minY + maxY) / 2) * k,
    }
    schedule()
  }, [schedule])

  const recomputeAdj = useCallback((g: Graph) => {
    const m = new Map<string, Set<string>>()
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set())
      m.get(a)!.add(b)
    }
    for (const l of g.links) {
      add(l.source.key, l.target.key)
      add(l.target.key, l.source.key)
    }
    adjRef.current = m
  }, [])

  // 主题变化时重读配色
  useEffect(() => {
    palRef.current = palette()
    schedule()
  }, [theme, schedule])

  // 选中态变化只需重绘，不重建布局
  useEffect(() => {
    schedule()
  }, [selected, schedule])

  // 数据变化：增量更新，保留既有位置
  useEffect(() => {
    const known = posRef.current
    const g = buildGraph(identities, nodes, edges, null, known)
    const prev = graphRef.current
    graphRef.current = g
    recomputeAdj(g)
    const isFirst = !prev || prev.nodes.length === 0
    if (isFirst) {
      settleRef.current = false
      window.setTimeout(() => fit(), 60)
    }
    const sim = createNetworkSim(
      g,
      () => {
        for (const n of g.nodes) known.set(n.key, { x: n.x, y: n.y })
        schedule()
      },
      isFirst ? 1 : 0.35,
    )
    simRef.current = sim
    if (!isFirst) {
      window.setTimeout(() => {
        if (!settleRef.current) {
          settleRef.current = true
          fit()
        }
      }, 260)
    }
    return () => {
      sim.stop()
    }
  }, [identities, nodes, edges, schedule, fit, recomputeAdj])

  // 尺寸变化
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ro = new ResizeObserver(() => schedule())
    ro.observe(cv)
    return () => ro.disconnect()
  }, [schedule])

  // 邻近判定：指针靠近 28px 并停留 120ms 才展开
  const dwell = useRef<{ timer?: number; leave?: number }>({})

  const pick = useCallback((px: number, py: number): GNode | null => {
    const g = graphRef.current
    if (!g) return null
    const v = viewRef.current
    let best: GNode | null = null
    let bestD = Infinity
    for (const n of g.nodes) {
      const sx = n.x * v.k + v.x
      const sy = n.y * v.k + v.y
      const d = Math.hypot(sx - px, sy - py)
      const threshold = Math.max(PROXIMITY, n.r * v.k + 14)
      if (d <= threshold && d < bestD) {
        bestD = d
        best = n
      }
    }
    return best
  }, [])

  const onMove = useCallback(
    (px: number, py: number) => {
      const n = pick(px, py)
      const key = n?.key ?? null
      const d = dwell.current
      if (key === hoverRef.current) return
      if (d.timer) window.clearTimeout(d.timer)
      if (d.leave) window.clearTimeout(d.leave)
      if (key) {
        d.timer = window.setTimeout(() => {
          hoverRef.current = key
          schedule()
        }, HOVER_DWELL)
      } else {
        d.leave = window.setTimeout(() => {
          hoverRef.current = null
          schedule()
        }, HOVER_LEAVE)
      }
    },
    [pick, schedule],
  )

  // 拖拽 / 缩放 / 点击
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    let dragging = false
    let moved = 0
    let lastX = 0
    let lastY = 0
    let downX = 0
    let downY = 0

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      dragging = true
      moved = 0
      lastX = downX = e.clientX
      lastY = downY = e.clientY
      cv.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      const rect = cv.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      if (dragging) {
        const dx = e.clientX - lastX
        const dy = e.clientY - lastY
        moved += Math.abs(dx) + Math.abs(dy)
        viewRef.current.x += dx
        viewRef.current.y += dy
        lastX = e.clientX
        lastY = e.clientY
        cv.classList.add('dragging')
        schedule()
        return
      }
      onMove(px, py)
    }
    const onUp = (e: PointerEvent) => {
      cv.classList.remove('dragging')
      if (!dragging) return
      dragging = false
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY)
      if (dist > 5) return
      const rect = cv.getBoundingClientRect()
      const hit = pick(e.clientX - rect.left, e.clientY - rect.top)
      if (!hit) {
        set({ selected: null })
        return
      }
      if (hit.kind === 'identity') {
        openBoard(hit.id)
      } else {
        set({ selected: { kind: 'node', id: hit.id } })
      }
    }
    const onLeave = () => {
      hoverRef.current = null
      schedule()
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = cv.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const v = viewRef.current
      const next = Math.max(0.22, Math.min(3.2, v.k * Math.exp(-e.deltaY * 0.0016)))
      v.x = px - ((px - v.x) * next) / v.k
      v.y = py - ((py - v.y) * next) / v.k
      v.k = next
      schedule()
    }

    cv.addEventListener('pointerdown', onDown)
    cv.addEventListener('pointermove', onPointerMove)
    cv.addEventListener('pointerup', onUp)
    cv.addEventListener('pointerleave', onLeave)
    cv.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      cv.removeEventListener('pointerdown', onDown)
      cv.removeEventListener('pointermove', onPointerMove)
      cv.removeEventListener('pointerup', onUp)
      cv.removeEventListener('pointerleave', onLeave)
      cv.removeEventListener('wheel', onWheel)
    }
  }, [pick, schedule, onMove])

  const zoomBy = (f: number) => {
    const cv = canvasRef.current
    if (!cv) return
    const w = cv.clientWidth
    const h = cv.clientHeight
    const v = viewRef.current
    const next = Math.max(0.22, Math.min(3.2, v.k * f))
    v.x = w / 2 - ((w / 2 - v.x) * next) / v.k
    v.y = h / 2 - ((h / 2 - v.y) * next) / v.k
    v.k = next
    schedule()
  }

  const relayout = () => {
    simRef.current?.stop()
    posRef.current.clear()
    viewRef.current = { k: 1, x: 0, y: 0 }
    const g = buildGraph(identities.map((i) => ({ ...i })), nodes.map((n) => ({ ...n })), edges, null)
    // 打散初始位置，才叫"重新排布"
    for (const n of g.nodes) {
      n.x += (Math.random() - 0.5) * 320
      n.y += (Math.random() - 0.5) * 320
    }
    graphRef.current = g
    recomputeAdj(g)
    simRef.current = createNetworkSim(g, () => schedule(), 1)
    window.setTimeout(fit, 700)
  }

  const stats = useMemo(() => ({ idents: identities.length, nodes: nodes.length }), [identities.length, nodes.length])

  if (identities.length === 0) {
    return (
      <div className="stage">
        <div className="empty">
          <Icon name="network" size={30} />
          <h2>网络还是空的</h2>
          <p>先在左侧创建一个身份词——比如「设计师」「写作者」「吉他手」。它就是这颗星系的第一个神经元。</p>
          <NewIdentityInline />
        </div>
      </div>
    )
  }

  return (
    <div className="stage" ref={wrapRef}>
      <canvas ref={canvasRef} className="net-canvas" aria-label="身份网络图，点击左上角可切换到大纲视图进行键盘操作" role="img" />
      <div className="net-hint">
        只有第一级显示名字 · 指针靠近小点时才会展开它和它的近邻（{stats.idents} 个身份 · {stats.nodes} 个节点）
      </div>
      <div className="net-tools">
        <button className="tool-btn" onClick={() => zoomBy(1.25)} aria-label="放大">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button className="tool-btn" onClick={() => zoomBy(0.8)} aria-label="缩小">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12h14" /></svg>
        </button>
        <button className="tool-btn" onClick={fit} aria-label="适应画布" title="适应画布">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V5.5A1.5 1.5 0 015.5 4H9M15 4h3.5A1.5 1.5 0 0120 5.5V9M20 15v3.5A1.5 1.5 0 0118.5 20H15M9 20H5.5A1.5 1.5 0 014 18.5V15" /></svg>
        </button>
        <button className="tool-btn" onClick={relayout} aria-label="重新排布" title="重新排布">
          <Icon name="refresh" size={15} />
        </button>
      </div>
    </div>
  )
}

function NewIdentityInline() {
  return (
    <button className="btn btn-primary" onClick={() => set({ rail: true })}>
      <Icon name="plus" size={14} /> 创建身份词
    </button>
  )
}
