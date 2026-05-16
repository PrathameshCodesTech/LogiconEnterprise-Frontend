import { api } from '@/api/client'
import { unwrapDrfResults, type DrfPaginated } from '@/types/api'
import type { BudgetPlanRow, BudgetPlanWritePayload } from '@/features/budgets/types'

export interface ListBudgetPlansParams {
  search?: string
  budget_nature?: string
  budget_type?: string
  client?: number
  site?: number
  department?: number
  status?: string
  is_active?: boolean
  page?: number
}

export async function listBudgetPlans(params: ListBudgetPlansParams) {
  const { data } = await api.get<DrfPaginated<BudgetPlanRow> | BudgetPlanRow[]>('/api/budgets/plans/', {
    params: {
      search: params.search || undefined,
      budget_nature: params.budget_nature || undefined,
      budget_type: params.budget_type || undefined,
      client: params.client ?? undefined,
      site: params.site ?? undefined,
      department: params.department ?? undefined,
      status: params.status || undefined,
      is_active: typeof params.is_active === 'boolean' ? String(params.is_active) : undefined,
      page: params.page ?? undefined,
    },
  })
  return unwrapDrfResults<BudgetPlanRow>(data)
}

export async function getBudgetPlan(id: number) {
  const { data } = await api.get<BudgetPlanRow>(`/api/budgets/plans/${id}/`)
  return data
}

export async function createBudgetPlan(payload: BudgetPlanWritePayload) {
  const { data } = await api.post<BudgetPlanRow>('/api/budgets/plans/', payload)
  return data
}

export async function updateBudgetPlan(id: number, payload: Partial<BudgetPlanWritePayload>) {
  const { data } = await api.patch<BudgetPlanRow>(`/api/budgets/plans/${id}/`, payload)
  return data
}

/** Soft-deactivate on backend (sets is_active=false, status=inactive). */
export async function deleteBudgetPlan(id: number) {
  await api.delete(`/api/budgets/plans/${id}/`)
}
