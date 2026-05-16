import { Badge } from '@/components/ui/Badge'
import { ErrorState } from '@/components/ui/ErrorState'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import type { ApprovalRoutePreview } from '@/features/workflow/types'
import { cn } from '@/lib/cn'

function scopeLabel(level: ApprovalRoutePreview['scope_level']): string {
  if (level === 'site') return 'Site'
  if (level === 'client') return 'Client'
  return 'Organization'
}

export function ApprovalRouteSelector({
  routes,
  selectedRouteId,
  onChange,
  loading,
  error,
  disabled,
  emptyMessage,
}: {
  routes: ApprovalRoutePreview[]
  selectedRouteId: number | null
  onChange: (id: number | null) => void
  loading?: boolean
  error?: string | null
  disabled?: boolean
  /** Shown when the routes list is empty (no error, not loading). */
  emptyMessage?: string
}) {
  const selected = routes.find((r) => r.id === selectedRouteId) ?? null

  if (loading) {
    return (
      <div className="rounded-panel border border-app-border bg-app-muted p-4">
        <Spinner label="Loading approval routes" />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} />
  }

  if (!routes.length) {
    return (
      <div className="rounded-panel border border-app-border bg-app-muted p-4">
        <p className="text-sm font-medium text-app-text">Approval route</p>
        <p className="mt-2 text-sm text-app-secondary">
          {emptyMessage ?? 'No approval route is configured for this MRF.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-panel border border-app-border bg-app-muted p-4">
      <div className="space-y-1">
        <Select
          id="mrf_approval_route"
          label="Approval route"
          value={selectedRouteId != null ? String(selectedRouteId) : ''}
          onChange={(e) => {
            const v = e.target.value
            onChange(v ? Number(v) : null)
          }}
          disabled={disabled}
        >
          <option value="">Select a route…</option>
          {routes.map((r) => (
            <option key={r.id} value={String(r.id)}>
              {r.name}
              {!r.ok ? ' (needs setup)' : ''}
            </option>
          ))}
        </Select>
        {selected ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="neutral">{scopeLabel(selected.scope_level)}</Badge>
            {selected.is_default ? <Badge variant="info">Default</Badge> : null}
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="border-t border-app-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Route preview</p>
          {selected.description?.trim() ? (
            <p className="mt-1 text-xs text-app-secondary">{selected.description.trim()}</p>
          ) : null}
          {!selected.ok && selected.errors?.length ? (
            <ul className="mt-2 list-inside list-disc text-xs text-status-danger">
              {selected.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          ) : null}
          <ol className="mt-3 space-y-2">
            {[...selected.steps].sort((a, b) => a.order - b.order).map((step) => (
              <li
                key={`${selected.id}-${step.order}-${step.step_name}`}
                className={cn(
                  'rounded-panel border p-2 text-sm',
                  step.assignment_ok ? 'border-app-border bg-app-surface' : 'border-status-danger/40 bg-status-danger/5',
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-app-text">
                    {step.order}. {step.step_name}
                  </span>
                  {!step.assignment_ok ? (
                    <span className="text-xs text-status-danger">Needs assignee</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-app-secondary">
                  Department: {step.department_name ?? '—'}
                </p>
                <p className="text-xs text-app-secondary">
                  Approver:{' '}
                  {step.assigned_user_name?.trim() ||
                    step.assigned_user_username?.trim() ||
                    '—'}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}
