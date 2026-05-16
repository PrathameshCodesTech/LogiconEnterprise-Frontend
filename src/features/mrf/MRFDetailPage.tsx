import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { deleteMRF, getMRF, updateMRF } from '@/api/mrf'
import { departmentToFormOption, listDepartments, type DepartmentOption, type DepartmentRow } from '@/api/departments'
import {
  getMRFWorkflowConfigCheck,
  getWorkflowInstance,
  listAvailableApprovalRoutes,
  startMRFWorkflow,
} from '@/api/workflow'
import { listSites, type SiteProfileRow } from '@/api/sites'
import { useAuthStore } from '@/features/auth/authStore'
import { CAP, hasAnyCapability } from '@/lib/capabilities'
import { parseApiError } from '@/lib/apiError'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { MRFForm, mrfFormValuesToWritePayload, type MRFFormValues, type SiteOption } from '@/features/mrf/MRFForm'
import { MRFLineItemsTable } from '@/features/mrf/MRFLineItemsTable'
import { MRFClientFormDisplay } from '@/features/mrf/MRFClientFormDisplay'
import { MRFStatusBadge } from '@/features/mrf/MRFStatusBadge'
import type { MRFRow } from '@/features/mrf/types'
import {
  budgetReservationStatusLabel,
  budgetReservationStatusVariant,
  formatMoneyAmount,
  mrfBudgetReservationWorkflowNote,
} from '@/features/budgets/budgetDisplay'
import { budgetNatureLabel, formatBudgetAmount } from '@/features/budgets/types'
import { WorkflowActionBox } from '@/features/workflow/WorkflowActionBox'
import { WorkflowConfigCheckDrawer } from '@/features/workflow/WorkflowConfigCheckDrawer'
import { WorkflowReassignDrawer } from '@/features/workflow/WorkflowReassignDrawer'
import { WorkflowStatusPanel } from '@/features/workflow/WorkflowStatusPanel'
import { WorkflowTimeline } from '@/features/workflow/WorkflowTimeline'
import { ApprovalRouteSelector } from '@/features/workflow/ApprovalRouteSelector'
import type { ApprovalRoutePreview, WorkflowConfigCheck, WorkflowInstance } from '@/features/workflow/types'

async function loadAllActiveDepartmentOptions(): Promise<DepartmentOption[]> {
  const all: DepartmentRow[] = []
  let page = 1
  while (page <= 40) {
    const res = await listDepartments({ is_active: true, page })
    all.push(...res.items)
    if (res.items.length < 50) break
    page += 1
  }
  return all.map(departmentToFormOption)
}

