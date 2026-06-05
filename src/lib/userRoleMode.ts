import type { MeResponse } from '@/types/api'

/** Role codes that should see the trimmed client portal rather than internal ATS/admin UI. */
export const CLIENT_FACING_ROLE_CODES = new Set([
  'client_admin',
  'client_site_user',
  'site_supervisor',
  'client_user',
])

/**
 * A user is treated as client-facing when they are not a superuser and every one of
 * their assigned roles is a client-facing role. Mixed (internal + client) users keep
 * the full internal experience.
 */
export function isClientFacingUser(me: MeResponse | null | undefined): boolean {
  if (!me || me.is_superuser) return false
  const roleCodes = (me.role_assignments ?? []).map((r) => r.role_code).filter(Boolean)
  return roleCodes.length > 0 && roleCodes.every((code) => CLIENT_FACING_ROLE_CODES.has(code))
}
