import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { actOnWorkflowStep, getMyWorkflowTaskDetail } from '@/api/workflow'
import { parseApiError } from '@/lib/apiError'
import { formatMoneyAmount, budgetReservationStatusLabel, budgetReservationStatusVariant } from '@/features/budgets/budgetDisplay'
import { formatBudgetAmount } from '@/features/budgets/types'
import type {
  WorkflowAction,
  WorkflowMyTask,
  WorkflowTaskAuditEntry,
  WorkflowTaskDetailResponse,
  WorkflowTaskMRF,
  WorkflowTaskMRFLineItem,
  WorkflowTaskStep,
  WorkflowTaskTarget,
} from '@/features/workflow/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Drawer } from '@/components/ui/Drawer'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { TaskStatusBadge } from '@/features/workflowTasks/TaskStatusBadge'
import {
  BudgetsTabOnboarding,
  UsersTabOnboarding,
  ClientTabOnboarding,
  DepartmentsTabOnboarding,
  OnboardingOverviewTab,
  RoleRequirementsTabOnboarding,
  SitesTabOnboarding,
} from '@/features/workflowTasks/workflowTaskOnboardingTabs'
import { cn } from '@/lib/cn'

function isMrfTarget(t: WorkflowTaskTarget): t is Extract<WorkflowTaskTarget, { type: 'mrf' }> {
  return t.type === 'mrf'
}

function isOnboardingTarget(
  t: WorkflowTaskTarget,
): t is Extract<WorkflowTaskTarget, { type: 'client_onboarding' }> {
  return t.type === 'client_onboarding'
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return String(iso)
  }
}

function humanizeMrfType(code: string): string {
  return code.replace(/_/g, ' ')
}

type MrfTabId = 'overview' | 'request' | 'line-items' | 'timeline' | 'action'
type OnboardingTabId = 'overview' | 'client' | 'sites' | 'departments' | 'roles' | 'budgets' | 'users' | 'timeline' | 'action'
type TabId = MrfTabId | OnboardingTabId

const MRF_TABS: { id: MrfTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'request', label: 'Request' },
  { id: 'line-items', label: 'Line items' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'action', label: 'Action' },
]

const ONBOARDING_TABS: { id: OnboardingTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'client', label: 'Client' },
  { id: 'sites', label: 'Sites' },
  { id: 'departments', label: 'Departments' },
  { id: 'roles', label: 'Role requirements' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'users', label: 'Users' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'action', label: 'Action' },
]

function OverviewTab({ task }: { task: WorkflowMyTask }) {
  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Request</dt>
        <dd className="mt-1 font-medium text-app-text">{task.target_title}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Current approval</dt>
        <dd className="mt-1 text-app-text">{task.step_name}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Assigned department</dt>
        <dd className="mt-1 text-app-text">{task.assigned_department_name?.trim() || '-'}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Client</dt>
        <dd className="mt-1 text-app-text">{task.client_name?.trim() || '-'}</dd>
      </div>
      {task.target_type === 'mrf' ? (
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Site</dt>
          <dd className="mt-1 text-app-text">{task.site_name?.trim() || '-'}</dd>
        </div>
      ) : null}
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Request status</dt>
        <dd className="mt-1 text-app-text">{task.target_status.replace(/_/g, ' ')}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Activated</dt>
        <dd className="mt-1 text-app-secondary">{formatWhen(task.activated_at)}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Due</dt>
        <dd className="mt-1 text-app-secondary">{formatWhen(task.due_at)}</dd>
      </div>
    </dl>
  )
}

