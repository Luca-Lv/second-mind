import { useEffect, useState } from 'react'
import { cloud, errText, isLocalMode } from '../cloud'
import { claimDevice, deviceKey, listDevices, revokeDevice, stopSync } from '../data'
import { applyTheme, set, toast, useStore } from '../store'
import type { DeviceRow } from '../types'
import { Dialog, Icon } from './ui'

export function SettingsDialog() {
  const theme = useStore((s) => s.theme)
  const expiry = useStore((s) => s.deviceExpiry)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void listDevices()
      .then(setDevices)
      .catch(() => setDevices([]))
  }, [])

  const mine = deviceKey()

  async function signOut() {
    setBusy(true)
    try {
      await cloud.auth.signOut()
    } catch {
      /* 即使服务端失败也要清掉本地界面 */
    }
    stopSync()
    set({ session: null, data: { identities: [], nodes: [], edges: [], rev: 0 }, selected: null, settings: false, view: 'network' })
    setBusy(false)
  }

  return (
    <Dialog
      title="设置"
      desc="外观、登录状态与设备管理。"
      onClose={() => set({ settings: false })}
      footer={
        <>
          <button className="btn" onClick={() => set({ settings: false })}>
            关闭
          </button>
          <button className="btn btn-primary" onClick={signOut} disabled={busy}>
            {busy ? '退出中…' : '退出登录'}
          </button>
        </>
      }
    >
      <div style={{ padding: '4px 0 12px' }}>
        <span className="label">外观</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm"
            aria-pressed={theme === 'light'}
            style={theme === 'light' ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}
            onClick={() => applyTheme('light')}
          >
            <Icon name="sun" size={13} /> 浅色版
          </button>
          <button
            className="btn btn-sm"
            aria-pressed={theme === 'dark'}
            style={theme === 'dark' ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}
            onClick={() => applyTheme('dark')}
          >
            <Icon name="moon" size={13} /> 深色版
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
        <span className="label">{isLocalMode ? '本机设备' : '登录设备（同一手机号最多 3 台）'}</span>
        {devices.length === 0 && <div className="hint">读取中…</div>}
        {devices.map((d) => {
          const isMine = d.device_key === mine
          return (
            <div className="device-row" key={d.id}>
              <Icon name="phone" size={15} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="device-name">
                  {d.label || d.platform || '设备'} {isMine && <span className="badge-now">当前</span>}
                </div>
                <div className="device-meta">
                  最近活跃 {new Date(d.last_seen_at).toLocaleString('zh-CN', { hour12: false })} · 信任至{' '}
                  {new Date(d.expires_at).toLocaleDateString('zh-CN')}
                </div>
              </div>
              {!isMine && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={async () => {
                    await revokeDevice(d.id)
                    setDevices((prev) => prev.filter((x) => x.id !== d.id))
                    toast('已注销该设备', 'success')
                  }}
                >
                  注销
                </button>
              )}
            </div>
          )
        })}
        {expiry && (
          <div className="hint">
            这台设备将在 {new Date(expiry).toLocaleDateString('zh-CN')} 需要重新验证手机号。
          </div>
        )}
      </div>

      <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <Icon name="shield" size={14} />
          <strong style={{ fontWeight: 500 }}>数据边界</strong>
        </div>
        {isLocalMode ? (
          <>
            <strong style={{ fontWeight: 500 }}>本地模式</strong>
            <br />
            内容只存在这台设备的浏览器里，不联网、不涉及账号。清除站点数据会一起清空。
            <br />
            想启用手机号登录与跨设备同步，按 README 配置 <code>VITE_CLOUD_ENDPOINT</code> 与{' '}
            <code>VITE_CLOUD_KEY</code> 后重新构建。
          </>
        ) : (
          <>
            内容按账号行级隔离，未验证手机号时服务端不返回任何数据。不同账号之间不联通、不可见。
            <br />
            实时的意思：本机改动立即生效，其它设备约 1–2 秒内合并。没网时改动会留在本地，联网后自动补上。
          </>
        )}
      </div>
    </Dialog>
  )
}

export function DeviceLimitDialog() {
  const block = useStore((s) => s.deviceBlock)
  const [busy, setBusy] = useState<number | null>(null)
  if (!block) return null

  return (
    <Dialog
      title="已达 3 台设备上限"
      desc="一个手机号最多同时登录 3 台设备。想在这台设备上继续，需要先注销一台。"
      onClose={async () => {
        // 只有 3 台以内才允许使用；关闭等于放弃这次登录
        try {
          await cloud.auth.signOut()
        } catch {
          /* ignore */
        }
        stopSync()
        set({
          session: null,
          deviceBlock: null,
          data: { identities: [], nodes: [], edges: [], rev: 0 },
          loginNotice: '设备数量已达上限，请先注销一台旧设备再登录',
        })
      }}
    >
      {block.map((d) => (
        <div className="device-row" key={d.id}>
          <Icon name="phone" size={15} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="device-name">{d.label || d.platform || '设备'}</div>
            <div className="device-meta">
              最近活跃 {new Date(d.last_seen_at).toLocaleString('zh-CN', { hour12: false })}
            </div>
          </div>
          <button
            className="btn btn-sm"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(d.id)
              try {
                await revokeDevice(d.id)
                const r = await claimDevice()
                if (r.status === 'ok') set({ deviceBlock: null })
              } catch (e) {
                toast(errText(e), 'error')
              } finally {
                setBusy(null)
              }
            }}
          >
            {busy === d.id ? '注销中…' : '注销这台'}
          </button>
        </div>
      ))}
    </Dialog>
  )
}
