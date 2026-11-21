/**
 * 本地模式后端（零配置即可运行）
 * ---------------------------------------------------------------------------
 * 目标：`git clone && npm install && npm run dev` 就能完整用起来，不需要注册任何
 * 云服务、不需要手机号、不需要配数据库。
 *
 * 实现方式：模拟云数据库 PostgREST 风格的那一小部分链式 API（from / select /
 * insert / update / eq / in / is / gt / order / range / limit），把数据落到
 * localStorage。这样 `src/data.ts` 一行都不用改，两种模式共用同一套业务代码。
 *
 * 边界（README 里也写了）：
 * - 数据只在这台设备的这个浏览器里，换浏览器/清缓存即丢失
 * - 没有跨设备同步，没有账号隔离（本地模式只有一个"本地用户"）
 * - 需要真正的多设备同步与手机号登录，请配置 VITE_CLOUD_* 走云模式
 */

type Row = Record<string, any>

const DB_KEY = 'sm.local.db.v1'
const SESSION_KEY = 'sm.local.session.v1'
const OWNER = 'local-user'

interface Db {
  seq: number
  rev: number
  tables: Record<string, Row[]>
}

const blankDb = (): Db => ({
  seq: 1,
  rev: 1,
  tables: { identities: [], nodes: [], edges: [], devices: [] },
})

/* ----------------------------- 存储读写 ----------------------------- */

const memory: Record<string, string> = {}

