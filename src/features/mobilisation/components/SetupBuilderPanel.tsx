/**
 * Setup Builder Panel - Main orchestration component for mobilisation setup.
 * Replaces the old "suggestions/apply" UX with a guided setup builder.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  MapPin,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  applyMobilisationSetupBuilderTemplate,
  getMobilisationSetupBuilder,
  saveMobilisationSetupBuilder,
} from '@/api/mobilisation'
import { listRoles, type AccessRole } from '@/api/access'
import { parseApiError } from '@/lib/apiError'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import type {
  MobilisationSetupBuilder,
  MobilisationSetupBuilderDepartment,
  MobilisationSetupBuilderRole,
  MobilisationSetupBuilderUser,
  MobilisationSetupStrategy,
  SaveMobilisationSetupBuilderPayload,
} from '@/features/mobilisation/types'
import { SetupBuilderDepartmentsTab } from './SetupBuilderDepartmentsTab'
import { SetupBuilderUsersTab } from './SetupBuilderUsersTab'
import { SetupBuilderReadinessPanel } from './SetupBuilderReadinessPanel'

// Local types for tracking new items
type LocalBuilderDepartment = MobilisationSetupBuilderDepartment & {
  local_key: string
  is_new?: boolean
}

type LocalBuilderUser = MobilisationSetupBuilderUser & {
  local_key: string
  is_new?: boolean
}

type BuilderSubTab = 'departments' | 'users'

// ─── Helper Functions for Org-Chart Preview ─────────────────────────────────────

interface OrgDepartment {
  name: string
  code: string
  scopeLevel: 'client' | 'site'
  siteName?: string
  roles: Array<{ name: string; headcount: number }>
  totalManpower: number
  isLocked?: boolean
}

interface OrgPreview {
  siteCount: number
  totalManpower: number
  departments: OrgDepartment[]
}

// Role grouping patterns matching backend logic
const ROLE_GROUP_PATTERNS: Array<{ pattern: RegExp; department: string; code: string }> = [
  { pattern: /\b(hk|housekeeping|janitor)\b/i, department: 'Housekeeping', code: 'HK' },
  { pattern: /\b(security|guard)\b/i, department: 'Security', code: 'SEC' },
  { pattern: /\b(tech|electrician|plumber|stp)\b/i, department: 'Technical', code: 'TECH' },
]

function getDepartmentForRole(roleName: string): { department: string; code: string } {
  const lowerName = roleName.toLowerCase()
  for (const { pattern, department, code } of ROLE_GROUP_PATTERNS) {
    if (pattern.test(lowerName)) {
      return { department, code }
    }
  }
  return { department: 'Operations', code: 'OPS' }
}

function computeSimpleOrgPreview(roles: MobilisationSetupBuilderRole[]): OrgPreview {
  const departments: OrgDepartment[] = []

  // Always add Client Administration
  departments.push({
    name: 'Client Administration',
    code: 'ADMIN',
    scopeLevel: 'client',
    roles: [],
    totalManpower: 0,
    isLocked: true,
  })

  // Group roles by site
  const siteMap = new Map<number, { siteName: string; roles: Map<string, number> }>()
  for (const role of roles) {
    if (!siteMap.has(role.site)) {
      siteMap.set(role.site, { siteName: role.site_name ?? `Site #${role.site}`, roles: new Map() })
    }
    const siteData = siteMap.get(role.site)!
    const roleName = role.job_role_name ?? 'Unknown Role'
    const existing = siteData.roles.get(roleName) ?? 0
    siteData.roles.set(roleName, existing + role.approved_headcount)
  }

  // Create one Operations department per site
  for (const [, siteData] of siteMap) {
    const rolesList = Array.from(siteData.roles.entries()).map(([name, headcount]) => ({ name, headcount }))
    departments.push({
      name: 'Operations',
      code: 'OPS',
      scopeLevel: 'site',
      siteName: siteData.siteName,
      roles: rolesList,
      totalManpower: rolesList.reduce((sum, r) => sum + r.headcount, 0),
    })
  }

  return {
    siteCount: siteMap.size,
    totalManpower: roles.reduce((sum, r) => sum + r.approved_headcount, 0),
    departments,
  }
}

function computeRoleGroupedOrgPreview(roles: MobilisationSetupBuilderRole[]): OrgPreview {
  const departments: OrgDepartment[] = []

  // Always add Client Administration
  departments.push({
    name: 'Client Administration',
    code: 'ADMIN',
    scopeLevel: 'client',
    roles: [],
    totalManpower: 0,
    isLocked: true,
  })

  // Group roles by site, then by department type
  const siteMap = new Map<number, {
    siteName: string
    deptMap: Map<string, { code: string; roles: Map<string, number> }>
  }>()

  for (const role of roles) {
    if (!siteMap.has(role.site)) {
      siteMap.set(role.site, { siteName: role.site_name ?? `Site #${role.site}`, deptMap: new Map() })
    }
    const siteData = siteMap.get(role.site)!
    const roleName = role.job_role_name ?? 'Unknown Role'
    const { department, code } = getDepartmentForRole(roleName)

    if (!siteData.deptMap.has(department)) {
      siteData.deptMap.set(department, { code, roles: new Map() })
    }
    const deptData = siteData.deptMap.get(department)!
    const existing = deptData.roles.get(roleName) ?? 0
    deptData.roles.set(roleName, existing + role.approved_headcount)
  }

  // Convert to departments array
  for (const [, siteData] of siteMap) {
    for (const [deptName, deptData] of siteData.deptMap) {
      const rolesList = Array.from(deptData.roles.entries()).map(([name, headcount]) => ({ name, headcount }))
      departments.push({
        name: deptName,
        code: deptData.code,
        scopeLevel: 'site',
        siteName: siteData.siteName,
        roles: rolesList,
        totalManpower: rolesList.reduce((sum, r) => sum + r.headcount, 0),
      })
    }
  }

  return {
    siteCount: siteMap.size,
    totalManpower: roles.reduce((sum, r) => sum + r.approved_headcount, 0),
    departments,
  }
}

function computeOrgPreview(
  strategy: MobilisationSetupStrategy,
  roles: MobilisationSetupBuilderRole[],
): OrgPreview {
  if (strategy === 'simple') {
    return computeSimpleOrgPreview(roles)
  }
  return computeRoleGroupedOrgPreview(roles)
}

function formatRolePreview(roles: Array<{ name: string; headcount: number }>, maxShow = 2): string {
  if (roles.length === 0) return 'No roles assigned'
  const shown = roles.slice(0, maxShow).map((role) => `${role.name} (${role.headcount})`)
  const remaining = roles.length - maxShow
  return remaining > 0 ? `${shown.join(', ')} +${remaining} more` : shown.join(', ')
}

const STRATEGY_LABELS: Record<MobilisationSetupStrategy, string> = {
  simple: 'Simple Setup',
  role_grouped: 'Role-Grouped',
  custom: 'Custom',
}

interface SetupBuilderPanelProps {
  requestId: number
  isEditable: boolean
  onMarkSetupCompleted: () => Promise<void>
  markingComplete: boolean
}

export function SetupBuilderPanel({
  requestId,
  isEditable,
  onMarkSetupCompleted,
  markingComplete,
}: SetupBuilderPanelProps) {
  // Builder data from API
  const [builder, setBuilder] = useState<MobilisationSetupBuilder | null>(null)
  const [builderLoading, setBuilderLoading] = useState(true)
  const [builderError, setBuilderError] = useState<string | null>(null)

  // Local editable copies
  const [localDepartments, setLocalDepartments] = useState<LocalBuilderDepartment[]>([])
  const [localUsers, setLocalUsers] = useState<LocalBuilderUser[]>([])
  const [localStrategy, setLocalStrategy] = useState<MobilisationSetupStrategy>('custom')

  // Dirty state
  const [builderDirty, setBuilderDirty] = useState(false)

  // Save state
  const [savingBuilder, setSavingBuilder] = useState(false)
  const [saveBuilderError, setSaveBuilderError] = useState<string | null>(null)
  const [saveBuilderSuccess, setSaveBuilderSuccess] = useState<string | null>(null)

  // Template confirmation (inline, NOT window.confirm)
  const [confirmTemplateStrategy, setConfirmTemplateStrategy] = useState<MobilisationSetupStrategy | null>(null)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [templateSuccessSummary, setTemplateSuccessSummary] = useState<string | null>(null)

  // Access roles for user dropdown
  const [accessRoles, setAccessRoles] = useState<AccessRole[]>([])
  const [accessRolesLoading, setAccessRolesLoading] = useState(false)

  // UI state
  const [subTab, setSubTab] = useState<BuilderSubTab>('departments')

  // Load builder data
  async function loadBuilder() {
    setBuilderLoading(true)
    setBuilderError(null)
    try {
      const data = await getMobilisationSetupBuilder(requestId)
      setBuilder(data)
    } catch (e: unknown) {
      setBuilderError(parseApiError(e, 'Failed to load setup builder').message)
    } finally {
      setBuilderLoading(false)
    }
  }

  // Load access roles
  async function loadAccessRoles() {
    setAccessRolesLoading(true)
    try {
      const res = await listRoles({ is_active: true })
      setAccessRoles(res.items)
    } catch {
      // Silently fail - roles dropdown will be empty
    } finally {
      setAccessRolesLoading(false)
    }
  }

  useEffect(() => {
    void loadBuilder()
    void loadAccessRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  // Initialize local state from builder
  useEffect(() => {
    if (builder) {
      setLocalDepartments(
        builder.departments.map((d) => ({
          ...d,
          local_key: `dept-${d.id}`,
          is_new: false,
        })),
      )
      setLocalUsers(
        builder.users.map((u) => ({
          ...u,
          local_key: `user-${u.id}`,
          is_new: false,
        })),
      )
      setLocalStrategy(builder.setup_strategy)
      setBuilderDirty(false)
      setSaveBuilderSuccess(null)
    }
  }, [builder])

  // Apply template
  async function handleApplyTemplate(strategy: MobilisationSetupStrategy) {
    setApplyingTemplate(true)
    setTemplateError(null)
    setTemplateSuccessSummary(null)
    try {
      const data = await applyMobilisationSetupBuilderTemplate(requestId, strategy)
      setBuilder(data)
      setConfirmTemplateStrategy(null)

      // Build success summary
      const deptCount = data.departments.length
      const totalManpower = data.available_roles.reduce((sum, r) => sum + r.approved_headcount, 0)
      const assignedCount = data.available_roles.filter((r) => r.assigned_department !== null).length
      setTemplateSuccessSummary(
        `${deptCount} department${deptCount !== 1 ? 's' : ''} created, ${assignedCount} role${assignedCount !== 1 ? 's' : ''} assigned, ${totalManpower} total manpower.`,
      )
      setTimeout(() => setTemplateSuccessSummary(null), 6000)
    } catch (e: unknown) {
      setTemplateError(parseApiError(e, 'Failed to apply template').message)
    } finally {
      setApplyingTemplate(false)
    }
  }

  // Save builder
  async function handleSaveBuilder() {
    setSavingBuilder(true)
    setSaveBuilderError(null)
    setSaveBuilderSuccess(null)
    try {
      const payload: SaveMobilisationSetupBuilderPayload = {
        setup_strategy: localStrategy,
        departments: localDepartments.map((d) => ({
          id: d.is_new ? undefined : d.id,
          scope_level: d.scope_level,
          real_site: d.real_site,
          name: d.name,
          code: d.code,
          description: d.description,
          source_key: d.source_key,
          sort_order: d.sort_order,
          role_requirement_ids: d.role_requirement_ids,
        })),
        users: localUsers.map((u) => ({
          id: u.is_new ? undefined : u.id,
          full_name: u.full_name,
          email: u.email,
          phone: u.phone,
          user_type: u.user_type,
          access_role: u.access_role,
          scope_level: u.scope_level,
          real_site: u.real_site,
          is_primary_contact: u.is_primary_contact,
          send_invite_on_finalization: u.send_invite_on_finalization,
          is_active: u.is_active,
        })),
      }
      const data = await saveMobilisationSetupBuilder(requestId, payload)
      setBuilder(data)
      setSaveBuilderSuccess('Setup saved successfully.')
      setTimeout(() => setSaveBuilderSuccess(null), 4000)
    } catch (e: unknown) {
      setSaveBuilderError(parseApiError(e, 'Failed to save setup').message)
    } finally {
      setSavingBuilder(false)
    }
  }

  // Discard changes
  function handleDiscardChanges() {
    if (builder) {
      setLocalDepartments(
        builder.departments.map((d) => ({
          ...d,
          local_key: `dept-${d.id}`,
          is_new: false,
        })),
      )
      setLocalUsers(
        builder.users.map((u) => ({
          ...u,
          local_key: `user-${u.id}`,
          is_new: false,
        })),
      )
      setLocalStrategy(builder.setup_strategy)
      setBuilderDirty(false)
    }
  }

  // Get unique sites from available roles for department creation
  const availableSites = builder
    ? [...new Map(builder.available_roles.map((r) => [r.site, { id: r.site, name: r.site_name }])).values()]
    : []

  const locallyAssignedRoleIds = useMemo(() => {
    const assigned = new Set<number>()
    for (const department of localDepartments) {
      for (const roleId of department.role_requirement_ids) {
        assigned.add(roleId)
      }
    }
    return assigned
  }, [localDepartments])

  const localUnassignedRoles = useMemo(
    () => builder?.available_roles.filter((role) => !locallyAssignedRoleIds.has(role.id)) ?? [],
    [builder?.available_roles, locallyAssignedRoleIds],
  )

  // Compute org previews for strategy cards and confirmation
  const simpleOrgPreview = useMemo(() => {
    if (!builder) return null
    return computeOrgPreview('simple', builder.available_roles)
  }, [builder])

  const roleGroupedOrgPreview = useMemo(() => {
    if (!builder) return null
    return computeOrgPreview('role_grouped', builder.available_roles)
  }, [builder])

  if (builderLoading) {
    return <Spinner label="Loading setup builder..." />
  }

  if (builderError) {
    return <ErrorState message={builderError} />
  }

  if (!builder) {
    return <ErrorState message="Setup builder data not available." />
  }

  const unassignedCount = localUnassignedRoles.length
  const totalRolesCount = builder.available_roles.length

  return (
    <div className="space-y-5">
      {/* Strategy Selector - only show if editable */}
      {isEditable ? (
        <section className="rounded-xl border border-app-border bg-app-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 shadow-sm">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-app-text">Setup Strategy</h3>
              <p className="text-xs text-app-subtle">Choose how to structure departments</p>
            </div>
          </div>

          {/* Role summary banner */}
          {simpleOrgPreview && simpleOrgPreview.totalManpower > 0 ? (
            <div className="mb-4 rounded-lg bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-brand-900/20 dark:to-indigo-900/20 border border-brand-200 dark:border-brand-800 p-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-brand-600" />
                <span className="font-medium text-brand-700 dark:text-brand-300">
                  {simpleOrgPreview.siteCount} site{simpleOrgPreview.siteCount !== 1 ? 's' : ''}
                </span>
                <span className="text-brand-400">·</span>
                <span className="font-medium text-brand-700 dark:text-brand-300">
                  {totalRolesCount} role{totalRolesCount !== 1 ? 's' : ''}
                </span>
                <span className="text-brand-400">·</span>
                <span className="font-medium text-brand-700 dark:text-brand-300">
                  {simpleOrgPreview.totalManpower} manpower
                </span>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Simple Setup Card */}
            {(() => {
              const isSelected = confirmTemplateStrategy === 'simple' || (confirmTemplateStrategy === null && localStrategy === 'simple')
              const siteDepts = simpleOrgPreview?.departments.filter((d) => d.scopeLevel === 'site') ?? []
              const firstDept = siteDepts[0]
              return (
                <button
                  type="button"
                  onClick={() => setConfirmTemplateStrategy('simple')}
                  disabled={applyingTemplate}
                  className={`relative rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-brand-500 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/30 dark:to-slate-900 ring-1 ring-brand-500 shadow-md'
                      : 'border-app-border bg-app-surface hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-brand-500 bg-brand-500' : 'border-app-border'
                      }`}
                    >
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-semibold text-app-text">Simple Setup</span>
                  </div>
                  <p className="text-xs text-app-secondary leading-relaxed mb-2">
                    One Operations department per site.
                  </p>
                  {/* Compact org tree preview */}
                  {siteDepts.length > 0 ? (
                    <div className="mt-2 space-y-1 text-[11px] font-mono">
                      <div className="text-app-subtle">├─ Client Administration</div>
                      {firstDept ? (
                        <div className="text-brand-600 dark:text-brand-400">
                          └─ {firstDept.siteName}
                          <div className="ml-3 text-app-secondary">└─ Operations ({firstDept.totalManpower})</div>
                          <div className="ml-6 text-app-subtle">
                            {formatRolePreview(firstDept.roles, 2)}
                          </div>
                        </div>
                      ) : null}
                      {siteDepts.length > 1 && (
                        <div className="text-app-subtle ml-3">+{siteDepts.length - 1} more site{siteDepts.length > 2 ? 's' : ''}</div>
                      )}
                    </div>
                  ) : null}
                </button>
              )
            })()}

            {/* Role-Grouped Setup Card */}
            {(() => {
              const isSelected = confirmTemplateStrategy === 'role_grouped' || (confirmTemplateStrategy === null && localStrategy === 'role_grouped')
              const siteDepts = roleGroupedOrgPreview?.departments.filter((d) => d.scopeLevel === 'site') ?? []
              const firstSiteName = siteDepts[0]?.siteName
              const firstSiteDepts = firstSiteName ? siteDepts.filter((d) => d.siteName === firstSiteName) : []
              return (
                <button
                  type="button"
                  onClick={() => setConfirmTemplateStrategy('role_grouped')}
                  disabled={applyingTemplate}
                  className={`relative rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-brand-500 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/30 dark:to-slate-900 ring-1 ring-brand-500 shadow-md'
                      : 'border-app-border bg-app-surface hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-brand-500 bg-brand-500' : 'border-app-border'
                      }`}
                    >
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-semibold text-app-text">Role-Grouped</span>
                  </div>
                  <p className="text-xs text-app-secondary leading-relaxed mb-2">
                    Departments by service type.
                  </p>
                  {/* Compact org tree preview */}
                  {firstSiteDepts.length > 0 ? (
                    <div className="mt-2 space-y-0.5 text-[11px] font-mono">
                      <div className="text-app-subtle">├─ Client Administration</div>
                      <div className="text-brand-600 dark:text-brand-400">
                        └─ {firstSiteName}
                        {firstSiteDepts.slice(0, 3).map((dept) => (
                          <div key={dept.name} className="ml-3 text-app-secondary">
                            ├─ {dept.name} ({dept.totalManpower})
                          </div>
                        ))}
                        {firstSiteDepts.length > 3 ? (
                          <div className="ml-3 text-app-subtle">+{firstSiteDepts.length - 3} more departments</div>
                        ) : null}
                      </div>
                      {siteDepts.some((dept) => dept.siteName !== firstSiteName) ? (
                        <div className="text-app-subtle ml-3">+more sites</div>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              )
            })()}

            {/* Custom Setup Card */}
            {(() => {
              const isSelected = confirmTemplateStrategy === null && localStrategy === 'custom'
              return (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmTemplateStrategy(null)
                    setLocalStrategy('custom')
                    setBuilderDirty(true)
                  }}
                  disabled={applyingTemplate}
                  className={`relative rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-brand-500 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/30 dark:to-slate-900 ring-1 ring-brand-500 shadow-md'
                      : 'border-app-border bg-app-surface hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-brand-500 bg-brand-500' : 'border-app-border'
                      }`}
                    >
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-semibold text-app-text">Custom</span>
                  </div>
                  <p className="text-xs text-app-secondary leading-relaxed mb-2">
                    Build your own structure.
                  </p>
                  <div className="mt-2 space-y-0.5 text-[11px] font-mono text-app-subtle">
                    <div>├─ Client Administration</div>
                    <div>└─ Your departments...</div>
                  </div>
                </button>
              )
            })()}
          </div>

          {/* Template confirmation inline with full org structure breakdown */}
          {confirmTemplateStrategy ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:border-amber-800 dark:from-amber-900/20 dark:to-orange-900/20 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-800/50">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Apply {confirmTemplateStrategy === 'simple' ? 'Simple' : 'Role-Grouped'} Setup
                  </p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    This will create the following department structure:
                  </p>

                  {/* Full org structure preview */}
                  {(() => {
                    const preview = confirmTemplateStrategy === 'simple' ? simpleOrgPreview : roleGroupedOrgPreview
                    if (!preview) return null

                    // Group departments by site
                    const clientDepts = preview.departments.filter((d) => d.scopeLevel === 'client')
                    const siteGroups = new Map<string, OrgDepartment[]>()
                    for (const dept of preview.departments.filter((d) => d.scopeLevel === 'site')) {
                      const siteName = dept.siteName ?? 'Unknown Site'
                      if (!siteGroups.has(siteName)) siteGroups.set(siteName, [])
                      siteGroups.get(siteName)!.push(dept)
                    }

                    return (
                      <div className="mt-3 space-y-3">
                        {/* Client-level departments */}
                        {clientDepts.map((dept, idx) => (
                          <div
                            key={`client-${idx}`}
                            className="rounded-lg bg-white/60 dark:bg-slate-800/40 border border-amber-200/50 dark:border-amber-700/30 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-amber-600" />
                              <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                                {dept.name}
                              </span>
                              {dept.isLocked && (
                                <span className="text-[10px] text-amber-500 dark:text-amber-400">(locked)</span>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 ml-6">
                              Client-level access and reporting
                            </p>
                          </div>
                        ))}

                        {/* Site-level departments */}
                        {Array.from(siteGroups.entries()).map(([siteName, depts]) => (
                          <div
                            key={siteName}
                            className="rounded-lg bg-white/60 dark:bg-slate-800/40 border border-amber-200/50 dark:border-amber-700/30 p-3"
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <MapPin className="h-3.5 w-3.5 text-amber-600" />
                              <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                                {siteName}
                              </span>
                            </div>
                            <div className="space-y-2 ml-2">
                              {depts.map((dept, deptIdx) => (
                                <div key={deptIdx} className="border-l-2 border-amber-300 dark:border-amber-700 pl-3">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-3.5 w-3.5 text-amber-500" />
                                    <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                                      {dept.name}
                                    </span>
                                    <span className="text-[10px] text-amber-500 dark:text-amber-400">
                                      ({dept.totalManpower} manpower)
                                    </span>
                                  </div>
                                  {dept.roles.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {dept.roles.map((role) => (
                                        <span
                                          key={role.name}
                                          className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-800/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                                        >
                                          {role.name}
                                          <span className="ml-1 text-amber-500">×{role.headcount}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-8 px-3 text-sm"
                      onClick={() => setConfirmTemplateStrategy(null)}
                      disabled={applyingTemplate}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="min-h-8 px-3 text-sm bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => void handleApplyTemplate(confirmTemplateStrategy)}
                      disabled={applyingTemplate}
                    >
                      {applyingTemplate ? 'Applying...' : 'Apply Setup'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Template success summary */}
          {templateSuccessSummary ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-800/50">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Setup Applied</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">{templateSuccessSummary}</p>
                </div>
              </div>
            </div>
          ) : null}

          {templateError ? (
            <div className="mt-4">
              <ErrorState message={templateError} />
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-xl border border-app-border bg-app-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10">
              <Settings className="h-4 w-4 text-brand-600" />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-app-text">Setup Strategy</h3>
            <Badge variant="neutral" className="ml-2">
              {STRATEGY_LABELS[builder.setup_strategy] ?? builder.setup_strategy}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-app-subtle">Setup is locked. Changes require reopening the request.</p>
        </section>
      )}

      {/* Readiness Panel */}
      <SetupBuilderReadinessPanel
        validation={builder.validation}
        unassignedRolesCount={unassignedCount}
        totalRolesCount={totalRolesCount}
        unassignedRoles={localUnassignedRoles}
        departmentsCount={localDepartments.length}
        usersCount={localUsers.length}
        isDirty={builderDirty}
        isEditable={isEditable}
        isCompletingSetup={markingComplete}
        onMarkSetupCompleted={onMarkSetupCompleted}
      />

      {/* Sub-tabs for Departments / Users */}
      <div className="flex gap-1 border-b border-app-border">
        <button
          type="button"
          onClick={() => setSubTab('departments')}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            subTab === 'departments'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-app-secondary hover:text-app-text'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Departments ({localDepartments.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('users')}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            subTab === 'users'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-app-secondary hover:text-app-text'
          }`}
        >
          <Users className="h-4 w-4" />
          Users ({localUsers.length})
        </button>
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {subTab === 'departments' ? (
          <SetupBuilderDepartmentsTab
            departments={localDepartments}
            setDepartments={setLocalDepartments}
            unassignedRoles={localUnassignedRoles}
            availableSites={availableSites}
            isEditable={isEditable}
            onDirty={() => setBuilderDirty(true)}
          />
        ) : (
          <SetupBuilderUsersTab
            users={localUsers}
            setUsers={setLocalUsers}
            accessRoles={accessRoles}
            accessRolesLoading={accessRolesLoading}
            availableSites={availableSites}
            isEditable={isEditable}
            onDirty={() => setBuilderDirty(true)}
          />
        )}
      </div>

      {/* Save bar - sticky when dirty */}
      {isEditable && builderDirty ? (
        <div className="sticky bottom-4 z-10">
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  You have unsaved changes
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="min-h-9"
                  onClick={handleDiscardChanges}
                  disabled={savingBuilder}
                >
                  Discard
                </Button>
                <Button
                  className="min-h-9"
                  onClick={() => void handleSaveBuilder()}
                  disabled={savingBuilder}
                >
                  {savingBuilder ? 'Saving...' : 'Save setup'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Save feedback */}
      {saveBuilderError ? (
        <div className="mt-4">
          <ErrorState message={saveBuilderError} />
        </div>
      ) : null}
      {saveBuilderSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm text-emerald-700 dark:text-emerald-400">{saveBuilderSuccess}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
