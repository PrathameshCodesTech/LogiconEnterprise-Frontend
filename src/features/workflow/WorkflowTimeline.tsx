import type { WorkflowAuditEntry, WorkflowInstance, WorkflowStepInstance } from '@/features/workflow/types'

function str(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  return '—'
}

function formatDt(v: unknown): string {
  if (typeof v !== 'string' || !v) return '—'
  try {
    return new Date(v).toLocaleString()
  } catch {
    return v
  }
}

export function WorkflowTimeline({ instance, loading, errorMessage }: { instance: WorkflowInstance | null; loading?: boolean; errorMessage?: string | null }) {
  if (loading) {
    return <p className="text-xs text-app-subtle">Loading workflow timeline…</p>
  }
  if (errorMessage) {
    return <p className="text-sm text-status-danger">{errorMessage}</p>
  }
  if (!instance) {
    return <p className="text-sm text-app-secondary">No workflow instance loaded.</p>
  }

  const steps = Array.isArray(instance.steps) ? [...instance.steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0)) : []
  const audit = Array.isArray(instance.audit_trail) ? [...instance.audit_trail] : []
  audit.sort((a, b) => {
    const ta = typeof a.created_at === 'string' ? a.created_at : ''
    const tb = typeof b.created_at === 'string' ? b.created_at : ''
    return tb.localeCompare(ta)
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">Steps</p>
        {steps.length === 0 ? (
          <p className="mt-2 text-sm text-app-secondary">No steps.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {steps.map((s: WorkflowStepInstance) => (
              <li
                key={s.id}
                className="rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm shadow-panel"
              >
                <p className="font-medium text-app-text">
                  {str(s.step_order)}. {str(s.step_name)}{' '}
                  <span className="font-mono text-xs text-app-secondary">({str(s.step_code)})</span>
                </p>
                <p className="mt-1 text-xs text-app-secondary">
                  Status: <span className="font-medium text-app-text">{str(s.status)}</span>
                </p>
                <dl className="mt-2 grid gap-1 text-xs text-app-secondary">
                  <div className="flex justify-between gap-2">
                    <dt className="text-app-subtle">Assigned</dt>
                    <dd>{str(s.assigned_user_username)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-app-subtle">Department</dt>
                    <dd>{str(s.assigned_department_name_snapshot)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-app-subtle">Acted by</dt>
                    <dd>{str(s.acted_by_username)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-app-subtle">Acted at</dt>
                    <dd>{formatDt(s.acted_at)}</dd>
                  </div>
                  {s.comment ? (
                    <div className="mt-1 border-t border-app-border pt-1">
                      <dt className="text-app-subtle">Comment</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-app-text">{String(s.comment)}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">Audit trail</p>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-app-secondary">No audit entries.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {audit.map((a: WorkflowAuditEntry, i: number) => (
              <li
                key={a.id ?? i}
                className="rounded-panel border border-app-border bg-app-muted px-3 py-2 text-xs shadow-panel"
              >
                <p className="font-medium text-app-text">{str(a.action)}</p>
                <p className="mt-1 text-app-secondary">
                  {str(a.actor_username)} · {formatDt(a.created_at)}
                </p>
                {a.comment ? <p className="mt-2 whitespace-pre-wrap text-app-secondary">{String(a.comment)}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
