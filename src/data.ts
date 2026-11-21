import { db, errText, unwrap } from './cloud'
import { set, toast, useStore } from './store'
import type { DeviceRow, EdgeRow, IdentityRow, Kind, NodeRow, Ref, RefKind } from './types'

const PAGE = 400
const nowIso = () => new Date().toISOString()

let pulling = false

async function fetchTable(table: string, since: number): Promise<any[]> {
  const out: any[] = []
  let from = 0
  for (;;) {
    let q = db.from(table).select('*').order('rev', { ascending: true }).range(from, from + PAGE - 1)
    if (since > 0) q = q.gt('rev', since)
    const { data, error } = await q
    if (error) throw error
    const rows: any[] = data ?? []
    out.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
    if (from > 40000) break
  }
  return out
}

function merge(ids: IdentityRow[], nds: NodeRow[], eds: EdgeRow[]) {
  // 没有增量就不要生成新数组 —— 否则依赖 data 的图会白白重建一次
  if (ids.length === 0 && nds.length === 0 && eds.length === 0) return
  const st = useStore.getState()
  const im = new Map(st.data.identities.map((r) => [r.id, r]))
  const nm = new Map(st.data.nodes.map((r) => [r.id, r]))
  const em = new Map(st.data.edges.map((r) => [r.id, r]))
  let rev = st.data.rev

  for (const r of ids) {
    rev = Math.max(rev, r.rev ?? 0)
    if (r.deleted_at) im.delete(r.id)
    else im.set(r.id, r)
  }
  for (const r of nds) {
    rev = Math.max(rev, r.rev ?? 0)
    if (r.deleted_at) nm.delete(r.id)
    else nm.set(r.id, r)
  }
  for (const r of eds) {
    rev = Math.max(rev, r.rev ?? 0)
    if (r.deleted_at) em.delete(r.id)
    else em.set(r.id, r)
  }

  const sel = st.selected
  let nextSelected = sel
  if (sel) {
    const alive = sel.kind === 'identity' ? im.has(sel.id) : nm.has(sel.id)
    if (!alive) nextSelected = null
  }
  const focus = st.focusIdentity
  const nextFocus = focus != null && im.has(focus) ? focus : null

  set({
    data: {
      identities: [...im.values()].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
      nodes: [...nm.values()],
      edges: [...em.values()],
      rev,
    },
    selected: nextSelected,
    focusIdentity: nextFocus,
  })
}

export async function pull(): Promise<void> {
  const st = useStore.getState()
  if (!st.session || pulling) return
  pulling = true
  set({ syncing: true })
  const since = st.data.rev
  let seeded = false
  try {
    const [ids, nds, eds] = await Promise.all([
      fetchTable('identities', since),
      fetchTable('nodes', since),
      fetchTable('edges', since),
    ])
    merge(ids, nds, eds)
    set({ status: 'idle' })
    if (since === 0) seeded = await seedIfEmpty()
  } catch (e) {
    set({ status: 'offline' })
    if (since === 0) throw e
  } finally {
    pulling = false
    set({ syncing: false })
  }
  if (seeded) await pull()
}

let timer: number | undefined
let channel: BroadcastChannel | null = null

function onVisible() {
  if (document.visibilityState === 'visible') void pull().catch(() => {})
}

export function startSync() {
  stopSync()
  void pull().catch((e) => toast(errText(e), 'error'))
  timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void pull().catch(() => {})
  }, 1500)
  document.addEventListener('visibilitychange', onVisible)
  try {
    channel = new BroadcastChannel('second-mind')
    channel.onmessage = () => void pull().catch(() => {})
  } catch {
    channel = null
  }
}

export function stopSync() {
  if (timer) window.clearInterval(timer)
  timer = undefined
  document.removeEventListener('visibilitychange', onVisible)
  channel?.close()
  channel = null
}

