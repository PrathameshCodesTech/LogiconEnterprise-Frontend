import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ErrorState } from '@/components/ui/ErrorState'
import type { BudgetPlanRow } from '@/features/budgets/types'
import { budgetNatureLabel, formatBudgetAmount } from '@/features/budgets/types'
import {
  formatBudgetPlanOptionLabel,
  loadBillableBudgetOptionsForSite,
  loadNonBillableBudgetOptionsForDepartments,
} from '@/features/budgets/budgetLookup'
import type { MRFLineItemRow, MRFLineItemWriteInput, MRFRow } from '@/features/mrf/types'
import type { SiteOption } from '@/features/mrf/MRFForm'

export interface Option {
  id: number
  label: string
}

export interface MRFLineItemFormValues {
  job_role: string
  site_role_requirement: string
  headcount: string
  replacement_for_employee: string
  required_skills: string
  wage_category: string
  wage_min_requested: string
  wage_max_requested: string
  billing_rate_snapshot: string
  budget_min: string
  budget_max: string
  budget_plan: string
}

function toNumberOrNull(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return n
}

export function MRFLineItemForm({
  formId,
  initial,
  parentMrf,
  siteOptions,
  canReadBudget = false,
  submitting,
  errorMessage,
  onSubmit,
  jobRoleOptions,
  siteRoleRequirementOptions,
  wageCategoryOptions,
  lookupError,
}: {
  formId: string
  initial?: MRFLineItemRow | null
  parentMrf: MRFRow
  siteOptions: SiteOption[]
  canReadBudget?: boolean
  submitting?: boolean
  errorMessage?: string | null
  onSubmit: (payload: MRFLineItemWriteInput) => void | Promise<void>
  jobRoleOptions: Option[]
  siteRoleRequirementOptions: Option[]
  wageCategoryOptions: Option[]
  lookupError: string | null
}) {
  const [values, setValues] = useState<MRFLineItemFormValues>(() => ({
    job_role: initial?.job_role != null ? String(initial.job_role) : '',
    site_role_requirement: initial?.site_role_requirement != null ? String(initial.site_role_requirement) : '',
    headcount: initial?.headcount != null ? String(initial.headcount) : '1',
    replacement_for_employee: initial?.replacement_for_employee ?? '',
    required_skills: initial?.required_skills?.join(', ') ?? '',
    wage_category: initial?.wage_category != null ? String(initial.wage_category) : '',
    wage_min_requested: initial?.wage_min_requested ?? '',
    wage_max_requested: initial?.wage_max_requested ?? '',
    billing_rate_snapshot: initial?.billing_rate_snapshot ?? '',
    budget_min: initial?.budget_min ?? '',
    budget_max: initial?.budget_max ?? '',
    budget_plan: initial?.budget_plan != null ? String(initial.budget_plan) : '',
  }))

  const parentCtx = `${parentMrf.site}|${parentMrf.billing_type}|${parentMrf.requesting_department ?? ''}|${parentMrf.required_department ?? ''}`
  const prevParentRef = useRef('')
  useEffect(() => {
    if (prevParentRef.current && prevParentRef.current !== parentCtx) {
      setValues((v) => ({ ...v, budget_plan: '' }))
    }
    prevParentRef.current = parentCtx
  }, [parentCtx])

  const selectedSite = useMemo(
    () => siteOptions.find((s) => s.id === Number(parentMrf.site)),
    [siteOptions, parentMrf.site],
  )

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
      const billing = String(parentMrf.billing_type)
      if (billing === 'billable') {
        const sid = Number(parentMrf.site)
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
      if (billing === 'non_billable') {
        const ids: number[] = []
        const req = Number(parentMrf.requesting_department)
        const reqd = Number(parentMrf.required_department)
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
    parentMrf.billing_type,
    parentMrf.site,
    parentMrf.requesting_department,
    parentMrf.required_department,
    selectedSite?.client,
  ])

  const headcountError = useMemo(() => {
    const n = Number(values.headcount)
    if (!Number.isFinite(n) || n < 1) return 'Headcount must be at least 1.'
    return null
  }, [values.headcount])

  const wageRangeError = useMemo(() => {
    const min = toNumberOrNull(values.wage_min_requested)
    const max = toNumberOrNull(values.wage_max_requested)
    if (min != null && max != null && min > max) return 'Wage min cannot exceed wage max.'
    return null
  }, [values.wage_min_requested, values.wage_max_requested])

  const budgetRangeError = useMemo(() => {
    const min = toNumberOrNull(values.budget_min)
    const max = toNumberOrNull(values.budget_max)
    if (min != null && max != null && min > max) return 'Budget min cannot exceed budget max.'
    return null
  }, [values.budget_min, values.budget_max])

  const jobRoleError = useMemo(() => (values.job_role ? null : 'Job role is required.'), [values.job_role])

  const canSubmit = !submitting && !lookupError && !headcountError && !wageRangeError && !budgetRangeError && !jobRoleError

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const payload: MRFLineItemWriteInput = {
      mrf: 0, // injected by parent
      job_role: Number(values.job_role),
      site_role_requirement: values.site_role_requirement ? Number(values.site_role_requirement) : null,
      headcount: Number(values.headcount),
      replacement_for_employee: values.replacement_for_employee.trim() || undefined,
      required_skills: values.required_skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      wage_category: values.wage_category ? Number(values.wage_category) : null,
      wage_min_requested: toNumberOrNull(values.wage_min_requested),
      wage_max_requested: toNumberOrNull(values.wage_max_requested),
      billing_rate_snapshot: toNumberOrNull(values.billing_rate_snapshot),
      budget_min: toNumberOrNull(values.budget_min),
      budget_max: toNumberOrNull(values.budget_max),
    }
    const bpTrim = values.budget_plan.trim()
    if (initial) {
      if (bpTrim) payload.budget_plan = Number(bpTrim)
      else if (initial.budget_plan != null) payload.budget_plan = null
    } else if (bpTrim) {
      payload.budget_plan = Number(bpTrim)
    }
    await onSubmit(payload)
  }

  const mrfHasBudget = parentMrf.budget_plan != null && parentMrf.budget_plan > 0
  const billable = String(parentMrf.billing_type) === 'billable'
  const budgetSelectDisabled =
    submitting ||
    budgetLoading ||
    !!budgetLookupError ||
    (billable && (!Number.isFinite(Number(parentMrf.site)) || selectedSite?.client == null))

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {lookupError ? <ErrorState message={`Lookup failed. Add/Edit is disabled. ${lookupError}`} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id="mrf_li_job_role"
          label="Job role"
          value={values.job_role}
          onChange={(e) => setValues((v) => ({ ...v, job_role: e.target.value }))}
          disabled={submitting || !!lookupError}
          error={jobRoleError ?? undefined}
        >
          <option value="">Select...</option>
          {jobRoleOptions.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.label}
            </option>
          ))}
        </Select>

        <Input
          id="mrf_li_headcount"
          label="Headcount"
          value={values.headcount}
          onChange={(e) => setValues((v) => ({ ...v, headcount: e.target.value }))}
          disabled={submitting}
          inputMode="numeric"
          error={headcountError ?? undefined}
        />
      </div>

      <Select
        id="mrf_li_srr"
        label="Site role requirement"
        value={values.site_role_requirement}
        onChange={(e) => setValues((v) => ({ ...v, site_role_requirement: e.target.value }))}
        disabled={submitting || !!lookupError}
      >
        <option value="">None</option>
        {siteRoleRequirementOptions.map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.label}
          </option>
        ))}
      </Select>

      <Input
        id="mrf_li_replacement_for"
        label="Replacement for employee"
        value={values.replacement_for_employee}
        onChange={(e) => setValues((v) => ({ ...v, replacement_for_employee: e.target.value }))}
        disabled={submitting}
        placeholder="Optional"
      />

      <Input
        id="mrf_li_required_skills"
        label="Required skills"
        value={values.required_skills}
        onChange={(e) => setValues((v) => ({ ...v, required_skills: e.target.value }))}
        disabled={submitting}
        placeholder="Comma-separated, e.g. PPE, supervisor, forklift"
      />

      <Select
        id="mrf_li_wage_category"
        label="Wage category"
        value={values.wage_category}
        onChange={(e) => setValues((v) => ({ ...v, wage_category: e.target.value }))}
        disabled={submitting || !!lookupError}
      >
        <option value="">None</option>
        {wageCategoryOptions.map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.label}
          </option>
        ))}
      </Select>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="mrf_li_wage_min"
          label="Wage min requested"
          value={values.wage_min_requested}
          onChange={(e) => setValues((v) => ({ ...v, wage_min_requested: e.target.value }))}
          disabled={submitting}
          inputMode="decimal"
          error={wageRangeError ?? undefined}
        />
        <Input
          id="mrf_li_wage_max"
          label="Wage max requested"
          value={values.wage_max_requested}
          onChange={(e) => setValues((v) => ({ ...v, wage_max_requested: e.target.value }))}
          disabled={submitting}
          inputMode="decimal"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="mrf_li_billing_rate_snapshot"
          label="Billing rate snapshot"
          value={values.billing_rate_snapshot}
          onChange={(e) => setValues((v) => ({ ...v, billing_rate_snapshot: e.target.value }))}
          disabled={submitting}
          inputMode="decimal"
        />
        <div />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="mrf_li_budget_min"
          label="Budget min"
          value={values.budget_min}
          onChange={(e) => setValues((v) => ({ ...v, budget_min: e.target.value }))}
          disabled={submitting}
          inputMode="decimal"
          error={budgetRangeError ?? undefined}
        />
        <Input
          id="mrf_li_budget_max"
          label="Budget max"
          value={values.budget_max}
          onChange={(e) => setValues((v) => ({ ...v, budget_max: e.target.value }))}
          disabled={submitting}
          inputMode="decimal"
        />
      </div>

      {!canReadBudget && initial?.budget_plan != null && (initial.budget_plan_name || initial.budget_plan_code) ? (
        <div className="rounded-panel border border-app-border bg-app-muted p-3 text-sm text-app-secondary">
          <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">Line budget override</p>
          <p className="mt-1 font-medium text-app-text">
            {initial.budget_plan_name ?? 'Budget'}{' '}
            {initial.budget_plan_code ? (
              <span className="font-mono text-xs">({initial.budget_plan_code})</span>
            ) : null}
          </p>
          {initial.budget_plan_nature ? (
            <p className="mt-1 text-xs">Nature: {budgetNatureLabel(String(initial.budget_plan_nature))}</p>
          ) : null}
          {initial.budget_plan_amount != null ? (
            <p className="mt-1 text-xs">
              {formatBudgetAmount(String(initial.budget_plan_amount), initial.budget_plan_currency ?? 'INR')} —{' '}
              {initial.budget_plan_status ?? '—'}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-app-subtle">Budget selection requires budget.read.</p>
        </div>
      ) : null}

      {canReadBudget ? (
        <>
          {budgetLookupError ? (
            <ErrorState
              message={`Budget lookup failed. ${budgetLookupError} You can still save without a budget override.`}
            />
          ) : null}
          <Select
            id="mrf_li_budget_plan"
            label="Budget plan override (optional)"
            value={values.budget_plan}
            onChange={(e) => setValues((v) => ({ ...v, budget_plan: e.target.value }))}
            disabled={budgetSelectDisabled}
          >
            <option value="">
              {billable && (!Number.isFinite(Number(parentMrf.site)) || selectedSite?.client == null)
                ? 'Site/client unavailable for budget lookup'
                : budgetLoading
                  ? 'Loading budgets…'
                  : 'No override (inherit from MRF if set)'}
            </option>
            {budgetRows.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {formatBudgetPlanOptionLabel(b)}
              </option>
            ))}
          </Select>
          {!values.budget_plan.trim() && mrfHasBudget ? (
            <p className="text-xs text-app-subtle">If left blank, this line item will use the MRF budget.</p>
          ) : null}
        </>
      ) : null}

      <button type="submit" hidden />
    </form>
  )
}
