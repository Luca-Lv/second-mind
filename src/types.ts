export type Kind = 'skill' | 'step' | 'progress' | 'todo' | 'note' | 'question'

export interface IdentityRow {
  id: number
  owner_id: string
  name: string
  color: number
  sort_order: number
  x: number | null
  y: number | null
  rev: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface NodeRow {
  id: number
  owner_id: string
  identity_id: number | null
  parent_id: number | null
  kind: Kind
  title: string
  note: string | null
  status: string | null
  progress: number | null
  x: number | null
  y: number | null
  collapsed: boolean
  rev: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type RefKind = 'identity' | 'node'

export interface EdgeRow {
  id: number
  owner_id: string
  source_id: number
  target_id: number
  source_kind: RefKind
  target_kind: RefKind
  kind: string
  label: string | null
  rev: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface DeviceRow {
  id: number
  device_key: string
  label: string | null
  platform: string | null
  created_at: string
  last_seen_at: string
  expires_at: string
  revoked_at: string | null
}

export type Ref = { kind: RefKind; id: number }

export const refKey = (r: Ref): string => `${r.kind === 'identity' ? 'i' : 'n'}${r.id}`

export const KIND_LABEL: Record<Kind, string> = {
  skill: '技能',
  step: '步骤',
  progress: '进度',
  todo: '待办',
  note: '笔记',
  question: '疑问',
}

export const KINDS: Kind[] = ['skill', 'step', 'progress', 'todo', 'note', 'question']
