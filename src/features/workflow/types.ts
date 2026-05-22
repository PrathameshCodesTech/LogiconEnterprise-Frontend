/** MRF serializer workflow_status (includes synthetic not_started). */
export type WorkflowStatus = 'not_started' | 'active' | 'approved' | 'rejected' | 'cancelled' | string

export type WorkflowAction = 'approve' | 'reject' | 'request_changes'

export interface WorkflowActionPayload {
  action: WorkflowAction
  comment?: string
}

export interface WorkflowReassignPayload {
  new_user: number
  comment?: string
}

export interface WorkflowConfigCheckStep {
  step_code: string
  step_name: string
  assignment_ok: boolean
  assignment_level: null | 'org' | 'client' | 'site'
  department: string | null
  assigned_user: string | null
}

export interface WorkflowConfigCheck {
  ok: boolean
  /** Present for MRF workflow config checks. */
  mrf?: number | null
  /** Present for client onboarding workflow config checks. */
  client_onboarding_request?: number | null
  template: null | { id: number; name: string; code: string }
  mapping_level: null | 'org' | 'client' | 'site'
  steps: WorkflowConfigCheckStep[]
  errors: string[]
  warnings: string[]
}

/** Step instance from GET /api/workflow/instances/{id}/ — fields optional for defensive UI. */
export interface WorkflowStepInstance {
  id: number
  step_order?: number
  step_code?: string | null
  step_name?: string | null
  status?: string | null
  assigned_user?: number | null
  assigned_user_username?: string | null
  assigned_department_name_snapshot?: string | null
  acted_by?: number | null
  acted_by_username?: string | null
  acted_at?: string | null
  comment?: string | null
  action_taken?: string | null
  activated_at?: string | null
  due_at?: string | null
}

export interface WorkflowAuditEntry {
  id?: number
  action?: string | null
  actor?: number | null
  actor_username?: string | null
  comment?: string | null
  created_at?: string | null
  step_instance?: number | null
}

export interface WorkflowInstance {
  id: number
  mrf?: number | null
  client_onboarding_request?: number | null
  org?: number
  template?: number
  status?: string
  started_at?: string | null
  completed_at?: string | null
  initiated_by?: number | null
  initiated_by_username?: string | null
  steps?: WorkflowStepInstance[]
  audit_trail?: WorkflowAuditEntry[]
  current_step?: WorkflowStepInstance | null
}

/** Row from GET /api/workflow/my-tasks/ */
export type WorkflowMyTaskTargetType = 'mrf' | 'client_onboarding'

export interface WorkflowMyTask {
  workflow_id: number
  step_id: number
  step_code: string
  step_name: string
  step_status: string
  assigned_user: number | null
  assigned_user_username: string | null
  assigned_department_name: string | null
  assigned_department_code: string | null
  activated_at: string | null
  due_at: string | null

  target_type: WorkflowMyTaskTargetType
  target_id: number
  target_title: string
  target_status: string
  target_url: string

  client_id: number | null
  client_name: string | null
  site_id: number | null
  site_name: string | null

  requesting_department_name: string | null
  required_department_name: string | null
  line_item_count: number | null
}

export interface WorkflowMyTaskListResponse {
  count: number
  results: WorkflowMyTask[]
}

/** GET /api/workflow/my-tasks/{step_id}/ */
export interface WorkflowTaskDetailResponse {
  task: WorkflowMyTask
  workflow: WorkflowTaskWorkflow
  target: WorkflowTaskTarget
  actions: WorkflowTaskActions
}

export interface WorkflowTaskWorkflow {
  id: number
  status: string
  template: number | null
  template_name: string | null
  template_version: number | null
  started_at: string | null
  completed_at: string | null
  current_step_id: number | null
  steps: WorkflowTaskStep[]
  audit_trail: WorkflowTaskAuditEntry[]
}

export interface WorkflowTaskStep {
  id: number
  step_order: number
  step_code: string
  step_name: string
  status: string
  assigned_user: number | null
  assigned_user_username: string | null
  assigned_department_name: string | null
  acted_by_username: string | null
  acted_at: string | null
  action_taken: string
}

export interface WorkflowTaskAuditEntry {
  id: number
  action: string
  actor_username: string | null
  comment: string
  created_at: string
}

export type WorkflowTaskTarget =
  | {
      type: 'mrf'
      mrf: WorkflowTaskMRF
      line_items: WorkflowTaskMRFLineItem[]
    }
  | {
      type: 'client_onboarding'
      client_onboarding: WorkflowTaskClientOnboarding
      line_items: []
    }

export interface WorkflowTaskMRF {
  id: number
  status: string
  mrf_type: string
  requested_by_username: string | null
  requested_by_type: string
  site: number | null
  site_name: string | null
  client_id: number | null
  client_name: string | null
  requesting_department: number | null
  requesting_department_name: string | null
  required_department: number | null
  required_department_name: string | null
  billing_type: string
  required_by_date: string | null
  reason: string
  client_visible: boolean
  budget_plan: number | null
  budget_plan_name: string | null
  budget_plan_code: string | null
  budget_plan_amount: string | null
  budget_plan_currency: string | null
  budget_plan_status: string | null
  budget_reserved_amount?: string | null
  budget_committed_amount?: string | null
  budget_reservation_status?: string | null
  resolved_budget_plan_id?: number | null
  resolved_budget_plan_name?: string | null
  resolved_budget_plan_code?: string | null
  resolved_budget_scope?: string | null
  resolved_budget_total_amount?: string | null
  resolved_budget_reserved_amount?: string | null
  resolved_budget_committed_amount?: string | null
  resolved_budget_available_amount?: string | null
  requested_budget_amount?: string | null
  budget_after_request_available_amount?: string | null
}

