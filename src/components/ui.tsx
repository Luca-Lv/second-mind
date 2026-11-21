import { useEffect } from 'react'
import { applyTheme, set, useStore } from '../store'

export type IconName =
  | 'plus'
  | 'close'
  | 'trash'
  | 'check'
  | 'chevron'
  | 'chevron-left'
  | 'moon'
  | 'sun'
  | 'settings'
  | 'menu'
  | 'network'
  | 'board'
  | 'list'
  | 'refresh'
  | 'link'
  | 'arrow'
  | 'logout'
  | 'phone'
  | 'shield'

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  }
  switch (name) {
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
    case 'close':
      return <svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>
    case 'trash':
      return <svg {...common}><path d="M4 7h16M9.5 7V5h5v2M6.5 7l.8 12.2h9.4L17.5 7" /></svg>
    case 'check':
      return <svg {...common}><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>
    case 'chevron':
      return <svg {...common}><path d="M6 9l6 6 6-6" /></svg>
    case 'chevron-left':
      return <svg {...common}><path d="M15 6l-6 6 6 6" /></svg>
    case 'moon':
      return <svg {...common}><path d="M20.5 14.2A8.6 8.6 0 019.8 3.5 7.2 7.2 0 1020.5 14.2z" /></svg>
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.1" />
          <path d="M12 2.6v2.2M12 19.2v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.1" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.7 9a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.6V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.6 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </svg>
      )
    case 'menu':
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    case 'network':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.6" />
          <circle cx="5" cy="6" r="1.8" />
          <circle cx="19" cy="7" r="1.8" />
          <circle cx="6" cy="18" r="1.8" />
          <circle cx="18" cy="18" r="1.8" />
          <path d="M10 10.4L6.4 7.2M14 10.6l3.4-2.4M10.4 13.8l-3.2 2.6M13.8 13.6l3 2.8" />
        </svg>
      )
    case 'board':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="7" height="7" rx="1.6" />
          <rect x="14" y="8" width="7" height="7" rx="1.6" />
          <rect x="6" y="15" width="7" height="6" rx="1.6" />
        </svg>
      )
    case 'list':
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h10" /></svg>
    case 'refresh':
      return <svg {...common}><path d="M20 11.5A8 8 0 106.4 6.6M20 5v6h-6" /></svg>
    case 'link':
      return <svg {...common}><path d="M10 14a4 4 0 005.7 0l2.6-2.6a4 4 0 00-5.7-5.7L11.5 7" /><path d="M14 10a4 4 0 00-5.7 0l-2.6 2.6a4 4 0 005.7 5.7L12.5 17" /></svg>
    case 'arrow':
      return <svg {...common}><path d="M5 12h13M13 7l5 5-5 5" /></svg>
    case 'logout':
      return <svg {...common}><path d="M15 5h3.5A1.5 1.5 0 0120 6.5v11a1.5 1.5 0 01-1.5 1.5H15M10 8l-4 4 4 4M6 12h9" /></svg>
    case 'phone':
      return <svg {...common}><rect x="6.5" y="2.5" width="11" height="19" rx="2.6" /><path d="M10.5 18.5h3" /></svg>
    case 'shield':
      return <svg {...common}><path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>
    default:
      return null
  }
}

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="10.5" cy="16" r="6" fill="var(--primary)" />
      <circle cx="24" cy="10" r="3.2" fill="var(--id-1)" />
      <circle cx="24.5" cy="23" r="2.2" fill="var(--id-2)" />
      <path d="M15.6 13.8l5.5-2.9M15.8 18.2l6 3.6" stroke="var(--primary)" strokeOpacity="0.45" strokeWidth="1.4" />
    </svg>
  )
}

export function Dialog({
  title,
  desc,
  children,
  footer,
  onClose,
  width,
}: {
  title: string
  desc?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  onClose: () => void
  width?: number
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} style={width ? { maxWidth: width } : undefined}>
        <div className="dialog-head">
          <h2>{title}</h2>
          {desc && <p>{desc}</p>}
        </div>
        {children && <div className="dialog-body">{children}</div>}
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ToastHost() {
  const toast = useStore((s) => s.toast)
  if (!toast) return null
  return (
    <div className={`toast ${toast.tone}`} role="status" aria-live="polite">
      <span>{toast.text}</span>
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo?.()
            set({ toast: null })
          }}
        >
          撤销
        </button>
      )}
    </div>
  )
}

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const theme = useStore((s) => s.theme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      className="icon-btn"
      onClick={() => applyTheme(next)}
      aria-label={next === 'dark' ? '切换到深色版' : '切换到浅色版'}
      title={next === 'dark' ? '深色版' : '浅色版'}
      style={compact ? { width: 30, height: 30 } : undefined}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={compact ? 15 : 16} />
    </button>
  )
}