function ls(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function read(key: string): string | null {
  const s = ls()
  return s ? s.getItem(key) : (memory[key] ?? null)
}

function write(key: string, value: string) {
  const s = ls()
  if (s) s.setItem(key, value)
  else memory[key] = value
}

function load(): Db {
  const raw = read(DB_KEY)
  if (!raw) return blankDb()
  try {
    const parsed = JSON.parse(raw) as Db
    const db = blankDb()
    db.seq = parsed.seq ?? 1
    db.rev = parsed.rev ?? 1
    for (const k of Object.keys(db.tables)) db.tables[k] = parsed.tables?.[k] ?? []
    return db
  } catch {
    return blankDb()
  }
}

function save(db: Db) {
  write(DB_KEY, JSON.stringify(db))
}

const nowIso = () => new Date().toISOString()
const clone = (r: Row): Row => ({ ...r })
const DAY = 86400000

/* ----------------------------- 查询构造器 ----------------------------- */

type Filter = (r: Row) => boolean

class Query implements PromiseLike<{ data: any; error: any }> {
  private op: 'select' | 'insert' | 'update' = 'select'
  private payload: any = null
  private filters: Filter[] = []
  private orderKey: string | null = null
  private asc = true
  private from = 0
  private to = -1
  private cap = -1
  private returning = false

  constructor(private table: string) {}

  select(_cols = '*') {
    // insert / update 之后的 select() 表示"返回受影响的行"
    if (this.op !== 'select') this.returning = true
    return this
  }

  insert(payload: any) {
    this.op = 'insert'
    this.payload = payload
    return this
  }

  update(patch: any) {
    this.op = 'update'
    this.payload = patch
    return this
  }

  eq(key: string, value: any) {
    this.filters.push((r) => r[key] === value)
    return this
  }

  in(key: string, values: any[]) {
    const set = new Set(values)
    this.filters.push((r) => set.has(r[key]))
    return this
  }

  is(key: string, value: null | boolean) {
    this.filters.push((r) => (r[key] ?? null) === value)
    return this
  }

  gt(key: string, value: any) {
    this.filters.push((r) => (r[key] ?? 0) > value)
    return this
  }

  order(key: string, opts?: { ascending?: boolean }) {
    this.orderKey = key
    this.asc = opts?.ascending !== false
    return this
  }

  range(from: number, to: number) {
    this.from = from
    this.to = to
    return this
  }

  limit(n: number) {
    this.cap = n
    return this
  }

  then<R1 = { data: any; error: any }, R2 = never>(
    onfulfilled?: ((v: { data: any; error: any }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.exec().then(onfulfilled, onrejected)
  }

  private defaults(p: Row): Row {
    const base: Row = {
      owner_id: OWNER,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
      rev: 0,
    }
    if (this.table === 'identities') {
      return { color: 0, sort_order: 0, x: null, y: null, ...base, ...p }
    }
    if (this.table === 'nodes') {
      return {
        identity_id: null,
        parent_id: null,
        kind: 'skill',
        title: '',
        note: null,
        status: null,
        progress: null,
        x: null,
        y: null,
        collapsed: false,
        ...base,
        ...p,
      }
    }
    if (this.table === 'edges') {
      return { kind: 'reference', label: null, source_kind: 'node', target_kind: 'node', ...base, ...p }
    }
    // devices
    return {
      device_key: '',
      label: null,
      platform: null,
      created_at: nowIso(),
      last_seen_at: nowIso(),
      expires_at: new Date(Date.now() + 15 * DAY).toISOString(),
      revoked_at: null,
      ...p,
    }
  }

  private async exec(): Promise<{ data: any; error: any }> {
    const db = load()
    if (!db.tables[this.table]) db.tables[this.table] = []
    const rows = db.tables[this.table]

    if (this.op === 'insert') {
      const list: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload]
      const made = list.map((p) => {
        const row = this.defaults(p)
        row.id = db.seq++
        row.rev = db.rev++
        return row
      })
      rows.push(...made)
      save(db)
      return { data: this.returning ? made.map(clone) : null, error: null }
    }

    if (this.op === 'update') {
      const touched: Row[] = []
      for (const r of rows) {
        if (!this.filters.every((f) => f(r))) continue
        Object.assign(r, this.payload, { rev: db.rev++, updated_at: nowIso() })
        touched.push(r)
      }
      save(db)
      return { data: this.returning ? touched.map(clone) : null, error: null }
    }

    let out = rows.filter((r) => this.filters.every((f) => f(r)))
    if (this.orderKey) {
      const k = this.orderKey
      out = [...out].sort((a, b) => {
        const x = a[k]
        const y = b[k]
        if (x == null && y == null) return 0
        if (x == null) return 1
        if (y == null) return -1
        const r = x < y ? -1 : x > y ? 1 : 0
        return this.asc ? r : -r
      })
    }
    if (this.to >= 0) out = out.slice(this.from, this.to + 1)
    else if (this.cap >= 0) out = out.slice(0, this.cap)
    else if (this.from > 0) out = out.slice(this.from)

    return { data: out.map(clone), error: null }
  }
}

/** 与 `db.from(...)` 保持同名的本地实现。 */
export const localDb = {
  from(table: string) {
    return new Query(table)
  },

  /** 只实现前端实际调用的两个 RPC，逻辑与云端的 SQL 函数一致。 */
  async rpc(fn: string, args: Row = {}): Promise<{ data: any; error: any }> {
    const db = load()
    const devices = db.tables.devices ?? (db.tables.devices = [])
    const now = Date.now()

    if (fn === 'sm_claim_device') {
      // 过期即视为已注销
      for (const d of devices) {
        if (!d.revoked_at && new Date(d.expires_at).getTime() < now) d.revoked_at = nowIso()
      }
      const mine = devices.find((d) => d.device_key === args.p_key)
      if (mine && !mine.revoked_at) {
        mine.last_seen_at = nowIso()
        mine.label = args.p_label ?? mine.label
        mine.platform = args.p_platform ?? mine.platform
        if (new Date(mine.expires_at).getTime() < now) {
          mine.expires_at = new Date(now + 15 * DAY).toISOString()
        }
        save(db)
        return { data: { status: 'ok', device_id: mine.id, expires_at: mine.expires_at }, error: null }
      }
      const alive = devices.filter(
        (d) => !d.revoked_at && new Date(d.expires_at).getTime() > now && d.device_key !== args.p_key,
      )
      if (alive.length >= 3) {
        save(db)
        return {
          data: {
            status: 'limit',
            devices: alive.map((d) => ({
              id: d.id,
              label: d.label,
              platform: d.platform,
              last_seen_at: d.last_seen_at,
            })),
          },
          error: null,
        }
      }
      if (mine) {
        Object.assign(mine, {
          revoked_at: null,
          last_seen_at: nowIso(),
          expires_at: new Date(now + 15 * DAY).toISOString(),
        })
        save(db)
        return { data: { status: 'ok', device_id: mine.id, expires_at: mine.expires_at }, error: null }
      }
      const row: Row = {
        id: db.seq++,
        rev: db.rev++,
        owner_id: OWNER,
        device_key: args.p_key,
        label: args.p_label ?? null,
        platform: args.p_platform ?? null,
        created_at: nowIso(),
        last_seen_at: nowIso(),
        expires_at: new Date(now + 15 * DAY).toISOString(),
        revoked_at: null,
      }
      devices.push(row)
      save(db)
      return { data: { status: 'ok', device_id: row.id, expires_at: row.expires_at }, error: null }
    }

    if (fn === 'sm_revoke_device') {
      let n = 0
      for (const d of devices) {
        if (d.id === args.p_id && !d.revoked_at) {
          d.revoked_at = nowIso()
          n++
        }
      }
      save(db)
      return { data: { status: 'ok', revoked: n }, error: null }
    }

    return { data: null, error: { message: `本地模式不支持 RPC: ${fn}` } }
  },

  /** 仅本地模式使用：清空这台设备上的全部数据。 */
  reset() {
    write(DB_KEY, JSON.stringify(blankDb()))
  },
}

/* -------------------------------- 认证 -------------------------------- */

type Listener = (event: string) => void
const listeners = new Set<Listener>()

function emit(event: string) {
  for (const fn of listeners) fn(event)
}

export function localSession(): { user: { id: string; phone: string } } | null {
  const raw = read(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** 本地模式没有短信通道，这里直接建立会话。 */
export function localSignIn(phone = '本地用户') {
  const session = { user: { id: OWNER, phone } }
  write(SESSION_KEY, JSON.stringify(session))
  emit('SIGNED_IN')
  return session
}

export const localAuth = {
  async getSession() {
    return { data: localSession(), error: null }
  },
  async signOut() {
    const s = ls()
    if (s) s.removeItem(SESSION_KEY)
    else delete memory[SESSION_KEY]
    emit('SIGNED_OUT')
    return { error: null }
  },
  onAuthStateChange(cb: Listener) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  async sendOtp(_args: { phone: string }) {
    return { data: { verificationId: 'local', isExistingUser: false }, error: null }
  },
  async verifyOtp(args: { phone: string }) {
    return { data: localSignIn(args.phone), error: null }
  },
}