/** 本机写入后立即拉一次，并通知同浏览器的其它标签页。 */
function poke() {
  channel?.postMessage('changed')
  void pull().catch(() => {})
}

/* ------------------------------- 身份词 ------------------------------- */

export async function createIdentity(name: string): Promise<IdentityRow> {
  const st = useStore.getState()
  const color = st.data.identities.length % 8
  const sort = Date.now() % 100000
  const rows = unwrap(
    await db.from('identities').insert({ name: name.trim() || '未命名身份', color, sort_order: sort }).select(),
  ) as IdentityRow[]
  const row = rows[0]
  await pull()
  return row
}

export async function renameIdentity(id: number, name: string) {
  unwrap(await db.from('identities').update({ name }).eq('id', id).select())
  await pull()
}

export async function setIdentityColor(id: number, color: number) {
  unwrap(await db.from('identities').update({ color }).eq('id', id).select())
  await pull()
}

export async function deleteIdentity(id: number) {
  const st = useStore.getState()
  const nodeIds = st.data.nodes.filter((n) => n.identity_id === id).map((n) => n.id)
  const t = nowIso()
  await db.from('identities').update({ deleted_at: t }).eq('id', id)
  if (nodeIds.length) await db.from('nodes').update({ deleted_at: t }).in('id', nodeIds)
  await db.from('edges').update({ deleted_at: t }).eq('source_kind', 'identity').eq('source_id', id)
  await db.from('edges').update({ deleted_at: t }).eq('target_kind', 'identity').eq('target_id', id)
  if (nodeIds.length) await db.from('edges').update({ deleted_at: t }).in('source_id', nodeIds)
  await pull()
}

/* -------------------------------- 节点 -------------------------------- */

export async function createNode(input: {
  identityId: number
  parentId?: number | null
  kind: Kind
  title?: string
  x?: number | null
  y?: number | null
}): Promise<NodeRow> {
  const rows = unwrap(
    await db
      .from('nodes')
      .insert({
        identity_id: input.identityId,
        parent_id: input.parentId ?? null,
        kind: input.kind,
        title: input.title?.trim() || '新的' + input.kind,
        status: input.kind === 'todo' ? 'open' : null,
        progress: input.kind === 'progress' ? 0 : null,
        x: input.x ?? null,
        y: input.y ?? null,
      })
      .select(),
  ) as NodeRow[]
  await pull()
  return rows[0]
}

export async function updateNode(id: number, patch: Partial<NodeRow>) {
  unwrap(await db.from('nodes').update(patch).eq('id', id).select())
  await pull()
}

/** 拖拽结束时才落库，避免每一帧都写一次。 */
export async function saveNodePosition(id: number, x: number, y: number) {
  await db.from('nodes').update({ x, y }).eq('id', id)
}

export async function saveIdentityPosition(id: number, x: number, y: number) {
  await db.from('identities').update({ x, y }).eq('id', id)
}

export async function deleteNode(id: number) {
  const st = useStore.getState()
  const ids = new Set<number>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const n of st.data.nodes) {
      if (n.parent_id != null && ids.has(n.parent_id) && !ids.has(n.id)) {
        ids.add(n.id)
        grew = true
      }
    }
  }
  const all = [...ids]
  const t = nowIso()
  await db.from('nodes').update({ deleted_at: t }).in('id', all)
  await db.from('edges').update({ deleted_at: t }).in('source_id', all)
  await db.from('edges').update({ deleted_at: t }).in('target_id', all)
  await pull()
}

/* -------------------------------- 连线 -------------------------------- */

export async function createEdge(source: Ref, target: Ref) {
  if (source.kind === target.kind && source.id === target.id) return
  const st = useStore.getState()
  const dup = st.data.edges.some(
    (e) =>
      e.source_kind === source.kind &&
      e.source_id === source.id &&
      e.target_kind === target.kind &&
      e.target_id === target.id,
  )
  if (dup) {
    toast('这两个节点已经连过了', 'info')
    return
  }
  unwrap(
    await db
      .from('edges')
      .insert({
        source_id: source.id,
        source_kind: source.kind as RefKind,
        target_id: target.id,
        target_kind: target.kind as RefKind,
        kind: 'reference',
      })
      .select(),
  )
  await pull()
  toast('已建立连接', 'success')
}

