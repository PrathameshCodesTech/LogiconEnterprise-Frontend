export type LangCode = 'en' | 'hi' | 'mr'

export interface CampaignJobRoleRow {
  id: number
  campaign: number
  job_role: number
  is_active: boolean
  job_role_name: string
  job_role_code: string
}

export interface CampaignRow {
  id: number
  org: number
  site: number | null
  name: string
  title: string
  code: string
  token: string
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  allow_duplicates: boolean
  requires_otp: boolean
  shuffle_fields: boolean
  default_language: LangCode
  enabled_languages: string[]
  campaign_roles: CampaignJobRoleRow[]
  created_at: string
  updated_at: string
}

export interface CampaignWriteInput {
  name: string
  title?: string
  code: string
  site?: number | null
  is_active?: boolean
  starts_at?: string | null
  ends_at?: string | null
  allow_duplicates?: boolean
  requires_otp?: boolean
  shuffle_fields?: boolean
  default_language?: string
  enabled_languages?: string[]
}

export interface CampaignJobRoleWriteInput {
  campaign: number
  job_role: number
  is_active?: boolean
}


