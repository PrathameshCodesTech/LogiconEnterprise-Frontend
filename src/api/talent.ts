import { api } from '@/api/client'
import { unwrapDrfResults } from '@/types/api'
import type {
  CandidateEducationRow,
  CandidateExperienceRow,
  CandidateRow,
  CandidateWriteInput,
  ManualResumeIntakeResponse,
  ParsedResumeRow,
  ResumeRow,
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

/** POST /api/talent/manual-resume-intake/ — multipart FormData */
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
