import type { SkillCategory } from '@/api/jobs'

export type { SkillCategory }
export type HiringLane = 'client_billable' | 'internal_non_billable'

export const SKILL_CATEGORY_OPTIONS: { value: SkillCategory; label: string }[] = [
  { value: 'unskilled', label: 'Unskilled' },
  { value: 'semi_skilled', label: 'Semi-skilled' },
  { value: 'skilled', label: 'Skilled' },
  { value: 'highly_skilled', label: 'Highly skilled' },
  { value: 'supervisor', label: 'Supervisor' },
]

export function skillCategoryLabel(value: SkillCategory, display?: string | null) {
  const d = display?.trim()
  if (d) return d
  return SKILL_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export const HIRING_LANE_OPTIONS: { value: HiringLane; label: string }[] = [
  { value: 'client_billable', label: 'Client site manpower' },
  { value: 'internal_non_billable', label: 'Internal staff hiring' },
]

export function hiringLaneLabel(value?: string | null, display?: string | null) {
  const d = display?.trim()
  if (d) return d
  return HIRING_LANE_OPTIONS.find((o) => o.value === value)?.label ?? value ?? 'Unassigned'
}

export function hiringLaneBadgeVariant(value?: string | null): 'info' | 'warning' | 'neutral' {
  if (value === 'client_billable') return 'info'
  if (value === 'internal_non_billable') return 'warning'
  return 'neutral'
}
