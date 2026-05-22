import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { deleteTemplateField, listTemplateFields } from '@/api/formBuilder'
import { listJobRoles } from '@/api/jobs'
import { parseApiError } from '@/lib/apiError'
import { TemplateFieldDrawer } from '@/features/formBuilder/TemplateFieldDrawer'
import {
  FIELD_TYPE_LABEL,
  type FieldType,
  type FormSectionRow,
  type FormTemplateFieldRow,
} from '@/features/formBuilder/types'

type BadgeV = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'attention'

function fieldTypeBadgeVariant(ft: FieldType): BadgeV {
  if (ft === 'file') return 'info'
  if (ft === 'select' || ft === 'multi_select') return 'warning'
  return 'neutral'
}

interface JobRoleLookup {
  id: number
  name: string
  code: string
}

type RoleFilter = 'all' | 'common' | string // role id as string

export function TemplateFieldsPanel({
  templateId,
  sections,
  canEdit,
  canDelete,
}: {
  templateId: number
  sections: FormSectionRow[]
  canEdit: boolean
  canDelete: boolean
}) {
  const [rows, setRows] = useState<FormTemplateFieldRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all')

  const [jobRoles, setJobRoles] = useState<JobRoleLookup[]>([])
  const [jobRolesError, setJobRolesError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editing, setEditing] = useState<FormTemplateFieldRow | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await listTemplateFields({ template: templateId })
      setRows(res.items)
    } catch (e: unknown) {
      setRows([])
      setError(parseApiError(e, 'Failed to load fields').message)
    } finally {
      setLoading(false)
    }
  }

  async function loadJobRoles() {
    try {
      const res = await listJobRoles('')
      setJobRoles(res as JobRoleLookup[])
    } catch (e: unknown) {
      setJobRoles([])
      setJobRolesError(parseApiError(e, 'Job role lookup failed').message)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  useEffect(() => {
    void loadJobRoles()
  }, [])

  const sectionNameById = useMemo(
    () => new Map(sections.map((s) => [s.id, s.name] as const)),
    [sections],
  )
  const roleNameById = useMemo(
    () => new Map(jobRoles.map((r) => [r.id, r.name] as const)),
    [jobRoles],
  )

  // Role-filter options are derived from loaded rows (optionally scoped by the
  // current section filter) so we never show roles that don't actually have a
  // field on this template, and "Common only" disappears when no common field exists
  // in the selected section.
  const roleFilterOptions = useMemo(() => {
    const sid = sectionFilter !== 'all' ? Number(sectionFilter) : null
    const subset = sid == null ? rows : rows.filter((f) => f.section === sid)
    const ids = new Set<number>()
    const nameById = new Map<number, string>()
    let hasCommon = false
    for (const f of subset) {
      if (f.role == null) {
        hasCommon = true
      } else {
        ids.add(f.role)
        if (!nameById.has(f.role) && f.role_name) {
          nameById.set(f.role, f.role_name)
        }
      }
    }
    const roles = Array.from(ids)
      .map((id) => ({ id, name: nameById.get(id) ?? roleNameById.get(id) ?? `Role #${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { hasCommon, roles }
  }, [rows, sectionFilter, roleNameById])

  // If the section filter changes (or rows reload) and the current Role filter
  // is no longer valid for the new scope, reset to "All".
  useEffect(() => {
    if (roleFilter === 'all') return
    if (roleFilter === 'common') {
      if (!roleFilterOptions.hasCommon) setRoleFilter('all')
      return
    }
    const id = Number(roleFilter)
    if (!Number.isFinite(id) || !roleFilterOptions.roles.some((r) => r.id === id)) {
      setRoleFilter('all')
    }
  }, [roleFilter, roleFilterOptions])

  const filtered = useMemo(() => {
    let out = rows
    if (sectionFilter !== 'all') {
      const sid = Number(sectionFilter)
      out = out.filter((f) => f.section === sid)
    }
    if (roleFilter === 'common') {
      out = out.filter((f) => f.role == null)
    } else if (roleFilter !== 'all') {
      const rid = Number(roleFilter)
      out = out.filter((f) => f.role === rid)
    }
    if (activeFilter !== 'all') {
      const want = activeFilter === 'true'
      out = out.filter((f) => f.is_active === want)
    }
    return out.slice().sort((a, b) => {
      const sa = a.section_sort_order ?? 0
      const sb = b.section_sort_order ?? 0
      if (sa !== sb) return sa - sb
      if ((a.section ?? 0) !== (b.section ?? 0)) return (a.section ?? 0) - (b.section ?? 0)
      return a.sort_order - b.sort_order || a.id - b.id
    })
  }, [rows, sectionFilter, roleFilter, activeFilter])

  function openCreate() {
    setDrawerMode('create')
    setEditing(null)
    setDrawerOpen(true)
  }

  function openEdit(row: FormTemplateFieldRow) {
    setDrawerMode('edit')
    setEditing(row)
    setDrawerOpen(true)
  }

  async function handleDelete(row: FormTemplateFieldRow) {
    if (!canDelete) return
    const ok = window.confirm(`Deactivate field "${row.label}" (${row.field_key})?`)
    if (!ok) return
    try {
      await deleteTemplateField(row.id)
      await refresh()
    } catch (e: unknown) {
      alert(parseApiError(e, 'Deactivate failed').message)
    }
  }

  function close() {
    setDrawerOpen(false)
  }

  async function onSaved() {
    close()
    await refresh()
  }

  const defaultSection = useMemo(() => {
    if (sectionFilter !== 'all') {
      const n = Number(sectionFilter)
      if (Number.isFinite(n)) return n
    }
    return sections.length ? sections[0]!.id : null
  }, [sectionFilter, sections])

  return (
    <div className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-app-text">Fields</p>
          <p className="text-xs text-app-secondary">
            Common fields apply to every role. Role-specific fields only appear when that role is selected.
          </p>
        </div>
        {canEdit ? (
          <Button onClick={openCreate} disabled={sections.length === 0} className="sm:self-start">
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Add field
          </Button>
        ) : null}
      </div>

      {sections.length === 0 ? (
        <div className="mt-3 rounded-panel border border-dashed border-app-border bg-app-muted px-4 py-3">
          <p className="text-sm font-medium text-app-text">No sections yet</p>
          <p className="mt-0.5 text-xs text-app-secondary">
            Switch to the <span className="font-semibold">Sections</span> tab and add sections such as General Information and Documents before creating fields.
          </p>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Select
          id="field_filter_section"
          label="Section"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
        >
          <option value="all">All sections</option>
          {sections.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          id="field_filter_role"
          label="Role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
        >
          <option value="all">All</option>
          {roleFilterOptions.hasCommon ? <option value="common">Common only</option> : null}
          {roleFilterOptions.roles.map((r) => (
            <option key={r.id} value={String(r.id)}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select
          id="field_filter_active"
          label="Status"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
        >
          <option value="all">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </div>

      <div className="mt-4">
        {loading ? (
          <Spinner label="Loading fields..." />
        ) : error ? (
          <ErrorState message={error} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No fields match"
            description="Adjust the filters above or add a new field for this template."
          />
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {filtered.map((f) => (
                <div key={f.id} className="rounded border border-app-border bg-app-muted p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-app-text">{f.label}</p>
                      <p className="truncate font-mono text-xs text-app-secondary">{f.field_key}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {f.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                      {f.is_required ? <Badge variant="warning">Required</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-app-secondary">
                    <span className="flex items-center gap-1">
                      <span className="text-app-subtle">Type:</span>
                      <Badge variant={fieldTypeBadgeVariant(f.field_type)}>
                        {FIELD_TYPE_LABEL[f.field_type]}
                      </Badge>
                    </span>
                    <span>
                      <span className="text-app-subtle">Section:</span>{' '}
                      {f.section_name ?? sectionNameById.get(f.section ?? -1) ?? '—'}
                    </span>
                    <span>
                      <span className="text-app-subtle">Role:</span>{' '}
                      {f.role == null ? 'Common' : f.role_name ?? roleNameById.get(f.role) ?? `Role #${f.role}`}
                    </span>
                    <span>
                      <span className="text-app-subtle">Order:</span> {f.sort_order}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {canEdit ? (
                      <Button variant="secondary" className="min-h-9 px-3" onClick={() => openEdit(f)}>
                        <Pencil className="mr-1 h-4 w-4" aria-hidden />
                        Edit
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button variant="danger" className="min-h-9 px-3" onClick={() => handleDelete(f)}>
                        <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Field</TH>
                    <TH>Section</TH>
                    <TH>Type</TH>
                    <TH>Role</TH>
                    <TH>Required</TH>
                    <TH>Order</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((f) => (
                    <TR key={f.id}>
                      <TD className="py-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-app-text">{f.label}</p>
                          <p className="font-mono text-xs text-app-secondary">{f.field_key}</p>
                        </div>
                      </TD>
                      <TD className="py-3 text-sm text-app-secondary">
                        {f.section_name ?? sectionNameById.get(f.section ?? -1) ?? '—'}
                      </TD>
                      <TD className="py-3">
                        <Badge variant={fieldTypeBadgeVariant(f.field_type)}>
                          {FIELD_TYPE_LABEL[f.field_type]}
                        </Badge>
                      </TD>
                      <TD className="py-3 text-sm text-app-secondary">
                        {f.role == null ? (
                          <Badge variant="neutral">Common</Badge>
                        ) : (
                          <Badge variant="info">{f.role_name ?? roleNameById.get(f.role) ?? `Role #${f.role}`}</Badge>
                        )}
                      </TD>
                      <TD className="py-3 text-sm text-app-secondary">
                        {f.is_required ? <Badge variant="warning">Required</Badge> : <span className="text-app-subtle">Optional</span>}
                      </TD>
                      <TD className="py-3 text-sm text-app-secondary">{f.sort_order}</TD>
                      <TD className="py-3">
                        {f.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
                      </TD>
                      <TD className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit ? (
                            <Button variant="secondary" className="min-h-9 px-2" onClick={() => openEdit(f)} aria-label="Edit" title="Edit">
                              <Pencil className="h-4 w-4" aria-hidden />
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="danger"
                              className="min-h-9 px-2"
                              onClick={() => handleDelete(f)}
                              aria-label="Deactivate"
                              title="Deactivate"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <TemplateFieldDrawer
        open={drawerOpen}
        mode={drawerMode}
        templateId={templateId}
        initialField={editing}
        defaultSection={defaultSection}
        sections={sections}
        jobRoles={jobRoles}
        jobRolesError={jobRolesError}
        onClose={close}
        onSaved={onSaved}
      />
    </div>
  )
}