function BudgetBlockMrf({ mrf }: { mrf: WorkflowTaskMRF }) {
  const hasPlan = mrf.budget_plan != null || !!mrf.budget_plan_name?.trim()
  const taskIncludesReservationFields =
    mrf.budget_reserved_amount != null ||
    mrf.budget_committed_amount != null ||
    (mrf.budget_reservation_status != null && mrf.budget_reservation_status !== '')

  if (!hasPlan && !taskIncludesReservationFields) return null

  const cur = mrf.budget_plan_currency ?? 'INR'

  return (
    <div className="rounded-panel border border-app-border bg-app-muted p-3">
      {hasPlan ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Budget plan</p>
          <p className="mt-1 text-sm font-medium text-app-text">
            {mrf.budget_plan_name ?? 'Linked plan'}
            {mrf.budget_plan_code ? <span className="ml-1 font-mono text-xs text-app-secondary">({mrf.budget_plan_code})</span> : null}
          </p>
          {mrf.budget_plan_amount != null ? (
            <p className="mt-1 text-xs text-app-secondary">
              {formatBudgetAmount(String(mrf.budget_plan_amount), cur)} - {mrf.budget_plan_status ?? '-'}
            </p>
          ) : mrf.budget_plan_status ? (
            <p className="mt-1 text-xs text-app-secondary">{mrf.budget_plan_status}</p>
          ) : null}
        </>
      ) : null}
      {taskIncludesReservationFields ? (
        <div className={hasPlan ? 'mt-3 border-t border-app-border pt-3' : ''}>
          <p className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Budget reservation</p>
          <div className="mt-1">
            <Badge variant={budgetReservationStatusVariant(mrf.budget_reservation_status)}>
              {budgetReservationStatusLabel(mrf.budget_reservation_status)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-app-secondary">
            Reserved budget: {formatMoneyAmount(mrf.budget_reserved_amount, cur)}
          </p>
          <p className="text-xs text-app-secondary">
            Committed budget: {formatMoneyAmount(mrf.budget_committed_amount, cur)}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function RequestTabMrf({ mrf }: { mrf: WorkflowTaskMRF }) {
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-3">
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">MRF type</dt>
          <dd className="text-right font-medium text-app-text">{humanizeMrfType(mrf.mrf_type)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Requested by</dt>
          <dd className="text-right text-app-text">{mrf.requested_by_username ?? '-'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Requester type</dt>
          <dd className="text-right text-app-text">{mrf.requested_by_type}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Billing type</dt>
          <dd className="text-right text-app-text">{mrf.billing_type.replace(/_/g, ' ')}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Requesting department</dt>
          <dd className="max-w-[55%] text-right text-app-text">{mrf.requesting_department_name ?? '-'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Required department</dt>
          <dd className="max-w-[55%] text-right text-app-text">{mrf.required_department_name ?? '-'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Required by</dt>
          <dd className="text-right text-app-text">{mrf.required_by_date || '-'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-subtle">Client visible</dt>
          <dd className="text-right text-app-text">{mrf.client_visible ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
      {mrf.reason?.trim() ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Reason</p>
          <p className="mt-1 whitespace-pre-wrap text-app-secondary">{mrf.reason}</p>
        </div>
      ) : null}
      <BudgetBlockMrf mrf={mrf} />
    </div>
  )
}

function LineItemsTab({ items }: { items: WorkflowTaskMRFLineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-app-secondary">No line items found.</p>
  }
  return (
    <div className="overflow-x-auto rounded-panel border border-app-border">
      <Table>
        <THead>
          <TR>
            <TH className="py-2">Job role</TH>
            <TH className="py-2">Headcount</TH>
            <TH className="py-2">Wage category</TH>
            <TH className="py-2">Wage range</TH>
            <TH className="py-2">Billing rate</TH>
            <TH className="py-2">Budget plan</TH>
          </TR>
        </THead>
        <TBody>
          {items.map((li) => (
            <TR key={li.id}>
              <TD className="py-2 text-sm">{li.job_role_name ?? (li.job_role != null ? `#${li.job_role}` : '-')}</TD>
              <TD className="py-2 text-sm">{li.headcount}</TD>
              <TD className="py-2 text-xs text-app-secondary">{li.wage_category_name ?? '-'}</TD>
              <TD className="py-2 text-xs text-app-secondary">
                {li.wage_min_requested ?? '-'} - {li.wage_max_requested ?? '-'}
              </TD>
              <TD className="py-2 text-xs text-app-secondary">{li.billing_rate_snapshot ?? '-'}</TD>
              <TD className="py-2 text-xs text-app-secondary">{li.budget_plan_name ?? (li.budget_plan != null ? `#${li.budget_plan}` : '-')}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  )
}

function TimelineTab({
  steps,
  audit,
  currentStepId,
}: {
  steps: WorkflowTaskStep[]
  audit: WorkflowTaskAuditEntry[]
  currentStepId: number | null
}) {
  return (
    <div className="space-y-6 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Steps</p>
        <ul className="mt-2 space-y-2">
          {steps.map((s) => {
            const isCurrent = currentStepId != null && s.id === currentStepId
            const isActive = s.status === 'active'
            return (
              <li
                key={s.id}
                className={cn(
                  'rounded-panel border p-3',
                  isCurrent || isActive ? 'border-brand-600 bg-brand-600/5' : 'border-app-border bg-app-muted',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-app-text">
                    {s.step_order}. {s.step_name}
                  </span>
                  <TaskStatusBadge status={s.status} />
                </div>
                <p className="mt-1 text-xs text-app-secondary">
                  Assignee: {s.assigned_user_username ?? '-'}
                  {s.assigned_department_name ? ` / ${s.assigned_department_name}` : null}
                </p>
                {s.action_taken ? (
                  <p className="mt-1 text-xs text-app-subtle">
                    Outcome: {s.action_taken.replace(/_/g, ' ')}
                    {s.acted_by_username ? ` / ${s.acted_by_username}` : null}
                    {s.acted_at ? ` / ${formatWhen(s.acted_at)}` : null}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Activity</p>
        <ul className="mt-2 space-y-2">
          {audit.map((a) => (
            <li key={a.id} className="rounded-panel border border-app-border bg-app-muted p-2 text-xs">
              <span className="font-medium text-app-text">{a.action.replace(/_/g, ' ')}</span>
              {a.actor_username ? <span className="text-app-secondary"> / {a.actor_username}</span> : null}
              <span className="text-app-subtle"> / {formatWhen(a.created_at)}</span>
              {a.comment?.trim() ? <p className="mt-1 text-app-secondary">{a.comment}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function TaskActionForm({
  detail,
  onSuccess,
}: {
  detail: WorkflowTaskDetailResponse
  onSuccess: () => void
}) {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { actions, task, workflow } = detail
  const instanceId = workflow.id
  const stepId = task.step_id

  async function submit(action: WorkflowAction) {
    setError(null)
    if (action !== 'approve') {
      if (!comment.trim()) {
        setError(action === 'reject' ? 'A comment is required to reject.' : 'A comment is required to request changes.')
        return
      }
    }
    setSubmitting(true)
    try {
      await actOnWorkflowStep(instanceId, stepId, {
        action,
        comment: comment.trim() || undefined,
      })
      setComment('')
      onSuccess()
    } catch (e: unknown) {
      setError(parseApiError(e, 'Action failed').message)
    } finally {
      setSubmitting(false)
    }
  }

  const anyAction = actions.can_approve || actions.can_reject || actions.can_request_changes

  return (
    <div className="space-y-4">
      {!anyAction ? (
        <p className="text-sm text-app-secondary">No actions are available for this step.</p>
      ) : (
        <>
          <p className="text-xs text-app-secondary">
            Reject and request changes require a comment. Approve may include an optional comment.
          </p>
          {error ? <ErrorState message={error} /> : null}
          <div className="flex flex-col gap-1">
            <label htmlFor="wf-task-drawer-comment" className="text-sm font-medium text-app-secondary">
              Comment
            </label>
            <textarea
              id="wf-task-drawer-comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
              className="min-h-[6rem] rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-panel placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              placeholder="Optional for approve; required for reject or request changes"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.can_approve ? (
              <Button className="min-h-9" disabled={submitting} onClick={() => void submit('approve')}>
                Approve
              </Button>
            ) : null}
            {actions.can_reject ? (
              <Button variant="danger" className="min-h-9" disabled={submitting} onClick={() => void submit('reject')}>
                Reject
              </Button>
            ) : null}
            {actions.can_request_changes ? (
              <Button variant="secondary" className="min-h-9" disabled={submitting} onClick={() => void submit('request_changes')}>
                Request changes
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

export function WorkflowTaskDrawer({
  open,
  stepId,
  onClose,
  onActionComplete,
}: {
  open: boolean
  stepId: number | null
  onClose: () => void
  onActionComplete: () => void
}) {
  const [tab, setTab] = useState<TabId>('overview')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [detail, setDetail] = useState<WorkflowTaskDetailResponse | null>(null)

  const resetLocal = useCallback(() => {
    setLoadError(null)
    setDetail(null)
    setTab('overview')
  }, [])

  useEffect(() => {
    if (!open || stepId == null) {
      resetLocal()
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setDetail(null)

    void (async () => {
      try {
        const data = await getMyWorkflowTaskDetail(stepId)
        if (cancelled) return
        if (data.target.type !== 'mrf' && data.target.type !== 'client_onboarding') {
          setLoadError('This task uses an unsupported request type.')
          return
        }
        setDetail(data)
      } catch (e: unknown) {
        if (cancelled) return
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          setLoadError('This task is no longer active or assigned to you.')
        } else {
          setLoadError(parseApiError(e, 'Failed to load task').message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, stepId, resetLocal])

  const isMrf = detail ? isMrfTarget(detail.target) : false

  const visibleTabs = useMemo(() => (isMrf ? MRF_TABS : ONBOARDING_TABS), [isMrf])

  useEffect(() => {
    if (!detail) return
    const validIds = visibleTabs.map((t) => t.id)
    if (!validIds.includes(tab)) setTab('overview')
  }, [detail, tab, visibleTabs])

  function handleClose() {
    resetLocal()
    onClose()
  }

  function handleActionSuccess() {
    onActionComplete()
    handleClose()
  }

  const title = detail?.task.target_title ?? 'Approval task'
  const description = detail ? `${detail.task.step_name} / Review and act here.` : undefined

  return (
    <Drawer
      open={open && stepId != null}
      title={title}
      description={description}
      onClose={handleClose}
      panelClassName="max-w-[min(100vw,48rem)]"
    >
      {loading ? (
        <Spinner label="Loading task..." />
      ) : loadError ? (
        <ErrorState message={loadError} />
      ) : detail ? (
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex gap-1 overflow-x-auto border-b border-app-border pb-px">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'shrink-0 rounded-t-panel px-3 py-2 text-sm font-medium transition-colors',
                  tab === t.id ?
                    'border-b-2 border-brand-600 text-brand-700'
                  : 'border-b-2 border-transparent text-app-secondary hover:text-app-text',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1">
            {tab === 'overview' ?
              isMrfTarget(detail.target) ?
                <OverviewTab task={detail.task} />
              : <OnboardingOverviewTab task={detail.task} ob={detail.target.client_onboarding} />
            : null}
            {tab === 'request' && isMrfTarget(detail.target) ? <RequestTabMrf mrf={detail.target.mrf} /> : null}
            {tab === 'client' && isOnboardingTarget(detail.target) ?
              <ClientTabOnboarding ob={detail.target.client_onboarding} />
            : null}
            {tab === 'sites' && isOnboardingTarget(detail.target) ?
              <SitesTabOnboarding ob={detail.target.client_onboarding} />
            : null}
            {tab === 'departments' && isOnboardingTarget(detail.target) ?
              <DepartmentsTabOnboarding ob={detail.target.client_onboarding} />
            : null}
            {tab === 'roles' && isOnboardingTarget(detail.target) ?
              <RoleRequirementsTabOnboarding ob={detail.target.client_onboarding} />
            : null}
            {tab === 'budgets' && isOnboardingTarget(detail.target) ?
              <BudgetsTabOnboarding ob={detail.target.client_onboarding} />
            : null}
            {tab === 'users' && isOnboardingTarget(detail.target) ?
              <UsersTabOnboarding ob={detail.target.client_onboarding} />
            : null}
            {tab === 'line-items' && isMrfTarget(detail.target) ? <LineItemsTab items={detail.target.line_items} /> : null}
            {tab === 'timeline' ? (
              <TimelineTab
                steps={detail.workflow.steps}
                audit={detail.workflow.audit_trail}
                currentStepId={detail.workflow.current_step_id}
              />
            ) : null}
            {tab === 'action' ? <TaskActionForm key={`${detail.task.step_id}-${detail.workflow.id}`} detail={detail} onSuccess={handleActionSuccess} /> : null}
          </div>
        </div>
      ) : null}
    </Drawer>
  )
}


