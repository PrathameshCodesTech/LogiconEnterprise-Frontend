import { useEffect, useMemo, useState } from 'react'
import { listRolePermissions, type AccessRole, type RolePermission } from '@/api/access'
import { parseApiError } from '@/lib/apiError'
import { Badge } from '@/components/ui/Badge'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { formatAssignableLevel, permissionAreaLabel } from '@/features/roles/displayLabels'

export function RoleCatalogDetail({ role }: { role: AccessRole }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<RolePermission[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setRows([])
    void (async () => {
      try {
        const res = await listRolePermissions({ role: role.id })
        if (!cancelled) setRows(res.items)
      } catch (e: unknown) {
        if (!cancelled) setError(parseApiError(e, 'Failed to load role permissions').message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role.id])

  const countsByArea = useMemo(() => {
    const m = new Map<string, number>()
    for (const rp of rows) {
      const r = (rp.permission_resource || 'other').trim() || 'other'
      m.set(r, (m.get(r) ?? 0) + 1)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  if (loading) return <Spinner label="Loading role details..." />

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">Role details</p>
        <h3 className="mt-1 text-lg font-semibold text-app-text">{role.name}</h3>
      </div>

      <dl className="grid gap-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Code</dt>
          <dd className="font-mono text-xs text-app-secondary">{role.code}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Assignable level</dt>
          <dd className="text-right font-medium text-app-text">{formatAssignableLevel(role.node_type_scope)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Status</dt>
          <dd>{role.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Permissions</dt>
          <dd className="font-medium text-app-text">{rows.length}</dd>
        </div>
      </dl>

      <p className="text-xs text-app-subtle">Permissions are managed by system administrators.</p>

      {error ? <ErrorState message={error} /> : null}

      {!error && countsByArea.length > 0 ? (
        <div className="rounded-panel border border-app-border bg-app-muted p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">By area</p>
          <ul className="mt-2 space-y-1 text-sm text-app-secondary">
            {countsByArea.map(([resource, n]) => (
              <li key={resource} className="flex justify-between gap-2">
                <span>{permissionAreaLabel(resource)}</span>
                <span className="font-mono text-xs text-app-text">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
