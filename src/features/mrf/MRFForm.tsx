import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ErrorState } from '@/components/ui/ErrorState'
import type { DepartmentOption } from '@/api/departments'
import { MRFClientFormFields } from '@/features/mrf/MRFClientFormFields'
import {
  clientFieldsFromRow,
  clientFieldsToWritePayload,
  validateMrfClientFields,
  type MRFClientHeaderFormValues,
} from '@/features/mrf/mrfClientForm'
import type { MRFRow, MRFType, BillingType, RequestedByType, MRFStatus, MRFWriteInput } from '@/features/mrf/types'
import type { BudgetPlanRow } from '@/features/budgets/types'
import { budgetNatureLabel, formatBudgetAmount } from '@/features/budgets/types'
import {
  formatBudgetPlanOptionLabel,
  loadBillableBudgetOptionsForSite,
  loadNonBillableBudgetOptionsForDepartments,
} from '@/features/budgets/budgetLookup'

export type { DepartmentOption } from '@/api/departments'

export interface SiteOption {
  id: number
  label: string
  /** Site's client id (for billable budget lookup). */
  client?: number
}

export interface MRFFormValues extends MRFClientHeaderFormValues {
  site: string
  requested_by_type: RequestedByType
  mrf_type: MRFType
  billing_type: BillingType
  requesting_department: string
  required_department: string
  department: string
  required_by_date: string // yyyy-mm-dd or ''
  reason: string
  client_visible: boolean
  status: MRFStatus
  budget_plan: string
}

const MRF_TYPES: { value: MRFType; label: string }[] = [
  { value: 'new_hiring', label: 'New hiring' },
  { value: 'replacement', label: 'Replacement' },
  { value: 'headcount_increase', label: 'Headcount increase' },
  { value: 'rate_revision', label: 'Rate revision' },
]

const BILLING_TYPES: { value: BillingType; label: string }[] = [
  { value: 'billable', label: 'Billable' },
  { value: 'non_billable', label: 'Non-billable' },
]

const REQUESTER_TYPES: { value: RequestedByType; label: string }[] = [
  { value: 'internal', label: 'Internal' },
  { value: 'client', label: 'Client' },
]

// Do not offer terminal statuses (backend blocks direct set).
const STATUS_OPTIONS: { value: MRFStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'hr_review', label: 'HR review' },
  { value: 'finance_review', label: 'Finance review' },
  { value: 'admin_review', label: 'Admin review' },
  { value: 'client_review', label: 'Client review' },
  { value: 'cancelled', label: 'Cancelled' },
]

