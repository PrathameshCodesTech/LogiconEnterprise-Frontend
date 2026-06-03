import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ClipboardCheck, Info, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import {
  assignSiteSurveyOwner,
  createSiteSurveyEquipmentLine,
  createSiteSurveyIssueLine,
  createSiteSurveyLocationLine,
  createSiteSurveyShiftDeployment,
  generateRoleRequirementsFromSurvey,
  getSiteSurveyStructured,
  listSurveyRoleMappings,
  markSiteSurveyCompleted,
  markSiteSurveyStarted,
  seedSiteSurveyDefaultLines,
  updateSiteSurveyEquipmentLine,
  updateSiteSurveyIssueLine,
  updateSiteSurveyLocationLine,
  updateSiteSurveyScopeAnswer,
  updateSiteSurveyShiftDeployment,
} from '@/api/sales'
import { listUsers, type UserRow } from '@/api/users'
import { ROUTES } from '@/app/routes'
import { useAuthStore } from '@/features/auth/authStore'
import { surveyStatusLabel, surveyStatusVariant, formatShortDate } from '@/features/sales/salesUtils'
import { CAP, hasAnyCapability } from '@/lib/capabilities'
import { parseApiError } from '@/lib/apiError'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type {
  GenerateRoleRequirementsResult,
  SiteSurveyEquipmentLine,
  SiteSurveyIssueLine,
  SiteSurveyLocationLine,
  SiteSurveyScopeAnswer,
  SiteSurveyShiftDeployment,
  SiteSurveyStructuredResponse,
  SurveyRoleMapping,
} from '@/types/sales'

// ─── Constants ────────────────────────────────────────────────────────────────

type TabId = 'scope' | 'deployment' | 'locations' | 'equipment' | 'issues' | 'review'

const TABS: { id: TabId; label: string; icon: typeof ClipboardCheck }[] = [
  { id: 'scope', label: 'Scope', icon: ClipboardCheck },
  { id: 'deployment', label: 'Deployment', icon: ClipboardCheck },
  { id: 'locations', label: 'Locations', icon: ClipboardCheck },
  { id: 'equipment', label: 'Equipment', icon: ClipboardCheck },
  { id: 'issues', label: 'Issues', icon: ClipboardCheck },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
]

const SCOPE_CATEGORY_LABELS: Record<string, string> = {
  client_scope_site: 'Client Scope / Site Details',
  premises: 'Premises Details',
  hk_info: 'Housekeeping Information',
  technical_scope: 'Technical Scope',
  existing_deployment: 'Existing Deployment Structure',
}

// Template rows that don't need role mappings
const SURVEY_ROLE_MAPPING_IGNORE = new Set([
  'site management team',
  'technical(8 hrs x 6 days)',
  'machinery',
  'hk consumables',
  'housekeeping consumables',
  'sub total',
  'subtotal',
  'total',
  'grand total',
])

function isRoleMappingIgnored(description?: string): boolean {
  if (!description) return false
  return SURVEY_ROLE_MAPPING_IGNORE.has(description.toLowerCase().trim())
}

type RowSaveState = { saving: boolean; error: string | null; success?: boolean }

// ─── Utility Components ───────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: RowSaveState | undefined }) {
  if (!state) return null
  if (state.saving) return <span className="text-xs text-brand-600 animate-pulse">Saving...</span>
  if (state.error) return <span className="text-xs text-status-danger" title={state.error}>Error</span>
  if (state.success) return <span className="text-xs text-status-success">Saved</span>
  return null
}

function ApplicableToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
        value
          ? 'bg-status-success/10 text-status-success hover:bg-status-success/20'
          : 'bg-app-muted text-app-subtle hover:bg-app-border'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={value ? 'Applicable' : 'Not applicable'}
    >
      {value ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
      {value ? 'Yes' : 'N/A'}
    </button>
  )
}