export interface WorkflowTaskMRFLineItem {
  id: number
  job_role: number | null
  job_role_name: string | null
  headcount: number
  site_role_requirement: number | null
  site_role_requirement_label?: string | null
  srr_approved_headcount?: number | null
  srr_remaining_headcount?: number | null
  wage_category_name: string | null
  wage_min_requested: string | null
  wage_max_requested: string | null
  billing_rate_snapshot: string | null
  srr_billing_rate?: string | null
  master_wage_min_snapshot?: string | null
  master_wage_max_snapshot?: string | null
  master_billing_rate_snapshot?: string | null
  commercial_override_enabled?: boolean
  commercial_override_reason?: string | null
  commercial_overridden_at?: string | null
  budget_plan: number | null
  budget_plan_name: string | null
}

export interface WorkflowTaskOnboardingProposedSite {
  id: number
  name: string
  code: string
  address: string
  city: string
  state: string
  pincode: string
  contact_person: string
  contact_phone: string
  contact_email: string
  location_area: number | null
  location_area_name: string | null
  is_active: boolean
}

export interface WorkflowTaskOnboardingProposedDepartment {
  id: number
  name: string
  code: string
  scope_level: string
  description: string
  proposed_site: number | null
  proposed_site_name: string | null
  is_active: boolean
}

export interface WorkflowTaskOnboardingProposedRoleRequirement {
  id: number
  proposed_site: number
  proposed_site_name: string | null
  proposed_department: number | null
  proposed_department_name: string | null
  job_role: number
  job_role_name: string | null
  approved_headcount: number
  billing_type: string
  billing_rate: string | null
  wage_min: string | null
  wage_max: string | null
  shift_hours: string | null
  wage_category: number | null
  wage_category_name: string | null
  effective_from: string | null
  effective_to: string | null
  is_active: boolean
}

export interface WorkflowTaskOnboardingProposedBudget {
  id: number
  name: string
  code: string
  budget_nature: string
  budget_type: string
  scope_level: string
  proposed_site: number | null
  proposed_site_name: string | null
  proposed_department: number | null
  proposed_department_name: string | null
  amount: string
  currency: string
  period_start: string
  period_end: string | null
  notes: string
  is_active: boolean
}

export interface WorkflowTaskOnboardingProposedUser {
  id: number
  full_name: string
  email: string
  phone: string
  user_type: string
  access_role: number
  access_role_code: string | null
  access_role_name: string | null
  scope_level: string
  proposed_site: number | null
  proposed_site_name: string | null
  is_primary_contact: boolean
  send_invite_on_finalization: boolean
  is_active: boolean
  created_user: number | null
  invite_status: string
}

export interface WorkflowTaskClientOnboarding {
  id: number
  status: string
  onboarding_type: string
  client: number | null
  client_name: string | null
  requested_by_username: string | null
  summary: string
  expected_sites_count: number | null
  budget_plan: number | null
  budget_plan_name: string | null
  notes: string
  proposed_client_name: string
  proposed_client_code: string
  proposed_contact_name: string
  proposed_contact_email: string
  proposed_contact_phone: string
  proposed_industry: string
  proposed_billing_address: string
  proposed_gst_number: string
  finalization_status: string
  created_client: number | null
  proposed_sites: WorkflowTaskOnboardingProposedSite[]
  proposed_departments: WorkflowTaskOnboardingProposedDepartment[]
  proposed_role_requirements: WorkflowTaskOnboardingProposedRoleRequirement[]
  proposed_budgets: WorkflowTaskOnboardingProposedBudget[]
  proposed_users: WorkflowTaskOnboardingProposedUser[]
}

export interface WorkflowTaskActions {
  can_approve: boolean
  can_reject: boolean
  can_request_changes: boolean
  act_url: string
}

/** GET /api/workflow/routes/available/ preview step (matches backend `build_approval_route_preview`). */
export interface ApprovalRouteStepPreview {
  order: number
  step_code: string
  step_name: string
  assignment_ok: boolean
  assigned_user: number | null
  assigned_user_username: string | null
  assigned_user_name?: string | null
  department: number | null
  department_name: string | null
  errors?: string[]
}

export interface ApprovalRoutePreview {
  id: number
  name: string
  code: string
  trigger_type: string
  template: number
  template_name: string
  template_code: string
  scope_level: 'org' | 'client' | 'site'
  is_default: boolean
  description?: string | null
  ok: boolean
  errors: string[]
  steps: ApprovalRouteStepPreview[]
}

export interface ApprovalRoutePreviewListResponse {
  count: number
  results: ApprovalRoutePreview[]
}