function isPastDate(yyyyMmDd: string): boolean {
  if (!yyyyMmDd) return false
  const d = new Date(`${yyyyMmDd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

function optionLabel(o: DepartmentOption) {
  return o.scopeLabel ? `${o.label} — ${o.scopeLabel}` : o.label
}

export function MRFForm({
  formId,
  mode,
  initialMRF,
  siteOptions,
  departmentOptions,
  departmentsLoading,
  departmentLookupError,
  lookupError,
  canReadBudget = false,
  submitting,
  errorMessage,
  onSubmit,
}: {
  formId: string
  mode: 'create' | 'edit'
  initialMRF?: MRFRow | null
  siteOptions: SiteOption[]
  departmentOptions: DepartmentOption[]
  departmentsLoading?: boolean
  departmentLookupError?: string | null
  lookupError: string | null
  canReadBudget?: boolean
  submitting?: boolean
  errorMessage?: string | null
  onSubmit: (values: MRFFormValues) => void | Promise<void>
}) {
  const [values, setValues] = useState<MRFFormValues>(() => ({
    site: initialMRF?.site != null ? String(initialMRF.site) : '',
    requested_by_type: (initialMRF?.requested_by_type ?? 'internal') as RequestedByType,
    mrf_type: (initialMRF?.mrf_type ?? 'new_hiring') as MRFType,
    billing_type: (initialMRF?.billing_type ?? 'billable') as BillingType,
    requesting_department:
      initialMRF?.requesting_department != null && initialMRF.requesting_department !== undefined
        ? String(initialMRF.requesting_department)
        : '',
    required_department:
      initialMRF?.required_department != null && initialMRF.required_department !== undefined
        ? String(initialMRF.required_department)
        : '',
    department: initialMRF?.department ?? '',
    required_by_date: initialMRF?.required_by_date ?? '',
    reason: initialMRF?.reason ?? '',
    client_visible: initialMRF?.client_visible ?? false,
    status: (initialMRF?.status ?? 'draft') as MRFStatus,
    budget_plan: initialMRF?.budget_plan != null ? String(initialMRF.budget_plan) : '',
    ...clientFieldsFromRow(initialMRF),
  }))

  const siteError = useMemo(() => (values.site ? null : 'Site is required.'), [values.site])
  const requiredByError = useMemo(() => {
    if (!values.required_by_date) return null
    return isPastDate(values.required_by_date) ? 'Required by date cannot be in the past.' : null
  }, [values.required_by_date])

  const isBillable = values.billing_type === 'billable'
  const isNonBillable = values.billing_type === 'non_billable'
  const clientFieldsError = useMemo(
    () => (isNonBillable ? validateMrfClientFields(values) : null),
    [values, isNonBillable],
  )
  const budgetHelperCopy = isBillable
    ? 'Billable budgets are tied to client/site/department manpower.'
    : 'Non-billable budgets are tied to internal department hiring.'

  const contextSig = `${values.site}|${values.billing_type}|${values.requesting_department}|${values.required_department}`
  const prevSigRef = useRef('')
  useEffect(() => {
    if (prevSigRef.current && prevSigRef.current !== contextSig) {
      setValues((v) => ({ ...v, budget_plan: '' }))
    }
    prevSigRef.current = contextSig
  }, [contextSig])

  const selectedSite = useMemo(
    () => siteOptions.find((s) => s.id === Number(values.site)),
    [siteOptions, values.site],
  )
  const departmentOptionsForSelectedSite = useMemo(() => {
    const siteId = Number(values.site)
    if (!Number.isFinite(siteId) || siteId <= 0) return []
    const clientId = selectedSite?.client
    return departmentOptions.filter((dept) => {
      if (dept.site != null) return Number(dept.site) === siteId
      if (dept.client != null && clientId != null) return Number(dept.client) === Number(clientId)
      return dept.client == null && dept.site == null
    })
  }, [departmentOptions, selectedSite?.client, values.site])

  useEffect(() => {
    const allowed = new Set(departmentOptionsForSelectedSite.map((d) => String(d.id)))
    setValues((v) => {
      const requestingInvalid = v.requesting_department && !allowed.has(v.requesting_department)
      const requiredInvalid = v.required_department && !allowed.has(v.required_department)
      if (!requestingInvalid && !requiredInvalid) return v
      return {
        ...v,
        requesting_department: requestingInvalid ? '' : v.requesting_department,
        required_department: requiredInvalid ? '' : v.required_department,
      }
    })
  }, [departmentOptionsForSelectedSite])

  const [budgetRows, setBudgetRows] = useState<BudgetPlanRow[]>([])
  const [budgetLoading, setBudgetLoading] = useState(false)
  const [budgetLookupError, setBudgetLookupError] = useState<string | null>(null)

  useEffect(() => {
    if (!canReadBudget) {
      setBudgetRows([])
      setBudgetLookupError(null)
      setBudgetLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setBudgetLoading(true)
      setBudgetLookupError(null)
      setBudgetRows([])
      if (values.billing_type === 'billable') {
        const sid = Number(values.site)
        const cid = selectedSite?.client
        if (!Number.isFinite(sid) || cid == null || !Number.isFinite(cid)) {
          if (!cancelled) setBudgetLoading(false)
          return
        }
        const res = await loadBillableBudgetOptionsForSite(sid, cid)
        if (cancelled) return
        if (res.ok) setBudgetRows(res.items)
        else {
          setBudgetRows([])
          setBudgetLookupError(res.error)
        }
        setBudgetLoading(false)
        return
      }
      if (values.billing_type === 'non_billable') {
        const ids: number[] = []
        const req = Number(values.requesting_department)
        const reqd = Number(values.required_department)
        if (Number.isFinite(req) && req > 0) ids.push(req)
        if (Number.isFinite(reqd) && reqd > 0) ids.push(reqd)
        const res = await loadNonBillableBudgetOptionsForDepartments(ids)
        if (cancelled) return
        if (res.ok) {
          const allowed = new Set(ids)
          setBudgetRows(
            res.items.filter((b) => b.department == null || allowed.has(Number(b.department))),
          )
        } else {
          setBudgetRows([])
          setBudgetLookupError(res.error)
        }
        setBudgetLoading(false)
        return
      }
      if (!cancelled) setBudgetLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [
    canReadBudget,
    values.billing_type,
    values.site,
    values.requesting_department,
    values.required_department,
    selectedSite?.client,
  ])

  const deptSelectDisabled = !!(submitting || departmentLookupError)
  const canSubmit = !submitting && !siteError && !requiredByError && !clientFieldsError && !lookupError

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    await onSubmit(values)
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {lookupError ? <ErrorState message={`Site lookup failed. Create/Edit is disabled. ${lookupError}`} /> : null}
      {departmentLookupError ? (
        <ErrorState message={`Department lookup failed. Department selects are disabled. ${departmentLookupError}`} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id="mrf_billing_type"
          label="Billing type"
          value={values.billing_type}
          onChange={(e) => setValues((v) => ({ ...v, billing_type: e.target.value as BillingType }))}
          disabled={submitting}
        >
          {BILLING_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          id="mrf_type"
          label="MRF type"
          value={values.mrf_type}
          onChange={(e) => setValues((v) => ({ ...v, mrf_type: e.target.value as MRFType }))}
          disabled={submitting}
        >
          {MRF_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-sm font-semibold text-app-text">
        {isBillable ? 'Client manpower request' : 'Internal hiring request'}
      </p>

      <div className="space-y-1">
        <Select
          id="mrf_site"
          label="Site"
          value={values.site}
          onChange={(e) => setValues((v) => ({ ...v, site: e.target.value }))}
          disabled={submitting || !!lookupError}
          error={siteError ?? undefined}
        >
          <option value="">Select a site...</option>
          {siteOptions.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.label}
            </option>
          ))}
        </Select>
        {isNonBillable ? (
          <p className="text-xs text-app-subtle">Site/cost center associated with the internal request.</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <Select
          id="mrf_requesting_department"
          label="Requesting department"
          value={values.requesting_department}
          onChange={(e) => setValues((v) => ({ ...v, requesting_department: e.target.value }))}
          disabled={deptSelectDisabled}
        >
          <option value="">None (backend uses your user department on create)</option>
          {departmentOptionsForSelectedSite.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {optionLabel(o)}
            </option>
          ))}
        </Select>
        <p className="text-xs text-app-subtle">
          Optional. If blank, backend uses your user department when creating.
        </p>
        {departmentsLoading ? <p className="text-xs text-app-subtle">Loading departments…</p> : null}
      </div>

      <div className="space-y-1">
        <Select
          id="mrf_required_department"
          label="Required department"
          value={values.required_department}
          onChange={(e) => setValues((v) => ({ ...v, required_department: e.target.value }))}
          disabled={deptSelectDisabled}
        >
          <option value="">None</option>
          {departmentOptionsForSelectedSite.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {optionLabel(o)}
            </option>
          ))}
        </Select>
        <p className="text-xs text-app-subtle">
          Department or service where manpower is needed (e.g. Housekeeping). Strongly recommended when applicable.
        </p>
      </div>

      <Select
        id="mrf_requested_by_type"
        label="Requested by type"
        value={values.requested_by_type}
        onChange={(e) => setValues((v) => ({ ...v, requested_by_type: e.target.value as RequestedByType }))}
        disabled={submitting}
      >
        {REQUESTER_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </Select>

      {!canReadBudget && initialMRF?.budget_plan != null && (initialMRF.budget_plan_name || initialMRF.budget_plan_code) ? (
        <div className="rounded-panel border border-app-border bg-app-muted p-3 text-sm text-app-secondary">
          <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">Linked budget</p>
          <p className="mt-1 font-medium text-app-text">
            {initialMRF.budget_plan_name ?? 'Budget'}{' '}
            {initialMRF.budget_plan_code ? (
              <span className="font-mono text-xs">({initialMRF.budget_plan_code})</span>
            ) : null}
          </p>
          {initialMRF.budget_plan_nature ? (
            <p className="mt-1 text-xs">Nature: {budgetNatureLabel(String(initialMRF.budget_plan_nature))}</p>
          ) : null}
          {initialMRF.budget_plan_amount != null ? (
            <p className="mt-1 text-xs">
              {formatBudgetAmount(String(initialMRF.budget_plan_amount), initialMRF.budget_plan_currency ?? 'INR')} —{' '}
              {initialMRF.budget_plan_status ?? '—'}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-app-subtle">Budget selection requires budget.read.</p>
        </div>
      ) : null}

      {canReadBudget ? (
        <>
          {budgetLookupError ? (
            <ErrorState
              message={`Budget lookup failed. ${budgetLookupError} You can still save without a budget plan.`}
            />
          ) : null}
          <Select
            id="mrf_budget_plan"
            label={isBillable ? 'Budget plan' : 'Non-billable budget plan'}
            value={values.budget_plan}
            onChange={(e) => setValues((v) => ({ ...v, budget_plan: e.target.value }))}
            disabled={
              submitting ||
              budgetLoading ||
              !!budgetLookupError ||
              (isBillable &&
                (!values.site.trim() || selectedSite?.client == null || !Number.isFinite(Number(selectedSite.client))))
            }
          >
            <option value="">
              {values.billing_type === 'billable' && (!values.site.trim() || selectedSite?.client == null)
                ? 'Select a site first'
                : budgetLoading
                  ? 'Loading budgets…'
                  : 'No budget selected'}
            </option>
            {budgetRows.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {formatBudgetPlanOptionLabel(b)}
              </option>
            ))}
          </Select>
          <p className="text-xs text-app-subtle">{budgetHelperCopy}</p>
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="mrf_required_by_date"
          label="Required by date"
          type="date"
          value={values.required_by_date}
          onChange={(e) => setValues((v) => ({ ...v, required_by_date: e.target.value }))}
          disabled={submitting}
          error={requiredByError ?? undefined}
        />
        <Select
          id="mrf_status"
          label="Status"
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as MRFStatus }))}
          disabled={submitting}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <MRFClientFormFields
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        onSupportChange={(patch) => setValues((v) => ({ ...v, support: { ...v.support, ...patch } }))}
        submitting={submitting}
        clientError={clientFieldsError}
        billingType={values.billing_type}
      />

      <div className="space-y-1">
        <label htmlFor="mrf_reason" className="text-sm font-medium text-app-secondary">
          Reason / remarks
        </label>
        <textarea
          id="mrf_reason"
          value={values.reason}
          onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))}
          className="min-h-24 w-full rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-panel placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          disabled={submitting}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-app-secondary">
        <input
          type="checkbox"
          checked={values.client_visible}
          onChange={(e) => setValues((v) => ({ ...v, client_visible: e.target.checked }))}
          disabled={submitting}
        />
        Client visible
      </label>

      <button type="submit" hidden />
      {mode === 'edit' ? (
        <p className="text-xs text-app-subtle">
          Note: Approval statuses (Approved/Rejected) are handled by workflow endpoints and are not part of this phase.
        </p>
      ) : null}
    </form>
  )
}

export function mrfFormValuesToWritePayload(values: MRFFormValues, mode: 'create' | 'edit' = 'edit'): MRFWriteInput {
  const bp = values.budget_plan.trim()
  return {
    site: Number(values.site),
    requested_by_type: values.requested_by_type,
    mrf_type: values.mrf_type,
    billing_type: values.billing_type,
    requesting_department: values.requesting_department.trim() ? Number(values.requesting_department) : null,
    required_department: values.required_department.trim() ? Number(values.required_department) : null,
    department: values.department.trim() || undefined,
    required_by_date: values.required_by_date || null,
    reason: values.reason,
    client_visible: values.client_visible,
    status: values.status,
    budget_plan: bp ? Number(bp) : null,
    ...clientFieldsToWritePayload(values, mode),
  }
}
