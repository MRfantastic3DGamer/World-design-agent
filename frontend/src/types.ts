export type HitlStatus =
  | 'IDLE'
  | 'AWAITING_ROUTING'
  | 'AWAITING_PRE_SIM'
  | 'AWAITING_POST_SIM'
  | 'APPROVED'
  | 'REJECTED'

export interface StoryState {
  story_name: string
  current_version: string
  hitl_status: HitlStatus
  target_level?: number | null
  user_injected_idea?: string | null
  hitl_feedback?: string | null
  dirty_nodes: string[]
  routing_rationale?: string | null
  simulation_output?: Record<string, unknown> | null
  synthesis_output?: Record<string, unknown> | null
  backpropagation?: Record<string, unknown> | null
}

export type LevelData = Record<number, Record<string, unknown>>

export interface LevelMeta {
  level: number
  name: string
  label: string
  color: string
}

export const LEVEL_META: LevelMeta[] = [
  { level: 0, name: 'axioms', label: 'Axioms', color: '#8b5cf6' },
  { level: 1, name: 'macro', label: 'Macro', color: '#3b82f6' },
  { level: 2, name: 'meso', label: 'Meso', color: '#14b8a6' },
  { level: 3, name: 'micro', label: 'Micro', color: '#f59e0b' },
  { level: 4, name: 'nano', label: 'Nano', color: '#ef4444' },
]

export interface GraphNodeData extends Record<string, unknown> {
  kind: 'level' | 'entity'
  level: number
  label: string
  field?: string
  payload?: unknown
  summary?: string
  color?: string
  entityCount?: number
  isDirty?: boolean
}
