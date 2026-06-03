/** GET /api/hiring/pipeline-stages/ */
export interface PipelineStageRow {
  id: number
  org: number
  name: string
  code: string
  order: number
  stage_type: string
  is_terminal: boolean
  is_active: boolean
}

/** GET /api/hiring/demands/ — approved MRF line item rows */
export interface HiringDemandRow {
  id: number
  mrf_id: number
  site_id?: number | null
  site_name?: string | null
  client_id?: number | null
  client_name?: string | null
  job_role_id: number
  job_role_name?: string | null
  billing_type?: string | null
  requested_headcount: number
  application_count: number
  shortlisted_count: number
  selected_count: number
  offer_accepted_count: number
  open_count: number
}

export interface ApplicationStageHistoryBriefRow {
  id: number
  from_stage?: number | null
  from_stage_name?: string | null
  to_stage?: number | null
  to_stage_name?: string | null
  from_status?: string
  to_status?: string
  moved_by?: number | null
  moved_by_username?: string | null
  comment?: string
  created_at?: string
}

/** GET /api/hiring/applications/ */
export interface HiringApplicationRow {
  id: number
  org?: number
  candidate: number
  candidate_name?: string
  candidate_phone?: string
  mrf: number
  site: number
  site_name?: string
  client_name?: string | null
  job_role: number
  job_role_name?: string
  mrf_line_item: number
  current_stage?: number | null
  current_stage_name?: string | null
  current_stage_code?: string | null
  status: string
  match_score?: string | number | null
  shortlisted_by?: number | null
  shortlisted_at?: string | null
  client_visible?: boolean
  client_decision?: string | null
  client_decision_by?: number | null
  client_decision_at?: string | null
  client_decision_note?: string | null
  source_intake_submission?: number | null
  offer_status?: string | null
  offered_ctc?: string | null
  offer_joining_date?: string | null
  recent_stage_history?: ApplicationStageHistoryBriefRow[]
  created_at?: string
  updated_at?: string
}

export interface HiringApplicationWriteInput {
  candidate: number
  mrf?: number
  mrf_line_item?: number
  current_stage?: number | null
  source_intake_submission?: number | null
  match_score?: string | number | null
}

export interface MoveStageInput {
  stage_id?: number | null
  status?: string | null
  comment?: string
}

/** GET /api/hiring/offers/ */
export interface OfferRow {
  id: number
  hiring_application: number
  offered_ctc?: string | number | null
  salary_breakup?: unknown
  joining_date?: string | null
  status: string
  released_by?: number | null
  released_by_username?: string | null
  released_at?: string | null
  accepted_at?: string | null
  declined_at?: string | null
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface OfferCreateInput {
  hiring_application: number
  offered_ctc?: string | number | null
  salary_breakup?: unknown
  joining_date?: string | null
  notes?: string
}

export interface OfferUpdateInput {
  offered_ctc?: string | number | null
  salary_breakup?: unknown
  joining_date?: string | null
  notes?: string
}

export interface OfferActionInput {
  note?: string
}

export interface ShortlistCandidateInput {
  candidate: number
  match_result?: number | null
  comment?: string
}

export interface SendToClientReviewInput {
  note?: string
}

export interface BulkSendToClientReviewInput {
  application_ids?: number[] | null
  note?: string
}

export interface ClientDecisionInput {
  decision: 'approved' | 'rejected'
  note?: string
  override?: boolean
}

/** Candidate summary embedded in client review rows */
export interface ClientCandidateSummary {
  id: number
  full_name: string | null
  phone: string
  email: string
  current_role: string
  current_location: string
  total_experience_years: string | null
  availability_status: string
}

/** Resume summary embedded in client review rows (never includes raw_text) */
export interface ClientResumeSummary {
  confidence: string | null
  summary: string
  career_level: string
  primary_domain: string
}

/** GET /api/hiring/client-review/ */
export interface ClientReviewApplicationRow {
  id: number
  org?: number
  candidate: number
  candidate_summary?: ClientCandidateSummary | null
  mrf: number
  mrf_line_item?: number | null
  site: number
  site_name?: string | null
  client_name?: string | null
  job_role: number
  job_role_name?: string | null
  match_score?: string | number | null
  status: string
  current_stage?: number | null
  current_stage_name?: string | null
  client_visible?: boolean
  client_decision?: string | null
  client_decision_by?: number | null
  client_decision_by_username?: string | null
  client_decision_at?: string | null
  client_decision_note?: string | null
  resume_summary?: ClientResumeSummary | null
  created_at?: string
  updated_at?: string
}

/** Candidate summary embedded in ranked pool results */
export interface PoolCandidateSummary {
  id: number
  first_name: string
  last_name: string
  middle_name?: string
  full_name?: string | null
  phone: string
  email?: string | null
  current_role?: string | null
  current_company?: string | null
  current_location?: string | null
  total_experience_years?: string | number | null
  skills_count?: number
  lifecycle_status?: string
  availability_status?: string | null
}

/** GET /api/hiring/demands/{id}/candidate-pool/?ranked=true */
export interface CandidatePoolResultRow {
  candidate: PoolCandidateSummary
  score?: number | null
  match_status?: string | null
  score_breakdown?: Record<string, number | null>
  matched_skills?: string[]
  missing_skills?: string[]
  reasons?: string[]
  warnings?: string[]
}

/** POST /api/hiring/applications/{id}/convert-to-deployment/ */
export interface HiringDeploymentConversionInput {
  employee_code?: string | null
  joined_on?: string | null
  deployment_start_date?: string | null
  deployment_status?: 'planned' | 'active' | 'completed' | 'transferred' | 'cancelled'
  shift_hours?: string | number | null
  billing_type?: 'billable' | 'non_billable' | null
  allow_existing_employee?: boolean
}

export interface HiringDeploymentConversionResult {
  application: unknown
  employee: unknown
  deployment: unknown
  created_employee: boolean
  created_deployment: boolean
}

export interface CandidateMatchResultRow {
  id: number
  org?: number
  candidate: number
  mrf_line_item: number
  final_score?: string | number | null
  role_score?: string | number | null
  skill_score?: string | number | null
  experience_score?: string | number | null
  location_score?: string | number | null
  industry_score?: string | number | null
  education_score?: string | number | null
  salary_score?: string | number | null
  semantic_score?: string | number | null
  matched_skills?: unknown
  missing_skills?: unknown
  match_reason?: string | null
  warnings?: unknown
  match_details?: unknown
  match_score?: string | number | null
  match_source?: string | null
  is_auto_match?: boolean
  created_by?: number | null
  created_at?: string
}
