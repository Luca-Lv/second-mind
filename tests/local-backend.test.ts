/**
 * 本地后端（localStorage 模式）的烟雾测试，不依赖浏览器或任何服务端。
 *
 * 覆盖：CRUD、rev 增量游标、分页、软删除、以及「15 天 / 3 台设备」的服务端裁决。
 * 运行：npm test
 */
import { localDb as db } from '../src/backend/local'

let failed = 0

function ok(label: string, cond: unknown) {
  if (cond) {
    console.log(`  ok   ${label}`)
  } else {
    failed++
    console.error(`  FAIL ${label}`)
  }
}

async function main() {
  // 每次都从干净状态开始
  db.reset()

  console.log('identities / nodes')
  const ids = await db.from('identities').insert({ name: '设计师', color: 1, sort_order: 1 }).select()
  ok('insert 返回新行', Array.isArray(ids.data) && ids.data.length === 1)
  ok('id 自增', ids.data[0].id === 1)
  ok('owner_id 自动填充', ids.data[0].owner_id === 'local-user')

  const id = ids.data[0].id
  await db.from('nodes').insert([
    { identity_id: id, kind: 'skill', title: '排版' },
    { identity_id: id, kind: 'todo', title: '临摹 20 张', status: 'open' },
  ])
  const nodes = await db.from('nodes').select('*').eq('identity_id', id)
  ok('批量插入 2 行', nodes.data.length === 2)
  ok('kind 默认值保留', nodes.data[0].kind === 'skill')

  console.log('update / rev')
  const first = nodes.data[0]
  await db.from('nodes').update({ title: '排版 / 网格' }).eq('id', first.id).select()
  const reread = await db.from('nodes').select('*').eq('id', first.id)
  ok('update 生效', reread.data[0].title === '排版 / 网格')
  ok('update 推进 rev', reread.data[0].rev > first.rev)

  const since = Math.max(...nodes.data.map((r: any) => r.rev))
  const delta = await db.from('nodes').select('*').gt('rev', since).order('rev', { ascending: true })
  ok('增量查询只返回更新的行', delta.data.length === 1 && delta.data[0].id === first.id)

  const paged = await db.from('nodes').select('*').order('rev', { ascending: true }).range(0, 0)
  ok('range 分页', paged.data.length === 1)

  const soft = await db.from('nodes').update({ deleted_at: new Date().toISOString() }).eq('id', first.id)
  ok('软删除不返回行', soft.data === null)
  const left = await db.from('nodes').select('*').eq('identity_id', id)
  ok('软删后行仍保留（由上层过滤）', left.data.length === 2)

  console.log('devices')
  const a = await db.rpc('sm_claim_device', { p_key: 'dev-A', p_label: 'Mac', p_platform: 'mac' })
  const a2 = await db.rpc('sm_claim_device', { p_key: 'dev-A', p_label: 'Mac', p_platform: 'mac' })
  ok('重复认领复用同一台设备', a.data.status === 'ok' && a2.data.device_id === a.data.device_id)
  ok('信任期约 15 天', new Date(a2.data.expires_at).getTime() - Date.now() > 14 * 86400000)

  await db.rpc('sm_claim_device', { p_key: 'dev-B', p_label: 'iPhone', p_platform: 'ios' })
  await db.rpc('sm_claim_device', { p_key: 'dev-C', p_label: 'iPad', p_platform: 'ios' })
  const d = await db.rpc('sm_claim_device', { p_key: 'dev-D', p_label: 'PC', p_platform: 'win' })
  ok('第 4 台被拦下', d.data.status === 'limit')
  ok('拦下时返回可注销列表', d.data.devices.length === 3)

  const revoke = await db.rpc('sm_revoke_device', { p_id: a.data.device_id })
  ok('注销成功', revoke.data.revoked === 1)
  const retry = await db.rpc('sm_claim_device', { p_key: 'dev-D', p_label: 'PC', p_platform: 'win' })
  ok('踢掉一台后可进入', retry.data.status === 'ok')

  const devices = await db
    .from('devices')
    .select('*')
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false })
  ok('活跃设备恰为 3 台', devices.data.length === 3)

  console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`)
  if (failed > 0) (globalThis as any).process.exitCode = 1
}

void main()
