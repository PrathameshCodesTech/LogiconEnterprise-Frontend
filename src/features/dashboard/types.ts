import type { ComponentType } from 'react'

export type DashboardAudience = 'all' | 'internal' | 'client' | 'field'

export type DashboardWidgetSize = 'small' | 'medium' | 'large' | 'full'

export type DashboardSectionId =
  | 'my_work'
  | 'operations'
  | 'approvals'
  | 'intake'
  | 'budget'
  | 'setup_health'

export interface DashboardWidgetConfig {
  id: string
  title: string
  description?: string
  section: DashboardSectionId
  size: DashboardWidgetSize
  /** User must have every capability listed. */
  requiredCapabilities?: string[]
  /** User must have at least one of these capabilities. */
  anyCapabilities?: string[]
  /** If set, `me.user_type` must match one entry (after normalizing). Omit for all audiences. */
  audience?: DashboardAudience[]
  component: ComponentType
}

export const DASHBOARD_SECTION_ORDER: DashboardSectionId[] = [
  'my_work',
  'operations',
  'approvals',
  'intake',
  'budget',
  'setup_health',
]

export const DASHBOARD_SECTION_LABELS: Record<DashboardSectionId, string> = {
  my_work: 'My work',
  operations: 'Operations',
  approvals: 'Approvals',
  intake: 'Intake',
  budget: 'Budget',
  setup_health: 'Setup health',
}
