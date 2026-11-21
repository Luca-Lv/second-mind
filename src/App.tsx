import { useEffect, useState } from 'react'
import { cloud } from './cloud'
import { bindOnBoot, claimDevice, startSync, stopSync } from './data'
import { applyTheme, openBoard, set, useStore } from './store'
import { Rail } from './components/Rail'
import { Inspector } from './components/Inspector'
import { DeviceLimitDialog, SettingsDialog } from './components/Settings'
import { BrandMark, Icon, ThemeToggle, ToastHost } from './components/ui'
import { Login } from './views/Login'
import { NetworkView } from './views/NetworkView'
import { BoardView } from './views/BoardView'
import { OutlineView } from './views/OutlineView'

export default function App() {
  const ready = useStore((s) => s.ready)
  const session = useStore((s) => s.session)
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selected)
  const identityName = useStore((s) => s.data.identities.find((i) => i.id === s.focusIdentity)?.name ?? '')
  const settings = useStore((s) => s.settings)
  const theme = useStore((s) => s.theme)
  const syncing = useStore((s) => s.syncing)

  useEffect(() => {
    applyTheme(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await cloud.auth.getSession()
        if (!alive) return
        if (!data) {
          set({ ready: true })
          return
        }
        const bind = await bindOnBoot()
        if (!alive) return
        if (bind === 'expired' || bind === 'revoked') {
          await cloud.auth.signOut()
          set({
            ready: true,
            session: null,
            loginNotice: bind === 'revoked' ? '这台设备已被注销，请重新验证手机号' : '登录已超过 15 天，请重新验证手机号',
          })
          return
        }
        if (bind === 'missing') {
          const r = await claimDevice()
          if (r.status === 'limit') {
            set({ session: data, ready: true })
            return
          }
        }
        set({ session: data, ready: true })
      } catch {
        set({ ready: true })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // 登录成功（含首次验证码登录）后就开启同步；退出时停掉
  useEffect(() => {
    if (session) startSync()
    else stopSync()
  }, [session])

  useEffect(() => {
    const off = cloud.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        stopSync()
        set({ session: null })
      }
    })
    return () => off?.()
  }, [])

  if (!ready) {
    return (
      <div style={{ height: '100dvh', display: 'grid', placeItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <BrandMark size={34} />
          <div className="skeleton" style={{ width: 120, height: 8 }} />
        </div>
      </div>
    )
  }

  if (!session) return <><Login /><ToastHost /></>

  const title = view === 'network' ? 'Network' : view === 'board' ? identityName || '工作台' : '大纲'

  return (
    <>
      <div className="shell">
        <Rail />
        <div className="main">
          <header className="topbar">
            <button className="icon-btn mobile-only" onClick={() => set({ rail: true })} aria-label="打开导航">
              <Icon name="menu" size={18} />
            </button>
            {view !== 'network' && (
              <button className="icon-btn" onClick={() => set({ view: 'network' })} aria-label="返回网络">
                <Icon name="chevron-left" size={16} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="topbar-title">{title}</div>
            </div>
            {syncing && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6 }}>同步中</span>
            )}
            <div className="spacer" />
            {view === 'board' && useStore.getState().focusIdentity != null && (
              <button className="icon-btn mobile-only" onClick={() => set({ view: 'outline' })} aria-label="大纲视图">
                <Icon name="list" size={16} />
              </button>
            )}
            <ThemeToggle />
            <button
              className="icon-btn mobile-only"
              onClick={() => {
                const first = useStore.getState().data.identities[0]
                if (first) openBoard(first.id)
              }}
              aria-label="进入工作台"
            >
              <Icon name="board" size={16} />
            </button>
          </header>

          {view === 'network' && <NetworkView />}
          {view === 'board' && <BoardView />}
          {view === 'outline' && <OutlineView />}
        </div>
        {selected && <Inspector />}
      </div>

      {settings && <SettingsDialog />}
      <DeviceLimitDialog />
      <ToastHost />
    </>
  )
}
