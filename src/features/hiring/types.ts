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