export function MRFDetailPage() {
  const { id } = useParams<{ id: string }>()
  const mrfId = Number(id)
  const navigate = useNavigate()

  const me = useAuthStore((s) => s.me)
  const meCaps = useAuthStore((s) => s.me?.capabilities ?? [])
  const canUpdate = hasAnyCapability(meCaps, [CAP.MRF_UPDATE])
  const canDelete = hasAnyCapability(meCaps, [CAP.MRF_DELETE])
  const canWorkflowRead = hasAnyCapability(meCaps, [CAP.WORKFLOW_READ])
  const canWorkflowStart = hasAnyCapability(meCaps, [CAP.WORKFLOW_START])
  const canWorkflowApprove = hasAnyCapability(meCaps, [CAP.WORKFLOW_APPROVE])
  const canWorkflowReject = hasAnyCapability(meCaps, [CAP.WORKFLOW_REJECT])
  const canWorkflowReassign = hasAnyCapability(meCaps, [CAP.WORKFLOW_REASSIGN])
  const canConfigCheck = canWorkflowRead || canWorkflowStart
  const canReadBudget = hasAnyCapability(meCaps, [CAP.BUDGET_READ])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<MRFRow | null>(null)

  const [sitesError, setSitesError] = useState<string | null>(null)
  const [sites, setSites] = useState<SiteProfileRow[]>([])
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([])
  const [departmentsLoading, setDepartmentsLoading] = useState(false)
  const [departmentsError, setDepartmentsError] = useState<string | null>(null)
  const siteOptions: SiteOption[] = useMemo(
    () => sites.map((s) => ({ id: s.id, label: `${s.name} (${s.code})`, client: s.client })),
    [sites],
  )
  const siteNameById = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites])
  const siteRowForMrf = useMemo(
    () => (row != null ? sites.find((s) => s.id === row.site) : undefined),
    [sites, row],
  )

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const formId = useMemo(() => `mrf-edit-${mrfId}`, [mrfId])

  const [wfInstance, setWfInstance] = useState<WorkflowInstance | null>(null)
  const [wfInstanceLoading, setWfInstanceLoading] = useState(false)
  const [wfInstanceError, setWfInstanceError] = useState<string | null>(null)

  const [configDrawerOpen, setConfigDrawerOpen] = useState(false)
  const [configBusy, setConfigBusy] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configData, setConfigData] = useState<WorkflowConfigCheck | null>(null)

  const [startBusy, setStartBusy] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)

  const [availableRoutes, setAvailableRoutes] = useState<ApprovalRoutePreview[]>([])
  const [routesLoading, setRoutesLoading] = useState(false)
  const [routesError, setRoutesError] = useState<string | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null)
  const [startInlineError, setStartInlineError] = useState<string | null>(null)

  const selectedRoute = useMemo(
    () => availableRoutes.find((r) => r.id === selectedRouteId) ?? null,
    [availableRoutes, selectedRouteId],
  )

  const startDisabledByRoutes =
    routesLoading ||
    !!routesError ||
    (availableRoutes.length > 0 && (selectedRouteId == null || selectedRoute?.ok === false))

  const budgetWorkflowNote = useMemo(() => {
    if (!row) return null
    const hasBudgetPlan =
      row.budget_plan != null && !!(row.budget_plan_name?.trim() || row.budget_plan_code?.trim())
    return mrfBudgetReservationWorkflowNote(
      row.workflow_status != null ? String(row.workflow_status) : undefined,
      hasBudgetPlan,
      row.budget_reservation_status,
    )
  }, [row])

  const loadWorkflowInstance = useCallback(async (instanceId: number) => {
    if (!canWorkflowRead) {
      setWfInstance(null)
      setWfInstanceError(null)
      return
    }
    setWfInstanceLoading(true)
    setWfInstanceError(null)
    try {
      const inst = await getWorkflowInstance(instanceId)
      setWfInstance(inst)
    } catch (e: unknown) {
      setWfInstance(null)
      setWfInstanceError(parseApiError(e, 'Failed to load workflow instance').message)
    } finally {
      setWfInstanceLoading(false)
    }
  }, [canWorkflowRead])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await getMRF(mrfId)
      setRow(res)
    } catch (e: unknown) {
      setRow(null)
      setError(parseApiError(e, 'Failed to load MRF').message)
    } finally {
      setLoading(false)
    }
  }

  async function reloadMrfAndWorkflow() {
    try {
      const res = await getMRF(mrfId)
      setRow(res)
      if (canWorkflowRead && res.workflow_instance_id != null && res.workflow_instance_id > 0) {
        await loadWorkflowInstance(res.workflow_instance_id)
      } else {
        setWfInstance(null)
        setWfInstanceError(null)
      }
    } catch (e: unknown) {
      setWfInstanceError(parseApiError(e, 'Failed to reload MRF').message)
    }
  }

  async function handleCheckConfig() {
    setConfigDrawerOpen(true)
    setConfigBusy(true)
    setConfigData(null)
    setConfigError(null)
    try {
      const d = await getMRFWorkflowConfigCheck(mrfId)
      setConfigData(d)
    } catch (e: unknown) {
      setConfigError(parseApiError(e, 'Config check failed').message)
    } finally {
      setConfigBusy(false)
    }
  }

  async function handleStartWorkflow() {
    setStartInlineError(null)
    if (availableRoutes.length > 0) {
      if (selectedRouteId == null) {
        setStartInlineError('Select an approval route before sending for approval.')
        return
      }
      const r = availableRoutes.find((x) => x.id === selectedRouteId)
      if (!r?.ok) {
        setStartInlineError('This route is missing approvers. Choose another route or ask an administrator.')
        return
      }
    }
    setStartBusy(true)
    try {
      const routeArg = availableRoutes.length > 0 ? selectedRouteId : undefined
      await startMRFWorkflow(mrfId, routeArg ?? undefined)
      await reloadMrfAndWorkflow()
    } catch (e: unknown) {
      setStartInlineError(parseApiError(e, 'Send for approval failed').message)
    } finally {
      setStartBusy(false)
    }
  }

  async function loadSitesLookup() {
    setSitesError(null)
    try {
      const res = await listSites({ search: '', page: 1 })
      setSites(res.items)
    } catch (e: unknown) {
      setSites([])
      setSitesError(parseApiError(e, 'Site lookup failed').message)
    }
  }

  async function loadDepartmentOptions() {
    setDepartmentsLoading(true)
    setDepartmentsError(null)
    try {
      const opts = await loadAllActiveDepartmentOptions()
      setDepartmentOptions(opts)
    } catch (e: unknown) {
      setDepartmentOptions([])
      setDepartmentsError(parseApiError(e, 'Department lookup failed').message)
    } finally {
      setDepartmentsLoading(false)
    }
  }

  useEffect(() => {
    if (!Number.isFinite(mrfId)) {
      setError('Invalid MRF id.')
      setLoading(false)
      return
    }
    void refresh()
    void loadSitesLookup()
    void loadDepartmentOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mrfId])

  useEffect(() => {
    if (!row || !canWorkflowRead) {
      setWfInstance(null)
      setWfInstanceError(null)
      return
    }
    const instId = row.workflow_instance_id
    if (typeof instId === 'number' && instId > 0) {
      void loadWorkflowInstance(instId)
    } else {
      setWfInstance(null)
      setWfInstanceError(null)
    }
  }, [row?.workflow_instance_id, row?.id, canWorkflowRead, loadWorkflowInstance])

  useEffect(() => {
    if (!row || row.workflow_status !== 'not_started' || !canWorkflowStart) {
      setAvailableRoutes([])
      setRoutesError(null)
      setRoutesLoading(false)
      setSelectedRouteId(null)
      return
    }

    let cancelled = false
    setRoutesLoading(true)
    setRoutesError(null)
    setAvailableRoutes([])
    setSelectedRouteId(null)

    void (async () => {
      try {
        const clientId = siteRowForMrf?.client
        const res = await listAvailableApprovalRoutes({
          trigger_type: 'mrf',
          site: row.site,
          ...(clientId != null && Number.isFinite(clientId) ? { client: clientId } : {}),
        })
        if (cancelled) return
        const list = res.results ?? []
        setAvailableRoutes(list)
        if (list.length === 1) {
          const only = list[0]
          if (only != null) setSelectedRouteId(only.id)
        } else {
          const defaults = list.filter((r) => r.is_default)
          if (defaults.length === 1) {
            const d = defaults[0]
            if (d != null) setSelectedRouteId(d.id)
          }
        }
      } catch (e: unknown) {
        if (cancelled) return
        setAvailableRoutes([])
        setSelectedRouteId(null)
        if (axios.isAxiosError(e)) {
          if (e.response?.status === 403) {
            setRoutesError('You do not have permission to view approval routes.')
          } else if (e.response?.status === 404) {
            setRoutesError('This MRF site or client is not accessible.')
          } else {
            setRoutesError(parseApiError(e, 'Failed to load approval routes').message)
          }
        } else {
          setRoutesError(parseApiError(e, 'Failed to load approval routes').message)
        }
      } finally {
        if (!cancelled) setRoutesLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [row, row?.site, canWorkflowStart, siteRowForMrf?.client])

  function openEdit() {
    if (!canUpdate) return
    setFormError(null)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setFormSubmitting(false)
    setFormError(null)
  }

  async function submit(values: MRFFormValues) {
    if (!row) return
    setFormSubmitting(true)
    setFormError(null)
    try {
      const updated = await updateMRF(row.id, mrfFormValuesToWritePayload(values, 'edit'))
      setRow(updated)
      closeDrawer()
    } catch (e: unknown) {
      setFormError(parseApiError(e, 'Save failed').message)
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!row || !canDelete) return
    const ok = window.confirm('Delete this MRF? This cannot be undone.')
    if (!ok) return
    try {
      await deleteMRF(row.id)
      navigate('/mrf')
    } catch (e: unknown) {
      alert(parseApiError(e, 'Delete failed').message)
    }
  }

  if (loading) return <Spinner label="Loading MRF..." />
  if (error) return <ErrorState message={error} />
  if (!row) return <EmptyState title="MRF not found" description="This request may have been removed." />

  return (
    <div className="w-full space-y-6">
      <div className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">MRF</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-app-text">
              #{row.id}
              {row.request_number?.trim() ? (
                <span className="ml-2 font-mono text-sm font-normal text-app-secondary">({row.request_number})</span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-app-secondary">
              {siteNameById.get(row.site) ?? `Site #${row.site}`} - {new Date(row.created_at).toLocaleString()}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <MRFStatusBadge status={row.status} />
            {row.client_visible ? <Badge variant="info">Client visible</Badge> : null}
            <Button
              variant="secondary"
              className="min-h-9 px-2"
              onClick={() => navigate('/mrf')}
              aria-label="Back to MRF list"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
            {canUpdate ? (
              <Button variant="secondary" className="min-h-9 px-2" onClick={openEdit} aria-label="Edit MRF" title="Edit">
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="danger" className="min-h-9 px-2" onClick={handleDelete} aria-label="Delete MRF" title="Delete">
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <MRFClientFormDisplay row={row} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel lg:col-span-2">
          <p className="text-sm font-semibold text-app-text">Details</p>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">Requested by</dt>
              <dd className="font-mono text-xs text-app-secondary">User #{row.requested_by}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">Requested by type</dt>
              <dd className="font-medium text-app-text">{row.requested_by_type}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">MRF type</dt>
              <dd className="font-medium text-app-text">{row.mrf_type}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">Billing type</dt>
              <dd className="font-medium text-app-text">{row.billing_type}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">Requesting department</dt>
              <dd className="max-w-[60%] text-right font-medium text-app-text">
                {row.requesting_department_name?.trim() ||
                  (row.requesting_department != null ? `#${row.requesting_department}` : '—')}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">Required department</dt>
              <dd className="max-w-[60%] text-right font-medium text-app-text">
                {row.required_department_name?.trim() ||
                  (row.required_department != null ? `#${row.required_department}` : '—')}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">Legacy department text</dt>
              <dd className="max-w-[60%] text-right text-app-text">{row.department?.trim() ? row.department : '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">Required by</dt>
              <dd className="font-medium text-app-text">{row.required_by_date || '-'}</dd>
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-app-border pt-2">
              <dt className="text-app-subtle shrink-0">Budget plan</dt>
              <dd className="max-w-[60%] text-right text-sm text-app-text">
                {row.budget_plan != null && (row.budget_plan_name || row.budget_plan_code) ? (
                  <div className="space-y-2">
                    <p className="font-medium">
                      {row.budget_plan_name ?? 'Budget'}{' '}
                      {row.budget_plan_code ? (
                        <span className="font-mono text-xs text-app-secondary">({row.budget_plan_code})</span>
                      ) : null}
                    </p>
                    <div className="flex justify-end">
                      <Badge variant={budgetReservationStatusVariant(row.budget_reservation_status)}>
                        {budgetReservationStatusLabel(row.budget_reservation_status)}
                      </Badge>
                    </div>
                    {row.budget_plan_nature ? (
                      <p className="text-xs text-app-secondary">Nature: {budgetNatureLabel(String(row.budget_plan_nature))}</p>
                    ) : null}
                    {row.budget_plan_amount != null ? (
                      <p className="text-xs text-app-secondary">
                        Plan total: {formatBudgetAmount(String(row.budget_plan_amount), row.budget_plan_currency ?? 'INR')} —{' '}
                        {row.budget_plan_status ?? '—'}
                      </p>
                    ) : (
                      <p className="text-xs text-app-secondary">{row.budget_plan_status ?? '—'}</p>
                    )}
                    <p className="text-xs text-app-secondary">
                      Reserved budget:{' '}
                      {formatMoneyAmount(row.budget_reserved_amount ?? null, row.budget_plan_currency ?? 'INR')}
                    </p>
                    <p className="text-xs text-app-secondary">
                      Committed budget:{' '}
                      {formatMoneyAmount(row.budget_committed_amount ?? null, row.budget_plan_currency ?? 'INR')}
                    </p>
                  </div>
                ) : (
                  <span className="text-app-secondary">No budget linked</span>
                )}
              </dd>
            </div>
          </dl>
          {row.reason ? (
            <div className="mt-4 rounded-panel border border-app-border bg-app-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">Reason</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-app-secondary">{row.reason}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
          <p className="text-sm font-semibold text-app-text">Timeline</p>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">Submitted</dt>
              <dd className="text-xs text-app-secondary">{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '-'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">Approved</dt>
              <dd className="text-xs text-app-secondary">{row.approved_at ? new Date(row.approved_at).toLocaleString() : '-'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-app-subtle">Rejected</dt>
              <dd className="text-xs text-app-secondary">{row.rejected_at ? new Date(row.rejected_at).toLocaleString() : '-'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Approval workflow</p>
        <p className="mt-1 text-xs text-app-secondary">
          Choose an approval route, then send for approval. Use setup check if you need to verify assignments first.
        </p>
        {budgetWorkflowNote ? (
          <p className="mt-3 rounded-panel border border-app-border bg-app-muted px-3 py-2 text-xs text-app-secondary">
            {budgetWorkflowNote}
          </p>
        ) : null}
        {row.workflow_status === 'not_started' && canWorkflowStart ? (
          <div className="mt-4 space-y-3">
            <ApprovalRouteSelector
              routes={availableRoutes}
              selectedRouteId={selectedRouteId}
              onChange={(id) => {
                setSelectedRouteId(id)
                setStartInlineError(null)
              }}
              loading={routesLoading}
              error={routesError}
              disabled={startBusy}
            />
          </div>
        ) : null}
        {startInlineError ? (
          <div className="mt-4">
            <ErrorState message={startInlineError} />
          </div>
        ) : null}
        <div className="mt-4 border-t border-app-border pt-4">
          <WorkflowStatusPanel
            workflowStatus={row.workflow_status}
            workflowInstanceId={row.workflow_instance_id}
            workflowCurrentStepCode={row.workflow_current_step_code}
            workflowCurrentStepName={row.workflow_current_step_name}
            workflowCurrentAssignedUserName={row.workflow_current_assigned_user_name}
            workflowCurrentDepartmentName={row.workflow_current_department_name}
            canConfigCheck={canConfigCheck}
            canStart={canWorkflowStart}
            checkingConfig={configBusy}
            starting={startBusy}
            onCheckConfig={() => void handleCheckConfig()}
            onStartWorkflow={() => void handleStartWorkflow()}
            startButtonLabel="Send for approval"
            startDisabled={startDisabledByRoutes}
          />
        </div>

        {canWorkflowReassign &&
        row.workflow_status === 'active' &&
        row.workflow_instance_id != null &&
        row.workflow_instance_id > 0 &&
        row.workflow_current_step_id != null &&
        row.workflow_current_step_id > 0 ? (
          <div className="mt-4 border-t border-app-border pt-4">
            <Button variant="secondary" className="min-h-9" type="button" onClick={() => setReassignOpen(true)}>
              Reassign current step
            </Button>
          </div>
        ) : null}

        {row.workflow_instance_id != null && row.workflow_instance_id > 0 && canWorkflowRead ? (
          <div className="mt-6 border-t border-app-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">Instance & history</p>
            <div className="mt-3">
              <WorkflowTimeline instance={wfInstance} loading={wfInstanceLoading} errorMessage={wfInstanceError} />
            </div>
          </div>
        ) : canWorkflowRead ? null : (
          <p className="mt-4 text-xs text-app-subtle">Workflow instance details require the workflow.read capability.</p>
        )}

        {row.workflow_instance_id != null &&
        row.workflow_instance_id > 0 &&
        row.workflow_current_step_id != null &&
        row.workflow_current_step_id > 0 ? (
          <div className="mt-6 border-t border-app-border pt-4">
            <WorkflowActionBox
              instanceId={row.workflow_instance_id}
              stepId={row.workflow_current_step_id}
              workflowStatus={row.workflow_status}
              assignedUserId={row.workflow_current_assigned_user}
              meId={me?.id}
              isSuperuser={!!me?.is_superuser}
              canApprove={canWorkflowApprove}
              canReject={canWorkflowReject}
              onSuccess={() => reloadMrfAndWorkflow()}
            />
          </div>
        ) : null}
      </section>

      <MRFLineItemsTable mrfId={row.id} siteId={row.site} parentMrf={row} siteOptions={siteOptions} />

      <WorkflowConfigCheckDrawer
        open={configDrawerOpen}
        onClose={() => setConfigDrawerOpen(false)}
        loading={configBusy}
        errorMessage={configError}
        data={configData}
      />

      <WorkflowReassignDrawer
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        instanceId={row.workflow_instance_id ?? null}
        stepId={row.workflow_current_step_id ?? null}
        onSuccess={() => reloadMrfAndWorkflow()}
      />

      <Drawer
        open={drawerOpen}
        title="Edit MRF"
        description="Update MRF details."
        onClose={closeDrawer}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closeDrawer} disabled={formSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form={formId} disabled={formSubmitting || !!sitesError}>
              {formSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      >
        <MRFForm
          key={`mrf-edit-${row.id}`}
          formId={formId}
          mode="edit"
          initialMRF={row}
          siteOptions={siteOptions}
          departmentOptions={departmentOptions}
          departmentsLoading={departmentsLoading}
          departmentLookupError={departmentsError}
          lookupError={sitesError}
          canReadBudget={canReadBudget}
          submitting={formSubmitting}
          errorMessage={formError}
          onSubmit={submit}
        />
      </Drawer>
    </div>
  )
}