function SectionCard({
  title,
  description,
  children,
  className = '',
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-panel border border-app-border bg-app-surface shadow-panel ${className}`}>
      <div className="border-b border-app-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-app-text">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-app-secondary">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  onBlur,
  multiline,
  placeholder,
  disabled,
  className = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  multiline?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const baseClass =
    'w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-subtle transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-app-muted disabled:cursor-not-allowed'

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-sm font-medium text-app-secondary">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={baseClass + ' resize-none'}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={baseClass}
        />
      )}
    </div>
  )
}

// Format number with Indian comma separators (1,00,000)
function formatIndianNumber(num: number | null | undefined): string {
  if (num == null) return ''
  const str = num.toString()
  const parts = str.split('.')
  let intPart = parts[0] ?? ''
  const decPart = parts[1]

  // Indian format: last 3 digits, then groups of 2
  if (intPart.length > 3) {
    const lastThree = intPart.slice(-3)
    const rest = intPart.slice(0, -3)
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    intPart = formatted + ',' + lastThree
  }

  return decPart ? `${intPart}.${decPart}` : intPart
}

function NumberInput({
  value,
  onChange,
  onBlur,
  disabled,
  min,
  className = '',
}: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  onBlur?: (v: number | null) => void
  disabled?: boolean
  min?: number
  className?: string
}) {
  const [isFocused, setIsFocused] = useState(false)
  const [localValue, setLocalValue] = useState(value?.toString() ?? '')

  // Sync localValue when value changes externally
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value?.toString() ?? '')
    }
  }, [value, isFocused])

  const displayValue = isFocused ? localValue : formatIndianNumber(value)
  const formattedForTitle = formatIndianNumber(value)

  return (
    <input
      type={isFocused ? 'number' : 'text'}
      min={min}
      value={displayValue}
      title={formattedForTitle || undefined}
      onChange={(e) => {
        const raw = e.target.value
        setLocalValue(raw)
        onChange(raw === '' ? null : Number(raw))
      }}
      onFocus={() => {
        setIsFocused(true)
        setLocalValue(value?.toString() ?? '')
      }}
      onBlur={(e) => {
        setIsFocused(false)
        const parsed = e.target.value === '' ? null : Number(e.target.value)
        onBlur?.(parsed)
      }}
      disabled={disabled}
      className={`min-w-[80px] w-full rounded-panel border border-app-border bg-app-surface px-2 py-1.5 text-sm text-center text-app-text placeholder:text-app-subtle transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:min-w-[100px] disabled:bg-app-muted disabled:cursor-not-allowed ${className}`}
    />
  )
}

function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border-2 border-dashed border-app-border px-4 py-3 text-sm font-medium text-app-secondary transition-colors hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50/50"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  )
}

function ProgressRing({ percent, size = 40 }: { percent: number; size?: number }) {
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          className="text-app-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={percent === 100 ? 'text-status-success' : 'text-brand-600'}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {percent === 100 ? (
          <Check className="h-4 w-4 text-status-success" />
        ) : (
          <span className="text-xs font-semibold text-app-text">{Math.round(percent)}%</span>
        )}
      </div>
    </div>
  )
}

function roleGenerationReasonLabel(reason: string, description: string): string {
  switch (reason) {
    case 'role_mapping_not_found':
      return `No role mapping configured for "${description}"`
    case 'job_role_not_found':
      return `No job role found for "${description}"`
    case 'zero_headcount':
      return `"${description}" has zero headcount`
    case 'not_applicable':
      return `"${description}" was marked not applicable`
    case 'ignored_template_row':
      return `"${description}" is a template row`
    case 'already_exists':
      return `"${description}" already has a role requirement`
    case 'empty_description':
      return 'A row has no description'
    default:
      return `"${description}" could not be processed (${reason})`
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SiteSurveyWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const surveyId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()
  const meCaps = useAuthStore((s) => s.me?.capabilities ?? [])
  const canUpdate = hasAnyCapability(meCaps, [CAP.SALES_SURVEY_UPDATE])

  // ─── State ────────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [data, setData] = useState<SiteSurveyStructuredResponse | null>(null)
  const [tab, setTab] = useState<TabId>('scope')

  const [scopeAnswers, setScopeAnswers] = useState<SiteSurveyScopeAnswer[]>([])
  const [shiftDeployments, setShiftDeployments] = useState<SiteSurveyShiftDeployment[]>([])
  const [locationLines, setLocationLines] = useState<SiteSurveyLocationLine[]>([])
  const [equipmentLines, setEquipmentLines] = useState<SiteSurveyEquipmentLine[]>([])
  const [issueLines, setIssueLines] = useState<SiteSurveyIssueLine[]>([])

  const [saveStates, setSaveStates] = useState<Record<string, RowSaveState>>({})
  const [actionBusy, setActionBusy] = useState<'started' | 'completed' | 'generate' | 'assign' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignUsers, setAssignUsers] = useState<UserRow[]>([])
  const [assignUsersLoading, setAssignUsersLoading] = useState(false)
  const [generateResult, setGenerateResult] = useState<GenerateRoleRequirementsResult | null>(null)
  const [roleMappings, setRoleMappings] = useState<SurveyRoleMapping[]>([])

  const [addDeploymentOpen, setAddDeploymentOpen] = useState(false)
  const [addLocationOpen, setAddLocationOpen] = useState(false)
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false)
  const [addIssueOpen, setAddIssueOpen] = useState(false)

  const seededRef = useRef(false)

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function applyData(res: SiteSurveyStructuredResponse) {
    setData(res)
    setScopeAnswers([...res.scope_answers].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    setShiftDeployments([...res.shift_deployments].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    setLocationLines([...res.location_lines].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    setEquipmentLines([...res.equipment_lines].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    setIssueLines([...res.issue_lines].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    setSaveStates({})
  }

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getSiteSurveyStructured(surveyId)

      // Auto-seed if rows are empty (only once)
      const hasRows = res.scope_answers.length > 0 || res.shift_deployments.length > 0
      if (!hasRows && !seededRef.current) {
        seededRef.current = true
        setPreparing(true)
        try {
          const seeded = await seedSiteSurveyDefaultLines(surveyId)
          applyData(seeded)
        } catch {
          // If seeding fails, just use what we have
          applyData(res)
        } finally {
          setPreparing(false)
        }
      } else {
        applyData(res)
      }
    } catch (e: unknown) {
      setLoadError(parseApiError(e, 'Failed to load site survey').message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId])

  useEffect(() => {
    if (!canUpdate) return
    setAssignUsersLoading(true)
    listUsers({ user_type: 'internal', is_active: true, page: 1 })
      .then((res) => setAssignUsers(res.items))
      .catch(() => setAssignUsers([]))
      .finally(() => setAssignUsersLoading(false))
  }, [canUpdate])

  // Load active role mappings once survey loads
  useEffect(() => {
    listSurveyRoleMappings({ is_active: true })
      .then((res) => setRoleMappings(res.items))
      .catch(() => setRoleMappings([]))
  }, [])

  // Helper to find mapping for a deployment row
  function findMappingForRow(description?: string): SurveyRoleMapping | null {
    if (!description) return null
    const normalized = description.toLowerCase().trim()
    return roleMappings.find((m) => m.description_text.toLowerCase().trim() === normalized) ?? null
  }

  // Build mapping tooltip for display
  function getMappingTooltip(mapping: SurveyRoleMapping): string {
    const parts: string[] = []
    if (mapping.job_role_name) parts.push(mapping.job_role_name)
    if (mapping.wage_category_name) parts.push(mapping.wage_category_name)
    if (mapping.service_category) parts.push(mapping.service_category)
    if (mapping.shift_hours) parts.push(`${mapping.shift_hours}h`)
    if (mapping.working_days) parts.push(`${mapping.working_days}d`)
    return parts.join(' · ')
  }

  function setSaving(key: string, saving: boolean, error: string | null = null, success = false) {
    setSaveStates((prev) => ({ ...prev, [key]: { saving, error, success } }))
    if (success) {
      setTimeout(() => {
        setSaveStates((prev) => {
          const current = prev[key]
          if (current?.success) return { ...prev, [key]: { saving: false, error: null, success: false } }
          return prev
        })
      }, 2000)
    }
  }

  // Smart back navigation
  function handleBack() {
    const path = location.pathname
    if (path.startsWith('/sales/operations-surveys')) {
      navigate('/sales/operations-surveys')
    } else if (data?.survey.lead) {
      navigate(ROUTES.SALES_LEAD_DETAIL(data.survey.lead))
    } else {
      navigate('/sales/leads')
    }
  }

  // ─── Save Handlers ────────────────────────────────────────────────────────────

  async function saveScopeAnswer(answerId: number, answer: string | null) {
    const key = `scope-${answerId}`
    setSaving(key, true)
    try {
      const updated = await updateSiteSurveyScopeAnswer(answerId, { value_text: answer })
      setScopeAnswers((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      setSaving(key, false, null, true)
    } catch (e: unknown) {
      setSaving(key, false, parseApiError(e, 'Save failed').message)
    }
  }

  async function saveDeploymentField(rowId: number, payload: Partial<SiteSurveyShiftDeployment>) {
    const key = `dep-${rowId}`
    setSaving(key, true)
    try {
      const updated = await updateSiteSurveyShiftDeployment(rowId, payload)
      setShiftDeployments((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setSaving(key, false, null, true)
    } catch (e: unknown) {
      setSaving(key, false, parseApiError(e, 'Save failed').message)
    }
  }

  async function saveLocationField(rowId: number, payload: Partial<SiteSurveyLocationLine>) {
    const key = `loc-${rowId}`
    setSaving(key, true)
    try {
      const updated = await updateSiteSurveyLocationLine(rowId, payload)
      setLocationLines((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setSaving(key, false, null, true)
    } catch (e: unknown) {
      setSaving(key, false, parseApiError(e, 'Save failed').message)
    }
  }

  async function saveEquipmentField(rowId: number, payload: Partial<SiteSurveyEquipmentLine>) {
    const key = `eq-${rowId}`
    setSaving(key, true)
    try {
      const updated = await updateSiteSurveyEquipmentLine(rowId, payload)
      setEquipmentLines((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setSaving(key, false, null, true)
    } catch (e: unknown) {
      setSaving(key, false, parseApiError(e, 'Save failed').message)
    }
  }

  async function saveIssueField(rowId: number, payload: Partial<SiteSurveyIssueLine>) {
    const key = `iss-${rowId}`
    setSaving(key, true)
    try {
      const updated = await updateSiteSurveyIssueLine(rowId, payload)
      setIssueLines((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setSaving(key, false, null, true)
    } catch (e: unknown) {
      setSaving(key, false, parseApiError(e, 'Save failed').message)
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async function handleMarkStarted() {
    setActionBusy('started')
    setActionError(null)
    try {
      const updated = await markSiteSurveyStarted(surveyId)
      setData((prev) => (prev ? { ...prev, survey: updated } : prev))
    } catch (e: unknown) {
      setActionError(parseApiError(e, 'Action failed').message)
    } finally {
      setActionBusy(null)
    }
  }

  async function handleMarkCompleted() {
    setActionBusy('completed')
    setActionError(null)
    try {
      const updated = await markSiteSurveyCompleted(surveyId)
      setData((prev) => (prev ? { ...prev, survey: updated } : prev))
    } catch (e: unknown) {
      setActionError(parseApiError(e, 'Action failed').message)
    } finally {
      setActionBusy(null)
    }
  }

  async function handleAssignOwner() {
    const userId = Number(assignUserId)
    if (!userId) { setActionError('Select a user.'); return }
    setActionBusy('assign')
    setActionError(null)
    try {
      const updated = await assignSiteSurveyOwner(surveyId, { assigned_to: userId })
      setData((prev) => (prev ? { ...prev, survey: updated } : prev))
      setAssignUserId('')
    } catch (e: unknown) {
      setActionError(parseApiError(e, 'Assign failed').message)
    } finally {
      setActionBusy(null)
    }
  }

  async function handleGenerateRoles() {
    setActionBusy('generate')
    setActionError(null)
    setGenerateResult(null)
    try {
      const result = await generateRoleRequirementsFromSurvey(surveyId)
      setGenerateResult(result)
    } catch (e: unknown) {
      setActionError(parseApiError(e, 'Generation failed').message)
    } finally {
      setActionBusy(null)
    }
  }

  // ─── Add Row Handlers ─────────────────────────────────────────────────────────

  async function handleAddDeployment(description: string) {
    try {
      const created = await createSiteSurveyShiftDeployment({
        survey: surveyId,
        description,
        line_type: 'item',
        is_applicable: true,
        sort_order: shiftDeployments.length + 1,
      })
      setShiftDeployments((prev) => [...prev, created])
      setAddDeploymentOpen(false)
    } catch (e: unknown) {
      setActionError(parseApiError(e, 'Failed to add row').message)
    }
  }

  async function handleAddLocation(locationName: string) {
    try {
      const created = await createSiteSurveyLocationLine({
        survey: surveyId,
        location_name: locationName,
        row_type: 'item',
        is_applicable: true,
        sort_order: locationLines.length + 1,
      })
      setLocationLines((prev) => [...prev, created])
      setAddLocationOpen(false)
    } catch (e: unknown) {
      setActionError(parseApiError(e, 'Failed to add row').message)
    }
  }

  async function handleAddEquipment(description: string, category: 'major' | 'minor') {
    try {
      const created = await createSiteSurveyEquipmentLine({
        survey: surveyId,
        description,
        equipment_category: category,
        line_type: 'item',
        is_applicable: true,
        sort_order: equipmentLines.length + 1,
      })
      setEquipmentLines((prev) => [...prev, created])
      setAddEquipmentOpen(false)
    } catch (e: unknown) {
      setActionError(parseApiError(e, 'Failed to add row').message)
    }
  }

  async function handleAddIssue(issue: string) {
    try {
      const created = await createSiteSurveyIssueLine({
        survey: surveyId,
        issue,
        row_type: 'item',
        is_applicable: true,
        sort_order: issueLines.length + 1,
      })
      setIssueLines((prev) => [...prev, created])
      setAddIssueOpen(false)
    } catch (e: unknown) {
      setActionError(parseApiError(e, 'Failed to add row').message)
    }
  }

  // ─── Completeness Calculations ────────────────────────────────────────────────

  const scopeFilledCount = scopeAnswers.filter((a) => a.value_text?.trim()).length
  const scopeTotal = scopeAnswers.length
  const scopePercent = scopeTotal > 0 ? (scopeFilledCount / scopeTotal) * 100 : 0

  const applicableDeployments = shiftDeployments.filter((r) => r.is_applicable !== false && r.line_type !== 'header' && r.line_type !== 'total' && r.line_type !== 'subtotal')
  const deploymentFilledCount = applicableDeployments.filter((r) => r.total_count != null && r.total_count > 0).length
  const deploymentPercent = applicableDeployments.length > 0 ? (deploymentFilledCount / applicableDeployments.length) * 100 : 100

  const applicableLocations = locationLines.filter((r) => r.is_applicable !== false && r.row_type !== 'total' && r.row_type !== 'subtotal')
  const locationFilledCount = applicableLocations.filter((r) => r.proposed_count != null).length
  const locationPercent = applicableLocations.length > 0 ? (locationFilledCount / applicableLocations.length) * 100 : 100

  const applicableEquipment = equipmentLines.filter((r) => r.is_applicable !== false && r.line_type !== 'header' && r.line_type !== 'aggregate')
  const equipmentFilledCount = applicableEquipment.filter((r) => r.unit_count != null).length
  const equipmentPercent = applicableEquipment.length > 0 ? (equipmentFilledCount / applicableEquipment.length) * 100 : 100

  const applicableIssues = issueLines.filter((r) => r.is_applicable !== false)
  const issueFilledCount = applicableIssues.filter((r) => r.improvement_details?.trim()).length
  const issuePercent = applicableIssues.length > 0 ? (issueFilledCount / applicableIssues.length) * 100 : 100

  // ─── Role Mapping Calculations ───────────────────────────────────────────────

  const mappableDeployments = applicableDeployments.filter((r) => !isRoleMappingIgnored(r.description))
  const mappedDeployments = mappableDeployments.filter((r) => findMappingForRow(r.description) !== null)
  const missingMappings = mappableDeployments.filter((r) => findMappingForRow(r.description) === null)
  const ignoredDeployments = applicableDeployments.filter((r) => isRoleMappingIgnored(r.description))

  // ─── Tab Content ──────────────────────────────────────────────────────────────

  function groupByCategory(answers: SiteSurveyScopeAnswer[]): [string, SiteSurveyScopeAnswer[]][] {
    const map = new Map<string, SiteSurveyScopeAnswer[]>()
    for (const a of answers) {
      const cat = a.category ?? 'general'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(a)
    }
    return [...map.entries()]
  }

  const scopeTab = (
    <div className="space-y-4">
      {scopeAnswers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-app-muted p-3 mb-3">
            <ClipboardCheck className="h-6 w-6 text-app-subtle" />
          </div>
          <p className="text-sm text-app-secondary">Loading survey questions...</p>
        </div>
      ) : (
        groupByCategory(scopeAnswers).map(([cat, answers]) => (
          <SectionCard
            key={cat}
            title={SCOPE_CATEGORY_LABELS[cat] ?? cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {answers.map((a) => {
                const isLong = (a.field_label?.length ?? 0) > 30 || a.field_key.includes('address') || a.field_key.includes('details') || a.field_key.includes('scope') || a.field_key.includes('others')
                return (
                  <div key={a.id} className={isLong ? 'sm:col-span-2 lg:col-span-3' : ''}>
                    <div className="flex items-start justify-between gap-2">
                      <FormField
                        label={a.field_label ?? a.field_key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        value={a.value_text ?? ''}
                        onChange={(val) => {
                          setScopeAnswers((prev) =>
                            prev.map((x) => (x.id === a.id ? { ...x, value_text: val } : x)),
                          )
                        }}
                        onBlur={() => void saveScopeAnswer(a.id, scopeAnswers.find((x) => x.id === a.id)?.value_text ?? null)}
                        multiline={isLong}
                        disabled={!canUpdate}
                        className="flex-1"
                      />
                      <div className="pt-6">
                        <SaveIndicator state={saveStates[`scope-${a.id}`]} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        ))
      )}
    </div>
  )

  const deploymentTab = (
    <div className="space-y-3">
      <SectionCard title="Manpower Deployment" description="Enter headcount for each role by shift">
        {shiftDeployments.length === 0 ? (
          <p className="text-sm text-app-secondary py-6 text-center">No deployment rows configured.</p>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-app-border bg-app-muted/30">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-app-subtle uppercase tracking-wider w-16"></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-app-subtle uppercase tracking-wider">Role / Description</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-24">General</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-24">Shift 1</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-24">Shift 2</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-24">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-app-subtle uppercase tracking-wider w-36">Remarks</th>
                  <th className="px-3 py-2 w-14"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {shiftDeployments.map((row) => {
                  const key = `dep-${row.id}`
                  const isHeader = row.line_type === 'header'
                  const isAgg = row.line_type === 'total' || row.line_type === 'subtotal'
                  const applicable = row.is_applicable !== false
                  const editable = canUpdate && !isHeader && !isAgg

                  if (isHeader) {
                    return (
                      <tr key={row.id} className="bg-brand-50/50">
                        <td colSpan={8} className="px-3 py-2">
                          <span className="text-sm font-semibold text-brand-700">{row.description}</span>
                        </td>
                      </tr>
                    )
                  }

                  if (isAgg) {
                    return (
                      <tr key={row.id} className="bg-app-muted/50 font-medium">
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 text-sm text-app-text">{row.description}</td>
                        <td className="px-3 py-2 text-center text-sm">{row.general_count ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-sm">{row.first_shift_count ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-sm">{row.second_shift_count ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-sm font-semibold">{row.total_count ?? '—'}</td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    )
                  }

                  // Determine mapping status for this row
                  const isIgnored = isRoleMappingIgnored(row.description)
                  const mapping = !isIgnored ? findMappingForRow(row.description) : null

                  return (
                    <tr key={row.id} className={`${!applicable ? 'bg-app-muted/30 opacity-60' : 'hover:bg-app-muted/20'} transition-colors`}>
                      <td className="px-3 py-2">
                        {editable ? (
                          <ApplicableToggle
                            value={applicable}
                            onChange={(v) => void saveDeploymentField(row.id, {
                              is_applicable: v,
                              not_applicable_reason: v ? '' : row.not_applicable_reason ?? '',
                            })}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div>
                          <p className="text-sm text-app-text">{row.description ?? row.job_role_name ?? '—'}</p>
                          {row.shift_label ? <p className="text-xs text-app-subtle">{row.shift_label}</p> : null}
                          {!applicable && row.not_applicable_reason ? (
                            <p className="text-xs text-app-subtle italic mt-0.5">{row.not_applicable_reason}</p>
                          ) : null}
                          {/* Mapping status badge */}
                          {applicable && (
                            <div className="mt-1">
                              {isIgnored ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-app-subtle">
                                  <Info className="h-3 w-3" />
                                  Template row
                                </span>
                              ) : mapping ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] text-status-success"
                                  title={getMappingTooltip(mapping)}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Mapped
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-status-warning">
                                  <AlertCircle className="h-3 w-3" />
                                  Mapping needed
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {editable && applicable ? (
                          <NumberInput
                            value={row.general_count}
                            onChange={(v) => setShiftDeployments((prev) => prev.map((r) => r.id === row.id ? { ...r, general_count: v } : r))}
                            onBlur={(v) => void saveDeploymentField(row.id, { general_count: v })}
                            min={0}
                          />
                        ) : (
                          <span className="block text-center text-sm text-app-secondary">{row.general_count ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editable && applicable ? (
                          <NumberInput
                            value={row.first_shift_count}
                            onChange={(v) => setShiftDeployments((prev) => prev.map((r) => r.id === row.id ? { ...r, first_shift_count: v } : r))}
                            onBlur={(v) => void saveDeploymentField(row.id, { first_shift_count: v })}
                            min={0}
                          />
                        ) : (
                          <span className="block text-center text-sm text-app-secondary">{row.first_shift_count ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editable && applicable ? (
                          <NumberInput
                            value={row.second_shift_count}
                            onChange={(v) => setShiftDeployments((prev) => prev.map((r) => r.id === row.id ? { ...r, second_shift_count: v } : r))}
                            onBlur={(v) => void saveDeploymentField(row.id, { second_shift_count: v })}
                            min={0}
                          />
                        ) : (
                          <span className="block text-center text-sm text-app-secondary">{row.second_shift_count ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editable && applicable ? (
                          <NumberInput
                            value={row.total_count}
                            onChange={(v) => setShiftDeployments((prev) => prev.map((r) => r.id === row.id ? { ...r, total_count: v } : r))}
                            onBlur={(v) => void saveDeploymentField(row.id, { total_count: v })}
                            min={0}
                            className="font-medium"
                          />
                        ) : (
                          <span className="block text-center text-sm font-medium text-app-text">{row.total_count ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editable && applicable ? (
                          <input
                            type="text"
                            value={row.remarks ?? ''}
                            onChange={(e) => setShiftDeployments((prev) => prev.map((r) => r.id === row.id ? { ...r, remarks: e.target.value } : r))}
                            onBlur={(e) => void saveDeploymentField(row.id, { remarks: e.target.value || undefined })}
                            placeholder="Notes..."
                            className="w-full rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text placeholder:text-app-subtle focus:border-brand-500 focus:outline-none"
                          />
                        ) : (
                          <span className="text-xs text-app-secondary">{row.remarks ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <SaveIndicator state={saveStates[key]} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {canUpdate ? (
          <div className="mt-4">
            {addDeploymentOpen ? (
              <AddRowForm
                placeholder="Role or deployment description"
                onCancel={() => setAddDeploymentOpen(false)}
                onAdd={(val) => void handleAddDeployment(val)}
              />
            ) : (
              <AddRowButton onClick={() => setAddDeploymentOpen(true)} label="Add deployment row" />
            )}
          </div>
        ) : null}
      </SectionCard>
    </div>
  )

  const locationsTab = (
    <div className="space-y-3">
      <SectionCard title="Location Breakdown" description="Enter present and proposed headcount by location">
        {locationLines.length === 0 ? (
          <p className="text-sm text-app-secondary py-6 text-center">No location rows configured.</p>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-app-border bg-app-muted/30">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-app-subtle uppercase tracking-wider w-16"></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-app-subtle uppercase tracking-wider">Location</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-24">Present</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-24">Proposed</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-app-subtle uppercase tracking-wider">Remarks</th>
                  <th className="px-3 py-2 w-14"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {locationLines.map((row) => {
                  const key = `loc-${row.id}`
                  const isAgg = row.row_type === 'total' || row.row_type === 'subtotal'
                  const applicable = row.is_applicable !== false
                  const editable = canUpdate && !isAgg

                  if (isAgg) {
                    return (
                      <tr key={row.id} className="bg-app-muted/50 font-medium">
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 text-sm text-app-text font-semibold">{row.location_name}</td>
                        <td className="px-3 py-2 text-center text-sm">{row.present_count ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-sm font-semibold">{row.proposed_count ?? '—'}</td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={row.id} className={`${!applicable ? 'bg-app-muted/30 opacity-60' : 'hover:bg-app-muted/20'} transition-colors`}>
                      <td className="px-3 py-2">
                        {editable ? (
                          <ApplicableToggle
                            value={applicable}
                            onChange={(v) => void saveLocationField(row.id, {
                              is_applicable: v,
                              not_applicable_reason: v ? '' : row.not_applicable_reason ?? '',
                            })}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-sm text-app-text">{row.location_name ?? '—'}</td>
                      <td className="px-3 py-2">
                        {editable && applicable ? (
                          <NumberInput
                            value={row.present_count}
                            onChange={(v) => setLocationLines((prev) => prev.map((r) => r.id === row.id ? { ...r, present_count: v } : r))}
                            onBlur={(v) => void saveLocationField(row.id, { present_count: v })}
                            min={0}
                          />
                        ) : (
                          <span className="block text-center text-sm text-app-secondary">{row.present_count ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editable && applicable ? (
                          <NumberInput
                            value={row.proposed_count}
                            onChange={(v) => setLocationLines((prev) => prev.map((r) => r.id === row.id ? { ...r, proposed_count: v } : r))}
                            onBlur={(v) => void saveLocationField(row.id, { proposed_count: v })}
                            min={0}
                          />
                        ) : (
                          <span className="block text-center text-sm text-app-secondary">{row.proposed_count ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editable && applicable ? (
                          <input
                            type="text"
                            value={row.remarks ?? ''}
                            onChange={(e) => setLocationLines((prev) => prev.map((r) => r.id === row.id ? { ...r, remarks: e.target.value } : r))}
                            onBlur={(e) => void saveLocationField(row.id, { remarks: e.target.value || undefined })}
                            placeholder="Notes..."
                            className="w-full rounded-panel border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text placeholder:text-app-subtle focus:border-brand-500 focus:outline-none"
                          />
                        ) : (
                          <span className="text-xs text-app-secondary">{row.remarks ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <SaveIndicator state={saveStates[key]} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {canUpdate ? (
          <div className="mt-4">
            {addLocationOpen ? (
              <AddRowForm
                placeholder="Location name"
                onCancel={() => setAddLocationOpen(false)}
                onAdd={(val) => void handleAddLocation(val)}
              />
            ) : (
              <AddRowButton onClick={() => setAddLocationOpen(true)} label="Add location" />
            )}
          </div>
        ) : null}
      </SectionCard>
    </div>
  )

  function groupEquipment(lines: SiteSurveyEquipmentLine[]): [string, SiteSurveyEquipmentLine[]][] {
    const map = new Map<string, SiteSurveyEquipmentLine[]>()
    for (const l of lines) {
      const cat = l.equipment_category === 'major' ? 'Major Equipment' : l.equipment_category === 'minor' ? 'Minor Equipment' : 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(l)
    }
    return [...map.entries()]
  }

  const equipmentTab = (
    <div className="space-y-4">
      {equipmentLines.length === 0 ? (
        <SectionCard title="Equipment">
          <p className="text-sm text-app-secondary py-6 text-center">No equipment rows configured.</p>
        </SectionCard>
      ) : (
        groupEquipment(equipmentLines).map(([cat, lines]) => (
          <SectionCard key={cat} title={cat}>
            <div className="overflow-x-auto -mx-4">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-app-border bg-app-muted/30">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-app-subtle uppercase tracking-wider w-16"></th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-app-subtle uppercase tracking-wider">Description</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-24">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-app-subtle uppercase tracking-wider w-28">Unit Cost</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-app-subtle uppercase tracking-wider w-28">Total</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-24">Amort.</th>
                    <th className="px-3 py-2 w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {lines.map((row) => {
                    const key = `eq-${row.id}`
                    const isHeader = row.line_type === 'header'
                    const isAgg = row.line_type === 'aggregate'
                    const applicable = row.is_applicable !== false
                    const editable = canUpdate && !isHeader && !isAgg

                    if (isHeader) {
                      return (
                        <tr key={row.id} className="bg-brand-50/50">
                          <td colSpan={7} className="px-3 py-2">
                            <span className="text-sm font-semibold text-brand-700">{row.description}</span>
                          </td>
                        </tr>
                      )
                    }

                    if (isAgg) {
                      return (
                        <tr key={row.id} className="bg-app-muted/50 font-medium">
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 text-sm text-app-text font-semibold">{row.description}</td>
                          <td className="px-3 py-2 text-center text-sm">{row.unit_count ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-sm">{row.amount ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-sm font-semibold">{row.total ?? '—'}</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={row.id} className={`${!applicable ? 'bg-app-muted/30 opacity-60' : 'hover:bg-app-muted/20'} transition-colors`}>
                        <td className="px-3 py-2">
                          {editable ? (
                            <ApplicableToggle
                              value={applicable}
                              onChange={(v) => void saveEquipmentField(row.id, {
                                is_applicable: v,
                                not_applicable_reason: v ? '' : row.not_applicable_reason ?? '',
                              })}
                            />
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-sm text-app-text">{row.description ?? '—'}</td>
                        <td className="px-3 py-2">
                          {editable && applicable ? (
                            <NumberInput
                              value={row.unit_count}
                              onChange={(v) => setEquipmentLines((prev) => prev.map((r) => r.id === row.id ? { ...r, unit_count: v } : r))}
                              onBlur={(v) => void saveEquipmentField(row.id, { unit_count: v })}
                              min={0}
                            />
                          ) : (
                            <span className="block text-center text-sm text-app-secondary">{row.unit_count ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editable && applicable ? (
                            <input
                              type="text"
                              value={row.amount ?? ''}
                              onChange={(e) => setEquipmentLines((prev) => prev.map((r) => r.id === row.id ? { ...r, amount: e.target.value } : r))}
                              onBlur={(e) => void saveEquipmentField(row.id, { amount: e.target.value || null })}
                              className="w-full rounded-panel border border-app-border bg-app-surface px-2 py-1 text-sm text-right text-app-text placeholder:text-app-subtle focus:border-brand-500 focus:outline-none"
                            />
                          ) : (
                            <span className="block text-right text-sm text-app-secondary">{row.amount ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-app-secondary">{row.total ?? '—'}</td>
                        <td className="px-3 py-2">
                          {editable && applicable ? (
                            <NumberInput
                              value={row.amortisation_months}
                              onChange={(v) => setEquipmentLines((prev) => prev.map((r) => r.id === row.id ? { ...r, amortisation_months: v } : r))}
                              onBlur={(v) => void saveEquipmentField(row.id, { amortisation_months: v })}
                              min={1}
                            />
                          ) : (
                            <span className="block text-center text-sm text-app-secondary">{row.amortisation_months ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <SaveIndicator state={saveStates[key]} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ))
      )}
      {canUpdate ? (
        <div>
          {addEquipmentOpen ? (
            <AddEquipmentForm
              onCancel={() => setAddEquipmentOpen(false)}
              onAdd={(desc, cat) => void handleAddEquipment(desc, cat)}
            />
          ) : (
            <AddRowButton onClick={() => setAddEquipmentOpen(true)} label="Add equipment" />
          )}
        </div>
      ) : null}
    </div>
  )

  const issuesTab = (
    <div className="space-y-4">
      <SectionCard title="Site Issues & Improvements" description="Document any issues observed and proposed improvements">
        {issueLines.length === 0 ? (
          <p className="text-sm text-app-secondary py-8 text-center">No issues recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {issueLines.map((row) => {
              const key = `iss-${row.id}`
              const applicable = row.is_applicable !== false

              return (
                <div
                  key={row.id}
                  className={`rounded-xl border ${applicable ? 'border-app-border bg-white' : 'border-app-border/50 bg-app-muted/30 opacity-60'} p-4 transition-all`}
                >
                  <div className="flex items-start gap-4">
                    {canUpdate ? (
                      <ApplicableToggle
                        value={applicable}
                        onChange={(v) => void saveIssueField(row.id, {
                          is_applicable: v,
                          not_applicable_reason: v ? '' : row.not_applicable_reason ?? '',
                        })}
                      />
                    ) : null}
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-sm font-medium text-app-text">{row.issue ?? 'Untitled issue'}</p>
                      </div>
                      {applicable ? (
                        <div>
                          <label className="block text-xs font-medium text-app-secondary mb-1.5">Improvement Details</label>
                          {canUpdate ? (
                            <textarea
                              value={row.improvement_details ?? ''}
                              onChange={(e) => setIssueLines((prev) => prev.map((r) => r.id === row.id ? { ...r, improvement_details: e.target.value } : r))}
                              onBlur={(e) => void saveIssueField(row.id, { improvement_details: e.target.value || null })}
                              placeholder="Describe the proposed improvement..."
                              rows={2}
                              className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-subtle resize-none focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            />
                          ) : (
                            <p className="text-sm text-app-secondary">{row.improvement_details ?? '—'}</p>
                          )}
                        </div>
                      ) : row.not_applicable_reason ? (
                        <p className="text-xs text-app-subtle italic">Reason: {row.not_applicable_reason}</p>
                      ) : null}
                    </div>
                    <SaveIndicator state={saveStates[key]} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {canUpdate ? (
          <div className="mt-4">
            {addIssueOpen ? (
              <AddRowForm
                placeholder="Describe the issue..."
                onCancel={() => setAddIssueOpen(false)}
                onAdd={(val) => void handleAddIssue(val)}
                multiline
              />
            ) : (
              <AddRowButton onClick={() => setAddIssueOpen(true)} label="Add issue" />
            )}
          </div>
        ) : null}
      </SectionCard>
    </div>
  )

  const reviewTab = (
    <div className="space-y-6">
      {/* Completeness Overview */}
      <SectionCard title="Survey Completeness">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Scope', percent: scopePercent, filled: scopeFilledCount, total: scopeTotal },
            { label: 'Deployment', percent: deploymentPercent, filled: deploymentFilledCount, total: applicableDeployments.length },
            { label: 'Locations', percent: locationPercent, filled: locationFilledCount, total: applicableLocations.length },
            { label: 'Equipment', percent: equipmentPercent, filled: equipmentFilledCount, total: applicableEquipment.length },
            { label: 'Issues', percent: issuePercent, filled: issueFilledCount, total: applicableIssues.length },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center p-4 rounded-xl bg-app-muted/30">
              <ProgressRing percent={item.percent} size={56} />
              <p className="mt-2 text-sm font-medium text-app-text">{item.label}</p>
              <p className="text-xs text-app-secondary">{item.filled} / {item.total}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Assign Owner */}
      {canUpdate ? (
        <SectionCard title="Survey Assignment">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-app-secondary mb-1.5">Assign to</label>
              <select
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                disabled={assignUsersLoading}
                className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">{assignUsersLoading ? 'Loading...' : 'Select user...'}</option>
                {assignUsers.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.username}{u.department_name ? ` — ${u.department_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="secondary"
                disabled={actionBusy !== null || !assignUserId}
                onClick={() => void handleAssignOwner()}
              >
                {actionBusy === 'assign' ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {/* Role Mapping Readiness */}
      <SectionCard title="Role Mapping Readiness" description="Status of role defaults for deployment rows">
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-app-border bg-app-muted/20 px-3 py-2">
              <CheckCircle2 className="h-5 w-5 text-status-success" />
              <div>
                <p className="text-lg font-semibold text-app-text">{mappedDeployments.length}</p>
                <p className="text-xs text-app-secondary">Mapped</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-app-border bg-app-muted/20 px-3 py-2">
              <AlertCircle className={`h-5 w-5 ${missingMappings.length > 0 ? 'text-status-warning' : 'text-app-subtle'}`} />
              <div>
                <p className="text-lg font-semibold text-app-text">{missingMappings.length}</p>
                <p className="text-xs text-app-secondary">Missing mappings</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-app-border bg-app-muted/20 px-3 py-2">
              <Info className="h-5 w-5 text-app-subtle" />
              <div>
                <p className="text-lg font-semibold text-app-text">{ignoredDeployments.length}</p>
                <p className="text-xs text-app-secondary">Template rows</p>
              </div>
            </div>
          </div>

          {/* Missing mappings list */}
          {missingMappings.length > 0 ? (
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-status-warning mt-0.5 shrink-0" />
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-app-text">Missing role mappings</p>
                  <ul className="space-y-0.5">
                    {missingMappings.map((row) => (
                      <li key={row.id} className="text-xs text-app-secondary">
                        No mapping configured for "{row.description}"
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-app-subtle mt-2">
                    Some rows will fail until mappings are configured. Ask admin to configure survey role mappings.
                  </p>
                </div>
              </div>
            </div>
          ) : mappableDeployments.length > 0 ? (
            <div className="rounded-lg border border-status-success/30 bg-status-success/5 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-status-success" />
                <p className="text-sm text-app-text">All deployment rows have role mappings configured.</p>
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {/* Generate Role Requirements */}
      <SectionCard title="Generate Role Requirements" description="Convert deployment data into role requirements for the proposal">
        <div className="space-y-4">
          {missingMappings.length > 0 ? (
            <div className="rounded-lg border border-status-warning/20 bg-status-warning/5 p-2 mb-2">
              <p className="text-xs text-status-warning">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Some rows may fail due to missing role mappings.
              </p>
            </div>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => void handleGenerateRoles()}
            disabled={actionBusy !== null || data?.survey.status !== 'in_progress'}
          >
            {actionBusy === 'generate' ? 'Generating...' : 'Generate Role Requirements'}
          </Button>
          {generateResult ? (
            <div className={`rounded-xl border p-4 ${generateResult.errors.length > 0 ? 'border-status-warning/30 bg-status-warning/5' : 'border-status-success/30 bg-status-success/5'}`}>
              <div className="flex items-start gap-3">
                {generateResult.errors.length > 0 ? (
                  <AlertCircle className="h-5 w-5 text-status-warning mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-status-success mt-0.5" />
                )}
                <div className="space-y-2">
                  {generateResult.created.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-app-text">
                        Generated {generateResult.created.length} requirement{generateResult.created.length !== 1 ? 's' : ''}
                      </p>
                      <ul className="space-y-0.5">
                        {generateResult.created.map((row) => (
                          <li key={row.sales_role_requirement_id} className="text-xs text-app-secondary">
                            {row.description} → {row.manpower_count} manpower{row.service_category ? ` · ${row.service_category}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {generateResult.skipped.length > 0 ? (
                    <details className="text-xs text-app-secondary">
                      <summary>{generateResult.skipped.length} skipped</summary>
                      <ul className="mt-1 space-y-0.5">
                        {generateResult.skipped.map((row, i) => (
                          <li key={`${row.description}-${row.reason}-${i}`}>
                            {roleGenerationReasonLabel(row.reason, row.description)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {generateResult.errors.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs font-medium text-status-danger">Issues encountered:</p>
                      <ul className="space-y-1">
                        {generateResult.errors.map((row, i) => (
                          <li key={`${row.description}-${row.reason}-${i}`} className="text-xs text-status-danger flex items-start gap-1">
                            <span className="text-status-danger mt-0.5">•</span>
                            <span>{roleGenerationReasonLabel(row.reason, row.description)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {/* Complete Survey */}
      {canUpdate && data?.survey.status === 'in_progress' ? (
        <SectionCard title="Complete Survey">
          <div className="space-y-4">
            <p className="text-sm text-app-secondary">
              Mark this survey as completed to notify Sales that they can proceed with proposal generation.
            </p>
            <Button
              onClick={() => void handleMarkCompleted()}
              disabled={actionBusy !== null}
            >
              {actionBusy === 'completed' ? 'Completing...' : 'Mark Survey as Completed'}
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {actionError ? (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-4">
          <p className="text-sm text-status-danger">{actionError}</p>
        </div>
      ) : null}
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading || preparing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Spinner />
        <p className="text-sm text-app-secondary animate-pulse">
          {preparing ? 'Preparing survey form...' : 'Loading survey...'}
        </p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-6 text-center max-w-md">
          <p className="text-sm text-status-danger">{loadError}</p>
          <Button variant="secondary" className="mt-4" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const survey = data.survey
  const status = survey.status

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="mb-1 flex items-center gap-1 text-xs text-app-subtle hover:text-app-text transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            {location.pathname.startsWith('/sales/operations-surveys') ? 'Back to queue' : 'Back to lead'}
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-app-text">
              {survey.site_name ?? `Site Survey #${survey.id}`}
            </h1>
            <Badge variant={surveyStatusVariant(status)}>{surveyStatusLabel(status)}</Badge>
          </div>
          {survey.lead_client_name ? (
            <p className="text-sm text-app-secondary">{survey.lead_client_name}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-subtle">
            {survey.assigned_to_name ? <span>Assigned to {survey.assigned_to_name}</span> : null}
            {survey.assigned_at ? <span>Assigned {formatShortDate(survey.assigned_at)}</span> : null}
            {survey.due_date ? <span>Due {formatShortDate(survey.due_date)}</span> : null}
            {survey.survey_date ? <span>Survey date {formatShortDate(survey.survey_date)}</span> : null}
          </div>
        </div>
      </div>

      {/* Status Action Card */}
      {status === 'pending' && canUpdate ? (
        <div className="rounded-panel border border-dashed border-brand-300 bg-brand-50/50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-brand-900">Start Site Survey</h2>
              <p className="mt-0.5 text-sm text-brand-700/80">
                Capture scope, deployment, locations, equipment, and site issues for this location.
              </p>
            </div>
            <Button
              onClick={() => void handleMarkStarted()}
              disabled={actionBusy !== null}
              className="shrink-0 self-start sm:self-auto"
            >
              {actionBusy === 'started' ? 'Starting...' : 'Start Survey'}
            </Button>
          </div>
          {actionError ? <p className="mt-2 text-sm text-status-danger">{actionError}</p> : null}
        </div>
      ) : status === 'in_progress' ? (
        <div className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-app-text">Complete Each Section</h2>
              <p className="mt-0.5 text-sm text-app-secondary">
                Use the tabs below to fill in the site survey. Changes save automatically.
              </p>
            </div>
            {canUpdate ? (
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  variant="secondary"
                  className="min-h-9 px-3 text-sm"
                  onClick={() => void handleGenerateRoles()}
                  disabled={actionBusy !== null}
                >
                  {actionBusy === 'generate' ? 'Generating...' : 'Generate Requirements'}
                </Button>
                <Button
                  className="min-h-9 px-3 text-sm"
                  onClick={() => void handleMarkCompleted()}
                  disabled={actionBusy !== null}
                >
                  {actionBusy === 'completed' ? 'Completing...' : 'Mark Completed'}
                </Button>
              </div>
            ) : null}
          </div>
          {actionError ? <p className="mt-2 text-sm text-status-danger">{actionError}</p> : null}
        </div>
      ) : status === 'completed' ? (
        <div className="rounded-panel border border-status-success/30 bg-status-success/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-status-success shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-semibold text-app-text">Survey Completed</h2>
                <p className="mt-0.5 text-sm text-app-secondary">
                  This survey has been sent back to Sales for proposal review.
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleBack} className="shrink-0 self-start sm:self-auto min-h-9 px-3 text-sm">
              {location.pathname.startsWith('/sales/operations-surveys') ? 'Back to Queue' : 'Back to Lead'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="border-b border-app-border">
        <nav className="flex gap-0 overflow-x-auto -mb-px" aria-label="Survey sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-app-secondary hover:text-app-text hover:border-app-border'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {tab === 'scope' && scopeTab}
        {tab === 'deployment' && deploymentTab}
        {tab === 'locations' && locationsTab}
        {tab === 'equipment' && equipmentTab}
        {tab === 'issues' && issuesTab}
        {tab === 'review' && reviewTab}
      </div>
    </div>
  )
}

// ─── Add Row Forms ────────────────────────────────────────────────────────────

function AddRowForm({
  placeholder,
  onCancel,
  onAdd,
  multiline,
}: {
  placeholder: string
  onCancel: () => void
  onAdd: (value: string) => void
  multiline?: boolean
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value.trim()) {
      onAdd(value.trim())
    }
  }

  const inputClass = 'w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm text-app-text placeholder:text-app-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-brand-200 bg-brand-50/50 p-4">
      <div className="space-y-3">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className={inputClass + ' resize-none'}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className={inputClass}
          />
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={!value.trim()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  )
}

function AddEquipmentForm({
  onCancel,
  onAdd,
}: {
  onCancel: () => void
  onAdd: (description: string, category: 'major' | 'minor') => void
}) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'major' | 'minor'>('minor')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (description.trim()) {
      onAdd(description.trim(), category)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-brand-200 bg-brand-50/50 p-4">
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Equipment description"
          className="w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm text-app-text placeholder:text-app-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="category"
              checked={category === 'major'}
              onChange={() => setCategory('major')}
              className="h-4 w-4 border-app-border text-brand-600 focus:ring-brand-500"
            />
            Major Equipment
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="category"
              checked={category === 'minor'}
              onChange={() => setCategory('minor')}
              className="h-4 w-4 border-app-border text-brand-600 focus:ring-brand-500"
            />
            Minor Equipment
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!description.trim()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  )
}
