import { api } from '@/api/client'
import { unwrapDrfResults } from '@/types/api'
import type {
  ApplyReviewPayload,
  CandidateEducationRow,
  CandidateExperienceRow,
  CandidateRow,
  CandidateWriteInput,
  DuplicateResolutionPayload,
  ManualResumeIntakeResponse,
  ParsedResumeRow,
  ResumeReviewDetail,
  ResumeReviewQueueItem,
  ResumeRow,
  TalentResumeReviewRow,
} from '@/features/talent/types'

export interface ListCandidatesParams {
  search?: string
  skill?: string
  lifecycle_status?: string
  availability_status?: string
  source?: string
  is_blacklisted?: boolean
  page?: number
}

export async function listCandidates(params?: ListCandidatesParams): Promise<{ items: CandidateRow[]; count?: number }> {
  const res = await api.get('/api/talent/candidates/', { params })
  return unwrapDrfResults<CandidateRow>(res.data)
}

export async function getCandidate(id: number): Promise<CandidateRow> {
  const res = await api.get(`/api/talent/candidates/${id}/`)
  return res.data as CandidateRow
}

export async function createCandidate(payload: CandidateWriteInput): Promise<CandidateRow> {
  const res = await api.post('/api/talent/candidates/', payload)
  return res.data as CandidateRow
}

export async function updateCandidate(id: number, payload: Partial<CandidateWriteInput>): Promise<CandidateRow> {
  const res = await api.patch(`/api/talent/candidates/${id}/`, payload)
  return res.data as CandidateRow
}

export interface ListResumesParams {
  candidate?: number
  status?: string
  parsed_status?: string
  source_type?: string
  page?: number
}

export async function listResumes(params?: ListResumesParams): Promise<{ items: ResumeRow[]; count?: number }> {
  const res = await api.get('/api/talent/resumes/', { params })
  return unwrapDrfResults<ResumeRow>(res.data)
}

export async function getResume(id: number): Promise<ResumeRow> {
  const res = await api.get(`/api/talent/resumes/${id}/`)
  return res.data as ResumeRow
}

export async function uploadResume(formData: FormData): Promise<ResumeRow> {
  const res = await api.post('/api/talent/resumes/', formData)
  return res.data as ResumeRow
}

/** POST /api/talent/manual-resume-intake/ - multipart FormData */
export async function manualResumeIntake(formData: FormData): Promise<ManualResumeIntakeResponse> {
  const res = await api.post<ManualResumeIntakeResponse>('/api/talent/manual-resume-intake/', formData)
  return res.data
}

export interface ListCandidateExperiencesParams {
  candidate: number
  page?: number
}

export async function listCandidateExperiences(
  params: ListCandidateExperiencesParams,
): Promise<{ items: CandidateExperienceRow[]; count?: number }> {
  const res = await api.get('/api/talent/experiences/', { params })
  return unwrapDrfResults<CandidateExperienceRow>(res.data)
}

export interface ListCandidateEducationsParams {
  candidate: number
  page?: number
}

export async function listCandidateEducations(
  params: ListCandidateEducationsParams,
): Promise<{ items: CandidateEducationRow[]; count?: number }> {
  const res = await api.get('/api/talent/educations/', { params })
  return unwrapDrfResults<CandidateEducationRow>(res.data)
}

export interface ListParsedResumesParams {
  resume?: number
  page?: number
}

export async function listParsedResumes(params?: ListParsedResumesParams): Promise<{ items: ParsedResumeRow[]; count?: number }> {
  const res = await api.get('/api/talent/parsed-resumes/', { params })
  return unwrapDrfResults<ParsedResumeRow>(res.data)
}

export async function getResumeStatus(id: number): Promise<{ status: string; parsed_status: string }> {
  const res = await api.get(`/api/talent/resumes/${id}/status/`)
  return res.data as { status: string; parsed_status: string }
}

export interface ReprocessResumeOptions {
  override_duplicate?: boolean
  note?: string
}

export async function reprocessResume(id: number, opts?: ReprocessResumeOptions): Promise<{ detail: string }> {
  const res = await api.post(`/api/talent/resumes/${id}/reprocess/`, opts ?? {})
  return res.data as { detail: string }
}

export async function markResumeReviewed(id: number): Promise<{ detail: string }> {
  const res = await api.post(`/api/talent/resumes/${id}/mark-reviewed/`, {})
  return res.data as { detail: string }
}

export interface ListResumeReviewQueueParams {
  status?: string
  source_type?: string
  confidence_below?: string | number
  candidate?: string
  uploaded_from?: string
  uploaded_to?: string
  reason_contains?: string
}

export async function listResumeReviewQueue(
  params?: ListResumeReviewQueueParams,
): Promise<{ items: ResumeReviewQueueItem[]; count?: number }> {
  const res = await api.get('/api/talent/resumes/review-queue/', { params })
  return unwrapDrfResults<ResumeReviewQueueItem>(res.data)
}

export async function getResumeReviewDetail(id: number): Promise<ResumeReviewDetail> {
  const res = await api.get(`/api/talent/resumes/${id}/review-detail/`)
  return res.data as ResumeReviewDetail
}

export async function applyResumeReview(id: number, payload: ApplyReviewPayload): Promise<TalentResumeReviewRow> {
  const res = await api.post(`/api/talent/resumes/${id}/apply-review/`, payload)
  return res.data as TalentResumeReviewRow
}

export async function getResumeReviewHistory(id: number): Promise<TalentResumeReviewRow[]> {
  const res = await api.get(`/api/talent/resumes/${id}/review-history/`)
  const result = unwrapDrfResults<TalentResumeReviewRow>(res.data)
  return result.items
}

export async function resolveResumeDuplicate(
  id: number,
  payload: DuplicateResolutionPayload,
): Promise<TalentResumeReviewRow> {
  const res = await api.post(`/api/talent/resumes/${id}/resolve-duplicate/`, payload)
  return res.data as TalentResumeReviewRow
}
