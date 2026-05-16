import { api } from '@/api/client'
import { unwrapDrfResults } from '@/types/api'
import type { CandidateRow } from '@/features/talent/types'
import type {
  CandidateMatchResultRow,
  HiringApplicationRow,
  HiringApplicationWriteInput,
  HiringDemandRow,
  MoveStageInput,
  PipelineStageRow,
} from '@/features/hiring/types'

export interface ListHiringDemandsParams {
  mrf?: number
  job_role?: number
  page?: number
}

export async function listHiringDemands(params?: ListHiringDemandsParams): Promise<{ items: HiringDemandRow[]; count?: number }> {
  const res = await api.get('/api/hiring/demands/', { params })
  return unwrapDrfResults<HiringDemandRow>(res.data)
}

export async function getHiringDemand(id: number): Promise<HiringDemandRow> {
  const res = await api.get(`/api/hiring/demands/${id}/`)
  return res.data as HiringDemandRow
}

export interface ListDemandCandidatePoolParams {
  role?: string
  location?: string
  skill?: string
  min_experience?: string | number
  max_experience?: string | number
  page?: number
}

export async function listDemandCandidatePool(
  demandId: number,
  params?: ListDemandCandidatePoolParams,
): Promise<{ items: CandidateRow[]; count?: number }> {
  const res = await api.get(`/api/hiring/demands/${demandId}/candidate-pool/`, { params })
  return unwrapDrfResults<CandidateRow>(res.data)
}

export interface ListPipelineStagesParams {
  stage_type?: string
  is_terminal?: boolean
  page?: number
}

export async function listPipelineStages(params?: ListPipelineStagesParams): Promise<{ items: PipelineStageRow[]; count?: number }> {
  const res = await api.get('/api/hiring/pipeline-stages/', { params })
  return unwrapDrfResults<PipelineStageRow>(res.data)
}

export interface ListHiringApplicationsParams {
  org?: number
  site?: number
  job_role?: number
  status?: string
  client_visible?: boolean
  client_decision?: string
  search?: string
  page?: number
}

export async function listHiringApplications(
  params?: ListHiringApplicationsParams,
): Promise<{ items: HiringApplicationRow[]; count?: number }> {
  const res = await api.get('/api/hiring/applications/', {
    params: {
      ...params,
      client_visible: typeof params?.client_visible === 'boolean' ? String(params.client_visible) : params?.client_visible,
    },
  })
  return unwrapDrfResults<HiringApplicationRow>(res.data)
}

export async function getHiringApplication(id: number): Promise<HiringApplicationRow> {
  const res = await api.get(`/api/hiring/applications/${id}/`)
  return res.data as HiringApplicationRow
}

export async function createHiringApplication(payload: HiringApplicationWriteInput): Promise<HiringApplicationRow> {
  const res = await api.post('/api/hiring/applications/', payload)
  return res.data as HiringApplicationRow
}

export async function updateHiringApplication(
  id: number,
  payload: Partial<{ client_visible: boolean; client_decision: string | null; client_decision_note: string; match_score: string | null }>,
): Promise<HiringApplicationRow> {
  const res = await api.patch(`/api/hiring/applications/${id}/`, payload)
  return res.data as HiringApplicationRow
}

export async function moveHiringApplicationStage(id: number, payload: MoveStageInput): Promise<HiringApplicationRow> {
  const body: Record<string, unknown> = {}
  if (payload.stage_id != null) body.stage_id = payload.stage_id
  if (payload.status != null && payload.status !== '') body.status = payload.status
  if (payload.comment != null) body.comment = payload.comment
  const res = await api.post(`/api/hiring/applications/${id}/move-stage/`, body)
  return res.data as HiringApplicationRow
}

export interface ListCandidateMatchResultsParams {
  org?: number
  candidate?: number
  mrf_line_item?: number
  match_source?: string
  is_auto_match?: boolean
  page?: number
}

export async function listCandidateMatchResults(
  params?: ListCandidateMatchResultsParams,
): Promise<{ items: CandidateMatchResultRow[]; count?: number }> {
  const res = await api.get('/api/hiring/match-results/', {
    params: {
      ...params,
      is_auto_match: typeof params?.is_auto_match === 'boolean' ? String(params.is_auto_match) : params?.is_auto_match,
    },
  })
  return unwrapDrfResults<CandidateMatchResultRow>(res.data)
}
