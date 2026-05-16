import { api } from '@/api/client'
import { unwrapDrfResults, type DrfPaginated } from '@/types/api'

export interface DepartmentRow {
  id: number
  org: number
  client: number | null
  site: number | null
  name: string
  code: string
  description?: string
  is_active: boolean
  client_name?: string | null
  site_name?: string | null
}

export interface DepartmentOption {
  id: number
  label: string
  scopeLabel?: string
}

export function departmentToFormOption(d: DepartmentRow): DepartmentOption {
  const scope =
    d.site != null
      ? d.site_name
        ? `${d.site_name} - Site`
        : `Site #${d.site}`
      : d.client != null
        ? d.client_name
          ? `${d.client_name} - Client`
          : `Client #${d.client}`
        : 'Org'
  return {
    id: d.id,
    label: `${d.name} (${d.code})`,
    scopeLabel: scope,
  }
}

export async function listDepartments(params?: {
  search?: string
  org?: number
  client?: number
  site?: number
  is_active?: boolean
  page?: number
}): Promise<{ items: DepartmentRow[]; count?: number }> {
  const { data } = await api.get<DrfPaginated<DepartmentRow> | DepartmentRow[]>('/api/core/departments/', {
    params: {
      search: params?.search || undefined,
      org: params?.org ?? undefined,
      client: params?.client ?? undefined,
      site: params?.site ?? undefined,
      is_active: typeof params?.is_active === 'boolean' ? String(params.is_active) : undefined,
      page: params?.page ?? undefined,
    },
  })
  return unwrapDrfResults<DepartmentRow>(data)
}
