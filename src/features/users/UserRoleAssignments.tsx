import { useEffect, useState } from 'react'
import { listRoles, listScopeNodes, listUserRoleAssignments, createUserRoleAssignment, deleteUserRoleAssignment, type AccessRole, type ScopeNode, type UserRoleAssignmentRow } from '@/api/access'
import { useAuthStore } from '@/features/auth/authStore'
import { CAP, hasAnyCapability } from '@/lib/capabilities'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { parseApiError } from '@/lib/apiError'

function scopeTypeLabel(nodeType: string | undefined): string | null {
  if (!nodeType) return null
  const map: Record<string, string> = {
    company: 'Company',
    client: 'Client',
    site: 'Site',
    department: 'Department',
    region: 'Region',
    city: 'City',
    cost_center: 'Cost center',
  }
  return map[nodeType] ?? nodeType
}

export function UserRoleAssignments({ userId }: { userId: number }) {
  const caps = useAuthStore((s) => s.me?.capabilities ?? [])
  const canEdit = hasAnyCapability(caps, [CAP.ROLE_UPDATE])
  const canView = hasAnyCapability(caps, [CAP.ROLE_READ])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<UserRoleAssignmentRow[]>([])

  const [lookupsLoading, setLookupsLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [scopeNodes, setScopeNodes] = useState<ScopeNode[]>([])

  const [roleId, setRoleId] = useState<number | ''>('')
  const [scopeNodeId, setScopeNodeId] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function refresh() {
    if (!canView) {
      setRows([])
      setError('Missing capability: role.read')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await listUserRoleAssignments(userId)
      setRows(data)
    } catch (e: unknown) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Failed to load access assignments')
    } finally {
      setLoading(false)
    }
  }

  async function loadLookups() {
    setLookupsLoading(true)
    setLookupError(null)
    try {
      const [r, s] = await Promise.all([listRoles(), listScopeNodes()])
      setRoles(r.items)
      setScopeNodes(s)
    } catch (e: unknown) {
      setRoles([])
      setScopeNodes([])
      setLookupError(e instanceof Error ? e.message : 'Lookup API failed')
    } finally {
      setLookupsLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (canEdit) {
      void loadLookups()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit])

  const addDisabled = !canEdit || !!lookupError || lookupsLoading || !roleId || !scopeNodeId || submitting

  async function add() {
    if (addDisabled || typeof roleId !== 'number' || typeof scopeNodeId !== 'number') return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await createUserRoleAssignment({ user: userId, role: roleId, scope_node: scopeNodeId })
      setRoleId('')
      setScopeNodeId('')
      await refresh()
    } catch (e: unknown) {
      const parsed = parseApiError(e, 'Failed to add access assignment')
      setSubmitError(parsed.fields.scope_node || parsed.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: number) {
    if (!canEdit) return
    const ok = window.confirm('Remove this access assignment?')
    if (!ok) return
    try {
      await deleteUserRoleAssignment(id)
      await refresh()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Remove failed')
    }
  }

  return (
    <section className="rounded-panel border border-app-border bg-app-surface p-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-app-text">Access assignments</h3>
          <p className="mt-1 text-xs text-app-secondary">
            A user receives access by getting a role at a specific company, client, or site.
          </p>
        </div>
        {canEdit ? <Badge variant="info">Editable</Badge> : <Badge variant="neutral">Read-only</Badge>}
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center">
          <Spinner label="Loading access assignments" />
        </div>
      ) : error ? (
        <div className="mt-4 space-y-3">
          <ErrorState message={error} />
          <Button variant="secondary" onClick={() => refresh()}>
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No access assignments" description="Add a role at a company, client, or site to grant access." />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => {
            const typeLbl = scopeTypeLabel(r.role_node_type_scope)
            return (
              <li key={r.id} className="flex flex-col gap-1 rounded-panel border border-app-border bg-app-muted p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-app-text">
                      {r.role_name} <span className="text-app-subtle">({r.role_code})</span>
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-app-secondary">{r.scope_node_path}</p>
                    {typeLbl ? <p className="mt-1 text-xs text-app-subtle">Level: {typeLbl}</p> : null}
                  </div>
                  {canEdit ? (
                    <Button variant="danger" className="min-h-9 px-3" onClick={() => remove(r.id)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-6 rounded-panel border border-app-border bg-app-muted p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-app-text">Add access assignment</p>
          {lookupsLoading ? <span className="text-xs text-app-subtle">Loading lookups...</span> : null}
        </div>

        {lookupError ? (
          <div className="mt-3">
            <ErrorState message={`Lookup API failed. Add is disabled. ${lookupError}`} />
          </div>
        ) : null}

        {submitError ? (
          <div className="mt-3">
            <ErrorState message={submitError} />
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Select
            id="role"
            label="Role"
            value={roleId === '' ? '' : String(roleId)}
            onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : '')}
            disabled={!canEdit || lookupsLoading || !!lookupError}
          >
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} ({role.code})
              </option>
            ))}
          </Select>
          <Select
            id="scope_node"
            label="Company / Client / Site"
            value={scopeNodeId === '' ? '' : String(scopeNodeId)}
            onChange={(e) => setScopeNodeId(e.target.value ? Number(e.target.value) : '')}
            disabled={!canEdit || lookupsLoading || !!lookupError}
          >
            <option value="">Select location</option>
            {scopeNodes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.path || `${s.name} (${s.node_type})`}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-3 flex justify-end">
          <Button variant="primary" onClick={add} disabled={addDisabled}>
            {submitting ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </div>
    </section>
  )
}
