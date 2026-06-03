/**
 * Setup Builder Departments Tab - Department cards with role assignment.
 */
import { useState } from 'react'
import {
  Building2,
  ChevronDown,
  Clock,
  CreditCard,
  Lock,
  Plus,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type {
  MobilisationSetupBuilderDepartment,
  MobilisationSetupBuilderRole,
} from '@/features/mobilisation/types'

type LocalBuilderDepartment = MobilisationSetupBuilderDepartment & {
  local_key: string
  is_new?: boolean
}

interface SetupBuilderDepartmentsTabProps {
  departments: LocalBuilderDepartment[]
  setDepartments: React.Dispatch<React.SetStateAction<LocalBuilderDepartment[]>>
  unassignedRoles: MobilisationSetupBuilderRole[]
  availableSites: Array<{ id: number; name: string | null }>
  isEditable: boolean
  onDirty: () => void
}

interface DeptFormState {
  scope_level: 'client' | 'site'
  real_site: string
  name: string
  code: string
  description: string
}

const DEPT_FORM_DEFAULTS: DeptFormState = {
  scope_level: 'site',
  real_site: '',
  name: '',
  code: '',
  description: '',
}

export function SetupBuilderDepartmentsTab({
  departments,
  setDepartments,
  unassignedRoles,
  availableSites,
  isEditable,
  onDirty,
}: SetupBuilderDepartmentsTabProps) {
  const [addDrawerOpen, setAddDrawerOpen] = useState(false)
  const [form, setForm] = useState<DeptFormState>(DEPT_FORM_DEFAULTS)
  const [formError, setFormError] = useState<string | null>(null)

  function set(field: keyof DeptFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleAddDepartment() {
    if (!form.name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (!form.code.trim()) {
      setFormError('Code is required.')
      return
    }
    if (form.scope_level === 'site' && !form.real_site) {
      setFormError('Site is required for site-level departments.')
      return
    }

    const siteId = form.scope_level === 'site' ? Number(form.real_site) : null
    const siteName = siteId ? availableSites.find((s) => s.id === siteId)?.name ?? null : null

    const newDept: LocalBuilderDepartment = {
      id: 0,
      local_key: `new-dept-${Date.now()}`,
      is_new: true,
      scope_level: form.scope_level,
      real_site: siteId,
      real_site_name: siteName,
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim(),
      is_locked: false,
      source_key: '',
      sort_order: departments.length,
      role_requirement_ids: [],
      roles: [],
    }

    setDepartments((prev) => [...prev, newDept])
    onDirty()
    setAddDrawerOpen(false)
    setForm(DEPT_FORM_DEFAULTS)
    setFormError(null)
  }

  function handleRemoveDepartment(localKey: string) {
    setDepartments((prev) => prev.filter((d) => d.local_key !== localKey))
    onDirty()
  }

  function handleUpdateDepartment(localKey: string, updates: Partial<LocalBuilderDepartment>) {
    setDepartments((prev) =>
      prev.map((d) => (d.local_key === localKey ? { ...d, ...updates } : d)),
    )
    onDirty()
  }

  function handleAssignRole(deptLocalKey: string, role: MobilisationSetupBuilderRole) {
    setDepartments((prev) =>
      prev.map((d) => {
        if (d.local_key !== deptLocalKey) return d
        // Add role to this department
        const newRoles = [...d.roles, role]
        const newRoleIds = [...d.role_requirement_ids, role.id]
        return { ...d, roles: newRoles, role_requirement_ids: newRoleIds }
      }),
    )
    onDirty()
  }

  function handleMoveRole(fromDeptKey: string, roleId: number, toDeptKey: string) {
    if (fromDeptKey === toDeptKey) return

    let movedRole: MobilisationSetupBuilderRole | undefined

    setDepartments((prev) => {
      // First pass: remove role from source department
      const afterRemove = prev.map((d) => {
        if (d.local_key !== fromDeptKey) return d
        const roleToMove = d.roles.find((r) => r.id === roleId)
        if (roleToMove) movedRole = roleToMove
        return {
          ...d,
          roles: d.roles.filter((r) => r.id !== roleId),
          role_requirement_ids: d.role_requirement_ids.filter((id) => id !== roleId),
        }
      })

      // Second pass: add role to target department
      if (!movedRole) return afterRemove
      return afterRemove.map((d) => {
        if (d.local_key !== toDeptKey) return d
        return {
          ...d,
          roles: [...d.roles, movedRole!],
          role_requirement_ids: [...d.role_requirement_ids, movedRole!.id],
        }
      })
    })
    onDirty()
  }

  // Get unassigned roles for a specific site
  function getUnassignedRolesForSite(siteId: number | null): MobilisationSetupBuilderRole[] {
    if (siteId === null) return [] // Client-level departments cannot receive roles
    return unassignedRoles.filter((r) => r.site === siteId)
  }

  // Get other site-level departments for the same site (for "Move to" dropdown)
  function getSameSiteDepartments(siteId: number | null, excludeKey: string): LocalBuilderDepartment[] {
    if (siteId === null) return []
    return departments.filter(
      (d) => d.scope_level === 'site' && d.real_site === siteId && d.local_key !== excludeKey,
    )
  }

  return (
    <div className="space-y-4">
      {/* Add department button */}
      {isEditable ? (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            className="min-h-9"
            onClick={() => {
              setForm(DEPT_FORM_DEFAULTS)
              setFormError(null)
              setAddDrawerOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add department
          </Button>
        </div>
      ) : null}

      {/* Department cards */}
      {departments.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-brand-200 dark:border-brand-800 bg-gradient-to-br from-brand-50/50 to-slate-50 dark:from-brand-900/10 dark:to-slate-800/20 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
            <Building2 className="h-7 w-7 text-brand-600 dark:text-brand-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-app-text">No departments configured yet</p>
          {unassignedRoles.length > 0 ? (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-app-secondary">
                You have <span className="font-semibold text-brand-600">{unassignedRoles.length} approved role{unassignedRoles.length !== 1 ? 's' : ''}</span> waiting to be assigned
              </p>
              <p className="text-xs text-app-subtle">
                Total manpower: {unassignedRoles.reduce((sum, r) => sum + r.approved_headcount, 0)}
              </p>
            </div>
          ) : null}
          {isEditable ? (
            <p className="mt-3 text-xs text-brand-600 dark:text-brand-400 font-medium">
              Choose a setup strategy above or add departments manually
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.local_key}
              department={dept}
              unassignedRolesForSite={getUnassignedRolesForSite(dept.real_site)}
              sameSiteDepartments={getSameSiteDepartments(dept.real_site, dept.local_key)}
              isEditable={isEditable}
              onUpdate={(updates) => handleUpdateDepartment(dept.local_key, updates)}
              onRemove={() => handleRemoveDepartment(dept.local_key)}
              onAssignRole={(role) => handleAssignRole(dept.local_key, role)}
              onMoveRole={(roleId, toDeptKey) => handleMoveRole(dept.local_key, roleId, toDeptKey)}
            />
          ))}
        </div>
      )}

      {/* Add department drawer */}
      <Drawer
        open={addDrawerOpen}
        title="Add department"
        description="Create a new department for this mobilisation."
        onClose={() => setAddDrawerOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDepartment}>Add</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError ? <p className="text-sm text-status-danger">{formError}</p> : null}

          <Select
            id="dept_scope"
            label="Scope level"
            value={form.scope_level}
            onChange={(e) => set('scope_level', e.target.value as 'client' | 'site')}
          >
            <option value="site">Site-level</option>
            <option value="client">Client-level</option>
          </Select>

          {form.scope_level === 'site' ? (
            <Select
              id="dept_site"
              label="Site"
              value={form.real_site}
              onChange={(e) => set('real_site', e.target.value)}
            >
              <option value="">Select a site</option>
              {availableSites.map((site) => (
                <option key={site.id} value={String(site.id)}>
                  {site.name ?? `Site #${site.id}`}
                </option>
              ))}
            </Select>
          ) : null}

          <Input
            id="dept_name"
            label="Name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Operations"
          />

          <Input
            id="dept_code"
            label="Code"
            value={form.code}
            onChange={(e) => set('code', e.target.value)}
            placeholder="e.g. OPS"
          />

          <Input
            id="dept_description"
            label="Description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Optional description"
          />
        </div>
      </Drawer>
    </div>
  )
}

// ─── Department Card Component ─────────────────────────────────────────────────

interface DepartmentCardProps {
  department: LocalBuilderDepartment
  unassignedRolesForSite: MobilisationSetupBuilderRole[]
  sameSiteDepartments: LocalBuilderDepartment[]
  isEditable: boolean
  onUpdate: (updates: Partial<LocalBuilderDepartment>) => void
  onRemove: () => void
  onAssignRole: (role: MobilisationSetupBuilderRole) => void
  onMoveRole: (roleId: number, toDeptKey: string) => void
}

function DepartmentCard({
  department,
  unassignedRolesForSite,
  sameSiteDepartments,
  isEditable,
  onUpdate,
  onRemove,
  onAssignRole,
  onMoveRole,
}: DepartmentCardProps) {
  const isLocked = department.is_locked
  const canEdit = isEditable && !isLocked
  const canReceiveRoles = department.scope_level === 'site'

  return (
    <div className="rounded-xl border border-app-border bg-app-surface shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-brand-500/10 px-4 py-3 border-b border-app-border">
        <div className="flex items-center gap-2">
          <Badge variant={department.scope_level === 'site' ? 'info' : 'neutral'} className="text-xs">
            {department.scope_level === 'site' ? 'Site' : 'Client'}
          </Badge>
          {department.real_site_name ? (
            <span className="text-sm font-medium text-app-text">{department.real_site_name}</span>
          ) : null}
          {isLocked ? (
            <div className="flex items-center gap-1 text-amber-600">
              <Lock className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Locked</span>
            </div>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            variant="secondary"
            className="min-h-7 px-2 text-xs"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Button>
        ) : null}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Name / Code / Description */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            {canEdit ? (
              <Input
                id={`dept-${department.local_key}-name`}
                label="Name"
                value={department.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="text-sm"
              />
            ) : (
              <>
                <label className="block text-xs font-medium text-app-subtle mb-1">Name</label>
                <p className="text-sm font-medium text-app-text">{department.name}</p>
              </>
            )}
          </div>
          <div>
            {canEdit ? (
              <Input
                id={`dept-${department.local_key}-code`}
                label="Code"
                value={department.code}
                onChange={(e) => onUpdate({ code: e.target.value })}
                className="text-sm"
              />
            ) : (
              <>
                <label className="block text-xs font-medium text-app-subtle mb-1">Code</label>
                <code className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                  {department.code}
                </code>
              </>
            )}
          </div>
        </div>

        {department.description || canEdit ? (
          <div>
            {canEdit ? (
              <Input
                id={`dept-${department.local_key}-desc`}
                label="Description"
                value={department.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                className="text-sm"
                placeholder="Optional description"
              />
            ) : department.description ? (
              <>
                <label className="block text-xs font-medium text-app-subtle mb-1">Description</label>
                <p className="text-sm text-app-secondary">{department.description}</p>
              </>
            ) : null}
          </div>
        ) : null}

        {isLocked ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Client Administration is required for client-level access and reporting.
          </p>
        ) : null}

        {/* Assigned Roles */}
        <div className="border-t border-app-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-app-subtle" />
              <span className="text-xs font-semibold uppercase tracking-wider text-app-subtle">
                Assigned Roles ({department.roles.length})
              </span>
            </div>

            {/* Assign unassigned role dropdown */}
            {canReceiveRoles && isEditable && unassignedRolesForSite.length > 0 ? (
              <AssignRoleDropdown
                unassignedRoles={unassignedRolesForSite}
                onAssign={onAssignRole}
              />
            ) : null}
          </div>

          {department.roles.length === 0 ? (
            <p className="text-xs text-app-subtle italic">No roles assigned to this department.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {department.roles.map((role) => (
                <RoleChip
                  key={role.id}
                  role={role}
                  sameSiteDepartments={sameSiteDepartments}
                  isEditable={isEditable}
                  onMove={(toDeptKey) => onMoveRole(role.id, toDeptKey)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Assign Role Dropdown ──────────────────────────────────────────────────────

interface AssignRoleDropdownProps {
  unassignedRoles: MobilisationSetupBuilderRole[]
  onAssign: (role: MobilisationSetupBuilderRole) => void
}

function AssignRoleDropdown({ unassignedRoles, onAssign }: AssignRoleDropdownProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="secondary"
        className="min-h-8 px-3 text-xs font-medium"
        onClick={() => setOpen(!open)}
      >
        <Plus className="mr-1 h-3 w-3" />
        Assign role
        <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-72 rounded-xl border border-app-border bg-app-surface shadow-xl max-h-56 overflow-y-auto">
            <div className="px-3 py-2 border-b border-app-border bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs font-medium text-app-subtle uppercase tracking-wider">
                {unassignedRoles.length} Unassigned Role{unassignedRoles.length !== 1 ? 's' : ''}
              </p>
            </div>
            {unassignedRoles.map((role) => (
              <button
                key={role.id}
                type="button"
                className="w-full px-3 py-2.5 text-left hover:bg-brand-50 dark:hover:bg-brand-900/20 border-b border-app-border last:border-b-0 transition-colors"
                onClick={() => {
                  onAssign(role)
                  setOpen(false)
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-app-text">{role.job_role_name ?? 'Unknown Role'}</p>
                  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">×{role.approved_headcount}</span>
                </div>
                <p className="text-xs text-app-subtle mt-0.5">
                  {role.wage_category_name ?? 'No wage category'}
                  {role.shift_hours ? ` · ${role.shift_hours} hrs` : ''}
                </p>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── Role Chip Component ───────────────────────────────────────────────────────

interface RoleChipProps {
  role: MobilisationSetupBuilderRole
  sameSiteDepartments: LocalBuilderDepartment[]
  isEditable: boolean
  onMove: (toDeptKey: string) => void
}

function RoleChip({ role, sameSiteDepartments, isEditable, onMove }: RoleChipProps) {
  const [moveOpen, setMoveOpen] = useState(false)

  return (
    <div className="rounded-xl border border-app-border bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/50 p-3 min-w-[200px] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm font-semibold text-app-text leading-tight">{role.job_role_name ?? 'Unknown Role'}</p>
        <span className="inline-flex items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 px-2 py-0.5 text-xs font-bold text-brand-700 dark:text-brand-300">
          ×{role.approved_headcount}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-app-secondary">
          <Users className="h-3 w-3 text-app-subtle" />
          <span>Approved manpower:</span>
          <span className="font-medium text-app-text">{role.approved_headcount}</span>
        </div>
        {role.wage_category_name ? (
          <div className="flex items-center gap-1.5 text-xs text-app-secondary">
            <Wallet className="h-3 w-3 text-app-subtle" />
            <span>Wage category:</span>
            <span className="font-medium text-app-text">{role.wage_category_name}</span>
          </div>
        ) : null}
        {role.shift_hours ? (
          <div className="flex items-center gap-1.5 text-xs text-app-secondary">
            <Clock className="h-3 w-3 text-app-subtle" />
            <span>Shift:</span>
            <span className="font-medium text-app-text">{role.shift_hours} hrs</span>
          </div>
        ) : null}
        {role.billing_type ? (
          <div className="flex items-center gap-1.5 text-xs text-app-secondary">
            <CreditCard className="h-3 w-3 text-app-subtle" />
            <span>Billing:</span>
            <span className="font-medium text-app-text capitalize">{role.billing_type.replace(/_/g, ' ')}</span>
          </div>
        ) : null}
      </div>

      {/* Move to dropdown */}
      {isEditable && sameSiteDepartments.length > 0 ? (
        <div className="relative mt-3 pt-2 border-t border-app-border">
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
            onClick={() => setMoveOpen(!moveOpen)}
          >
            Move to department
            <ChevronDown className={`h-3 w-3 transition-transform ${moveOpen ? 'rotate-180' : ''}`} />
          </button>

          {moveOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMoveOpen(false)} />
              <div className="absolute left-0 bottom-full mb-1 z-20 w-52 rounded-xl border border-app-border bg-app-surface shadow-xl max-h-40 overflow-y-auto">
                {sameSiteDepartments.map((dept) => (
                  <button
                    key={dept.local_key}
                    type="button"
                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-900/20 border-b border-app-border last:border-b-0 transition-colors"
                    onClick={() => {
                      onMove(dept.local_key)
                      setMoveOpen(false)
                    }}
                  >
                    <span className="font-medium text-app-text">{dept.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
