import type { HiringApplicationRow } from '@/features/hiring/types'

/** GET /api/talent/candidates/ */
export interface CandidateRow {
  id: number
  org?: number
  phone: string
  phone_normalized?: string
  first_name: string
  middle_name?: string
  last_name: string
  full_name?: string
  email?: string
  current_location?: string | null
  total_experience_years?: string | number | null
  current_ctc?: string | null
  expected_ctc?: string | null
  source?: string
  is_blacklisted?: boolean
  blacklist_reason?: string | null
  lifecycle_status?: string
  availability_status?: string | null
  preferred_location?: string | null
  notice_period_days?: number | null
  current_company?: string | null
  current_role?: string | null
  source_reference?: string | null
  is_duplicate?: boolean
  do_not_contact?: boolean
  skills_count?: number
  resume_count?: number
  latest_resume_status?: string | null
  active_application_count?: number
  created_at?: string
  updated_at?: string
}

export interface CandidateWriteInput {
  phone: string
  first_name: string
  middle_name?: string
  last_name: string
  email?: string
  current_location?: string
  total_experience_years?: string | number | null
  current_ctc?: string | number | null
  expected_ctc?: string | number | null
  source?: string
  lifecycle_status?: string
  availability_status?: string
  preferred_location?: string
  notice_period_days?: number | null
  current_company?: string
  current_role?: string
  source_reference?: string
}

export interface ResumeRow {
  id: number
  candidate: number
  file?: string
  original_filename?: string
  content_type?: string
  size_bytes?: number | null
  parsed_status?: string
  uploaded_at?: string
  view_only_note?: string
  status?: string
  file_hash?: string
  source_type?: string
  error_message?: string
  manual_review_reason?: string
  uploaded_by?: number | null
}

export interface ManualResumeIntakeInput {
  first_name: string
  middle_name?: string
  last_name: string
  phone: string
  email?: string
  current_role?: string
  current_location?: string
  total_experience_years?: string | number | null
  preferred_location?: string
  notice_period_days?: number | null
  current_company?: string
  expected_ctc?: string | number | null
  current_ctc?: string | number | null
  resume_file: File
  view_only_note?: string
  skills?: string
  mrf?: number | null
  mrf_line_item?: number | null
  current_stage?: number | null
}

export interface CandidateSkillRow {
  id: number
  skill_name: string
  normalized_skill_name?: string
  confidence?: string | number | null
  years_experience?: string | number | null
  proficiency?: string | null
  source?: string | null
}

export interface ManualResumeIntakeResponse {
  candidate: CandidateRow
  resume: ResumeRow
  skills: CandidateSkillRow[]
  hiring_application: HiringApplicationRow | null
}

export interface CandidateExperienceRow {
  id: number
  candidate: number
  job_title: string
  normalized_title?: string | null
  company_name?: string | null
  industry?: string | null
  start_date?: string | null
  end_date?: string | null
  is_current?: boolean
  duration_months?: number | null
  description?: string
  responsibilities?: string
  confidence?: string | number | null
  created_at?: string
  updated_at?: string
}

export interface CandidateEducationRow {
  id: number
  candidate: number
  degree: string
  normalized_degree?: string | null
  specialization?: string | null
  institute?: string | null
  start_year?: number | null
  end_year?: number | null
  confidence?: string | number | null
  created_at?: string
  updated_at?: string
}

export interface ParsedResumeRow {
  id: number
  resume: number
  summary?: string | null
  career_level?: string | null
  primary_domain?: string | null
  confidence?: string | number | null
  created_at?: string
  updated_at?: string
}
