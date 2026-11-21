import { create } from 'zustand'
import type { DeviceRow, EdgeRow, IdentityRow, NodeRow, Ref } from './types'

export interface Data {
  identities: IdentityRow[]
  nodes: NodeRow[]
  edges: EdgeRow[]
  rev: number
}

export type View = 'network' | 'board' | 'outline'
export type Theme = 'light' | 'dark'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'error'
  undo?: () => void
}

interface State {
  ready: boolean
  session: any | null
  theme: Theme
  view: View
  data: Data
  focusIdentity: number | null
  selected: Ref | null
  status: 'idle' | 'syncing' | 'offline'
  syncing: boolean
  toast: Toast | null
  settings: boolean
  rail: boolean
  deviceBlock: DeviceRow[] | null
  deviceExpiry: string | null
  loginNotice: string | null
}

const empty: Data = { identities: [], nodes: [], edges: [], rev: 0 }

function initialTheme(): Theme {
  const saved = localStorage.getItem('sm.theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useStore = create<State>(() => ({
  ready: false,
  session: null,
  theme: initialTheme(),
  view: 'network',
  data: empty,
  focusIdentity: null,
  selected: null,
  status: 'idle',
  syncing: false,
  toast: null,
  settings: false,
  rail: false,
  deviceBlock: null,
  deviceExpiry: null,
  loginNotice: null,
}))

export const set = useStore.setState

let toastSeq = 0
export function toast(text: string, tone: Toast['tone'] = 'info', undo?: () => void) {
  const id = ++toastSeq
  set({ toast: { id, text, tone, undo } })
  window.setTimeout(() => {
    if (useStore.getState().toast?.id === id) set({ toast: null })
  }, undo ? 6000 : 3200)
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('sm.theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D0F13' : '#F7F7F5')
  set({ theme })
}

export function openBoard(identityId: number) {
  set({ view: 'board', focusIdentity: identityId, selected: { kind: 'identity', id: identityId }, rail: false })
}

export function findIdentity(state: State, id: number | null) {
  if (id == null) return null
  return state.data.identities.find((i) => i.id === id) ?? null
}

/** 某个身份词下的全部内容节点（含多层后代）。 */
export function nodesOfIdentity(state: State, identityId: number): NodeRow[] {
  return state.data.nodes.filter((n) => n.identity_id === identityId)
}

export function childNodes(state: State, parentId: number): NodeRow[] {
  return state.data.nodes.filter((n) => n.parent_id === parentId)
}

export function nodeDegree(state: State, ref: Ref): number {
  const isIdentity = ref.kind === 'identity'
  const kids = isIdentity
    ? state.data.nodes.filter((n) => n.identity_id === ref.id).length
    : state.data.nodes.filter((n) => n.parent_id === ref.id).length
  const links = state.data.edges.filter(
    (e) =>
      (e.source_kind === ref.kind && e.source_id === ref.id) ||
      (e.target_kind === ref.kind && e.target_id === ref.id),
  ).length
  return kids + links
}
