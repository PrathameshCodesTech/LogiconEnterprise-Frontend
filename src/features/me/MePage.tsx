import { useMemo, useState } from 'react'
import { useAuthStore } from '@/features/auth/authStore'
import { displayName, userTypeLabel } from '@/features/users/types'
import type { UserType } from '@/features/users/types'
import { formatAssignableLevel } from '@/features/roles/displayLabels'
import { groupCapabilities } from '@/features/me/capabilitySummary'
import type { UserRoleAssignment } from '@/types/api'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Drawer } from '@/components/ui/Drawer'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'

function formatUserTypeLabel(raw: string | undefined): string {
  if (raw == null || String(raw).trim() === '') return 'Not returned'
  const t = String(raw).trim()
  if (t === 'internal' || t === 'client' || t === 'field') return userTypeLabel(t as UserType)
  return t.replace(/_/g, ' ')
}

function roleAssignmentsTable(assignments: UserRoleAssignment[]) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <Table>
        <THead>
          <TR>
            <TH className="py-2">Role</TH>
            <TH className="py-2">Scope</TH>
            <TH className="py-2">Level</TH>
          </TR>
        </THead>
        <TBody>
          {assignments.map((r) => (
            <TR key={r.id}>
              <TD className="py-2 align-top">
                <span className="font-medium text-app-text">{r.role_name}</span>{' '}
                <span className="text-xs text-app-subtle">({r.role_code})</span>
              </TD>
              <TD className="py-2 align-top font-mono text-xs text-app-secondary">{r.scope_node_path}</TD>
              <TD className="py-2 align-top text-sm text-app-secondary">{formatAssignableLevel(r.role_node_type_scope)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  )
}

function roleAssignmentsCards(assignments: UserRoleAssignment[]) {
  return (
    <ul className="space-y-3 md:hidden">
      {assignments.map((r) => (
        <li key={r.id} className="rounded-panel border border-app-border bg-app-muted p-4">
          <p className="font-medium text-app-text">
            {r.role_name} <span className="text-xs font-normal text-app-subtle">({r.role_code})</span>
          </p>
          <p className="mt-2 font-mono text-xs text-app-secondary">{r.scope_node_path}</p>
          <p className="mt-1 text-xs text-app-secondary">
            <span className="text-app-subtle">Level:</span> {formatAssignableLevel(r.role_node_type_scope)}
          </p>
        </li>
      ))}
    </ul>
  )
}

export function MePage() {
  const me = useAuthStore((s) => s.me)
  const meLoading = useAuthStore((s) => s.meLoading)
  const meError = useAuthStore((s) => s.meError)

  const [techOpen, setTechOpen] = useState(false)

  const caps = me?.capabilities ?? []
  const roleAssignments = me?.role_assignments ?? []

  const groupedCaps = useMemo(() => groupCapabilities(caps), [caps])

  if (meLoading && !me) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Loading profile" />
      </div>
    )
  }

  if (meError && !me) {
    return <ErrorState message={meError} />
  }

  if (!me) {
    return <ErrorState message="No profile data loaded." />
  }

  const orgDisplay = me.org != null ? `Organization #${me.org}` : 'Not returned'

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-app-text">My access</h2>
        <p className="mt-1 text-sm text-app-secondary">
          Review your profile, assigned roles, and where your access applies.
        </p>
      </div>

      <section className="rounded-panel border border-app-border bg-app-surface p-5 shadow-panel">
        <h3 className="text-sm font-semibold text-app-text">Profile</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-app-subtle">Name</dt>
            <dd className="font-medium text-app-text">{displayName(me)}</dd>
          </div>
          <div>
            <dt className="text-app-subtle">Username</dt>
            <dd className="font-medium text-app-text">{me.username}</dd>
          </div>
          <div>
            <dt className="text-app-subtle">Email</dt>
            <dd className="font-medium text-app-text">{me.email?.trim() ? me.email : '—'}</dd>
          </div>
          <div>
            <dt className="text-app-subtle">User type</dt>
            <dd className="font-medium text-app-text">{formatUserTypeLabel(me.user_type)}</dd>
          </div>
          <div>
            <dt className="text-app-subtle">Organization</dt>
            <dd className="font-medium text-app-text">{orgDisplay}</dd>
          </div>
          <div>
            <dt className="text-app-subtle">Staff</dt>
            <dd className="font-medium text-app-text">{me.is_staff ? 'Yes' : 'No'}</dd>
          </div>
          {me.is_superuser ? (
            <div>
              <dt className="text-app-subtle">Superuser</dt>
              <dd className="font-medium text-app-text">Yes</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-panel border border-app-border bg-app-surface p-5 shadow-panel">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-app-text">Access assignments</h3>
            <p className="mt-1 text-xs text-app-secondary">These roles define what you can do and where.</p>
          </div>
        </div>

        {roleAssignments.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No access assignments found." description="You do not have any role-based access recorded yet." />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {roleAssignmentsTable(roleAssignments)}
            {roleAssignmentsCards(roleAssignments)}
          </div>
        )}
      </section>

      <section className="rounded-panel border border-app-border bg-app-surface p-5 shadow-panel">
        <div>
          <h3 className="text-sm font-semibold text-app-text">What I can access</h3>
          <p className="mt-1 text-xs text-app-secondary">Summary of permissions granted by your assigned roles.</p>
        </div>

        {caps.length === 0 ? (
          <p className="mt-4 text-sm text-app-secondary">No permissions returned for this account.</p>
        ) : groupedCaps.length === 0 ? (
          <p className="mt-4 text-sm text-app-secondary">No permissions returned for this account.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {groupedCaps.map((g) => (
              <li key={`${g.sortKey}-${g.areaLabel}`} className="rounded-panel border border-app-border bg-app-muted p-4">
                <p className="text-sm font-semibold text-app-text">{g.areaLabel}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.actions.map((a) => (
                    <span key={a.raw} title={a.raw}>
                      <Badge variant="neutral" className="font-normal">
                        {a.friendly}
                      </Badge>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" className="min-h-9" onClick={() => setTechOpen(true)}>
          Show technical details
        </Button>
      </div>

      <Drawer
        open={techOpen}
        title="Technical details"
        description="Raw API payload fragments for support and debugging."
        onClose={() => setTechOpen(false)}
      >
        <div className="space-y-5 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-app-subtle">Capabilities</p>
            <pre className="mt-2 max-h-48 overflow-auto rounded-panel bg-app-muted p-3 text-xs text-app-text">
              {JSON.stringify(me.capabilities ?? [], null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-app-subtle">Role assignments</p>
            <pre className="mt-2 max-h-48 overflow-auto rounded-panel bg-app-muted p-3 text-xs text-app-text">
              {JSON.stringify(me.role_assignments ?? [], null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-app-subtle">Scope assignments (informational)</p>
            <pre className="mt-2 max-h-48 overflow-auto rounded-panel bg-app-muted p-3 text-xs text-app-text">
              {JSON.stringify(me.scope_assignments ?? [], null, 2)}
            </pre>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