export async function deleteEdge(id: number) {
  unwrap(await db.from('edges').update({ deleted_at: nowIso() }).eq('id', id).select())
  await pull()
}

/* -------------------------------- 设备 -------------------------------- */

const DKEY = 'sm.device.key'

export function deviceKey(): string {
  let k = localStorage.getItem(DKEY)
  if (!k) {
    k = crypto.randomUUID?.() ?? `d${Date.now()}${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DKEY, k)
  }
  return k
}

export function platformLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS 设备'
  if (/Android/i.test(ua)) return 'Android 设备'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows 设备'
  return '浏览器'
}

export async function claimDevice(): Promise<{
  status: 'ok' | 'limit' | 'unauthenticated'
  expires_at?: string
  devices?: DeviceRow[]
}> {
  const res = unwrap(
    await db.rpc('sm_claim_device', {
      p_key: deviceKey(),
      p_label: platformLabel(),
      p_platform: navigator.platform || '',
    }),
  ) as any
  if (res?.status === 'ok') set({ deviceExpiry: res.expires_at, deviceBlock: null })
  if (res?.status === 'limit') set({ deviceBlock: res.devices ?? [] })
  return res
}

export async function listDevices(): Promise<DeviceRow[]> {
  const rows = unwrap(
    await db.from('devices').select('*').is('revoked_at', null).order('last_seen_at', { ascending: false }),
  ) as DeviceRow[]
  return rows
}

export async function revokeDevice(id: number) {
  unwrap(await db.rpc('sm_revoke_device', { p_id: id }))
}

export async function bindOnBoot(): Promise<'ok' | 'expired' | 'revoked' | 'missing'> {
  const rows = unwrap(
    await db.from('devices').select('*').eq('device_key', deviceKey()).limit(1),
  ) as DeviceRow[]
  const row = rows?.[0]
  if (!row) return 'missing'
  if (row.revoked_at) return 'revoked'
  if (new Date(row.expires_at).getTime() < Date.now()) return 'expired'
  set({ deviceExpiry: row.expires_at })
  await db.from('devices').update({ last_seen_at: nowIso() }).eq('id', row.id)
  return 'ok'
}

/* ------------------------------ 首次示例 ------------------------------ */

async function seedIfEmpty(): Promise<boolean> {
  const st = useStore.getState()
  if (st.data.identities.length > 0) return false
  if (localStorage.getItem('sm.seeded') === '1') return false
  localStorage.setItem('sm.seeded', '1')

  const seeds: { name: string; kids: { kind: Kind; title: string }[] }[] = [
    { name: '设计师', kids: [{ kind: 'skill', title: '排版' }, { kind: 'skill', title: '配色' }, { kind: 'step', title: '临摹 20 张海报' }] },
    { name: '写作者', kids: [{ kind: 'skill', title: '结构感' }, { kind: 'todo', title: '每周写 1000 字' }] },
    { name: '吉他手', kids: [{ kind: 'step', title: '掌握横按' }, { kind: 'progress', title: '乐理基础' }] },
  ]

  for (let i = 0; i < seeds.length; i++) {
    const rows = unwrap(
      await db.from('identities').insert({ name: seeds[i].name, color: i, sort_order: i }).select(),
    ) as IdentityRow[]
    const identity = rows[0]
    if (!identity) continue
    const payload = seeds[i].kids.map((k) => ({
      identity_id: identity.id,
      kind: k.kind,
      title: k.title,
      status: k.kind === 'todo' ? 'open' : null,
      progress: k.kind === 'progress' ? 40 : null,
    }))
    await db.from('nodes').insert(payload)
  }
  return true
}
