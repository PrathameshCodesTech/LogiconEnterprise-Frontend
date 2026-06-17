import { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { getSiteSurveyCommercialPreview } from '@/api/sales'
import { formatMoneyAmount } from '@/features/budgets/budgetDisplay'
import { parseApiError } from '@/lib/apiError'
import type {
  SiteSurveyCommercialPreview,
  SiteSurveyCommercialPreviewRow,
  SiteSurveyCommercialPreviewError,
} from '@/types/sales'

// Helpers

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return formatMoneyAmount(String(value), 'INR')
}

function formatCount(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  // Show integer if whole number, otherwise show decimal
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  return `${num}%`
}

const ERROR_MESSAGES: Record<string, string> = {
  survey_not_completed: 'Complete the operations survey first.',
  role_requirements_missing: 'Generate role requirements from the survey first.',
  role_requirement_stale: 'Deployment data changed. Regenerate role requirements.',
  component_rules_missing: 'Proposal component rules are incomplete. Configure them before generating.',
  calculation_failed: '', // Use backend message
}

function getErrorMessage(error: SiteSurveyCommercialPreviewError): string {
  const mapped = ERROR_MESSAGES[error.code]
  if (mapped === '') return error.message // Use backend message for calculation_failed
  return mapped || error.message
}

function getWageSourceLabel(source: string | null): string {
  if (!source) return ''
  switch (source) {
    case 'wage_master': return 'Wage master'
    case 'wage_master_daily': return 'Daily wage master'
    case 'operations_snapshot': return 'Operations snapshot'
    case 'job_role': return 'Job role default'
    case 'survey_override': return 'Survey override'
    case 'manual': return 'Manual entry'
    default: return source
  }
}

// Types

interface SitePreviewData {
  surveyId: number
  siteName: string
  preview: SiteSurveyCommercialPreview | null
  loading: boolean
  error: string | null
}

interface Props {
  open: boolean
  surveyIds: number[]
  clientName: string
  onClose: () => void
  onGenerate: () => void
  generating: boolean
}

// Row Component

function PreviewRow({ row }: { row: SiteSurveyCommercialPreviewRow }) {
  const [expanded, setExpanded] = useState(false)
  const hasComponents = row.components && row.components.length > 0

  return (
    <>
      <tr className="border-b border-app-border hover:bg-app-muted/20 transition-colors">
        {/* Role */}
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {hasComponents && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="p-0.5 rounded hover:bg-app-muted text-app-subtle"
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
            <div>
              <p className="text-sm text-app-text">{row.job_role_name || '-'}</p>
              {row.job_role_code && <p className="text-xs text-app-subtle">{row.job_role_code}</p>}
            </div>
          </div>
        </td>
        {/* Headcount */}
        <td className="px-3 py-2 text-center text-sm text-app-text">{formatCount(row.headcount)}</td>
        {/* Shift split */}
        <td className="px-2 py-2 text-center text-xs text-app-secondary">{formatCount(row.general_count)}</td>
        <td className="px-2 py-2 text-center text-xs text-app-secondary">{formatCount(row.first_shift_count)}</td>
        <td className="px-2 py-2 text-center text-xs text-app-secondary">{formatCount(row.second_shift_count)}</td>
        <td className="px-2 py-2 text-center text-xs text-app-secondary">{formatCount(row.night_shift_count)}</td>
        <td className="px-2 py-2 text-center text-xs text-app-secondary">{formatCount(row.reliever_count)}</td>
        {/* Hours / Days */}
        <td className="px-2 py-2 text-center text-xs text-app-secondary">{row.shift_hours ?? '-'}</td>
        <td className="px-2 py-2 text-center text-xs text-app-secondary">{formatCount(row.working_days)}</td>
        {/* Ops Base Wage */}
        <td className="px-3 py-2 text-right">
          <div>
            <span className="text-sm text-app-text">{formatMoney(row.operational_base_wage)}</span>
            {row.operational_base_wage_overridden ? (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
                <span className="text-[10px] text-amber-600">Ops override</span>
              </div>
            ) : row.operational_base_wage_source ? (
              <p className="text-[10px] text-app-subtle">{getWageSourceLabel(row.operational_base_wage_source)}</p>
            ) : null}
          </div>
        </td>
        {/* Sales Unit Cost */}
        <td className="px-3 py-2 text-right">
          <span className="text-sm text-app-text">{formatMoney(row.unit_cost)}</span>
          {row.source_unit_cost_origin && (
            <p className="text-[10px] text-app-subtle">{getWageSourceLabel(row.source_unit_cost_origin)}</p>
          )}
        </td>
        {/* Monthly Total */}
        <td className="px-3 py-2 text-right">
          <span className="text-sm font-medium text-app-text">{formatMoney(row.total_cost)}</span>
        </td>
      </tr>
      {/* Expanded components breakup */}
      {expanded && hasComponents && (
        <tr className="bg-app-muted/30">
          <td colSpan={12} className="px-3 py-2">
            <div className="ml-8 border-l-2 border-app-border pl-4">
              <p className="text-[10px] uppercase tracking-wider text-app-subtle mb-2">Salary Breakup</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {row.components.map((c, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="text-app-secondary">{c.component_name}</span>
                    <span className="text-right text-app-text font-medium">
                      {formatMoney(c.amount)}
                      {c.percentage ? <span className="ml-1 text-app-subtle">({formatPercent(c.percentage)})</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// Site Section

function SitePreviewSection({ data }: { data: SitePreviewData }) {
  if (data.loading) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface p-6">
        <Spinner label={`Loading preview for ${data.siteName}...`} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-status-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-app-text">{data.siteName}</p>
            <p className="text-sm text-status-danger mt-1">{data.error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data.preview) return null

  const { preview } = data
  const isReady = preview.ready && preview.can_generate_proposal

  return (
    <div className="rounded-xl border border-app-border bg-app-surface shadow-sm overflow-hidden">
      {/* Site Header */}
      <div className={`border-l-4 ${isReady ? 'border-l-status-success bg-gradient-to-r from-green-50/80 to-transparent dark:from-green-900/20' : 'border-l-status-danger bg-gradient-to-r from-red-50/80 to-transparent dark:from-red-900/20'} px-5 py-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-semibold text-app-heading">{preview.site?.site_name || data.siteName}</h4>
            <p className="text-sm text-app-secondary mt-0.5">Survey #{preview.survey.id}</p>
          </div>
          <Badge variant={isReady ? 'success' : 'danger'}>
            {isReady ? 'Ready' : 'Not Ready'}
          </Badge>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Errors */}
        {preview.errors.length > 0 && (
          <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-status-danger" />
              <p className="text-sm font-medium text-status-danger">
                {preview.errors.length} issue{preview.errors.length > 1 ? 's' : ''} blocking proposal generation
              </p>
            </div>
            <ul className="space-y-1.5 ml-6">
              {preview.errors.map((err, idx) => (
                <li key={idx} className="text-sm text-app-text">
                  <span className="font-medium">{getErrorMessage(err)}</span>
                  {err.job_role_name && (
                    <span className="text-app-secondary"> - {err.job_role_name}</span>
                  )}
                  {err.missing_codes && err.missing_codes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {err.missing_codes.map((code) => (
                        <Badge key={code} variant="danger">{code}</Badge>
                      ))}
                    </div>
                  )}
                  {err.reasons && err.reasons.length > 0 && (
                    <ul className="mt-1 text-xs text-app-secondary list-disc list-inside">
                      {err.reasons.map((r, ridx) => <li key={ridx}>{r}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {preview.warnings.length > 0 && (
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-status-warning" />
              <p className="text-sm font-medium text-status-warning">Warnings</p>
            </div>
            <ul className="space-y-1 ml-6">
              {preview.warnings.map((w, idx) => (
                <li key={idx} className="text-sm text-app-secondary">{w.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Role-wise table */}
        {preview.rows.length > 0 ? (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-app-border bg-app-muted/30">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-app-subtle uppercase tracking-wider min-w-[180px]">Role</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-16">Count</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-12">Gen</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-12">S1</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-12">S2</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-12">Night</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-12">Rel</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-12">Hrs</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-app-subtle uppercase tracking-wider w-12">Days</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-app-subtle uppercase tracking-wider w-28">Ops Wage</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-app-subtle uppercase tracking-wider w-28">Unit Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-app-subtle uppercase tracking-wider w-28">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <PreviewRow key={row.sales_role_requirement_id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-app-secondary text-center py-4">No role requirements found for this site.</p>
        )}

        {/* Totals */}
        {preview.rows.length > 0 && (
          <div className="border-t border-app-border pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-app-subtle">Manpower Total</p>
                <p className="text-sm font-semibold text-app-text mt-0.5">{formatCount(preview.totals.manpower_total)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-app-subtle">Subtotal</p>
                <p className="text-sm font-semibold text-app-text mt-0.5">{formatMoney(preview.totals.subtotal_amount)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-app-subtle">Mgmt Fee ({formatPercent(preview.totals.management_fee_percent)})</p>
                <p className="text-sm font-semibold text-app-text mt-0.5">{formatMoney(preview.totals.management_fee_amount)}</p>
              </div>
              {preview.totals.gst_applicable && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-app-subtle">GST</p>
                  <p className="text-sm font-semibold text-app-text mt-0.5">{formatMoney(preview.totals.gst_amount)}</p>
                </div>
              )}
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] uppercase tracking-wider text-app-subtle">Grand Total</p>
                <p className="text-lg font-bold text-brand-600 mt-0.5">{formatMoney(preview.totals.grand_total)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Main Drawer

export function SiteSurveyCommercialPreviewDrawer({
  open,
  surveyIds,
  clientName,
  onClose,
  onGenerate,
  generating,
}: Props) {
  const [siteData, setSiteData] = useState<SitePreviewData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || surveyIds.length === 0) return

    async function fetchAll() {
      setLoading(true)
      const initialData: SitePreviewData[] = surveyIds.map((id) => ({
        surveyId: id,
        siteName: `Survey #${id}`,
        preview: null,
        loading: true,
        error: null,
      }))
      setSiteData(initialData)

      const results = await Promise.all(
        surveyIds.map(async (surveyId) => {
          try {
            const preview = await getSiteSurveyCommercialPreview(surveyId)
            return {
              surveyId,
              siteName: preview.site?.site_name || `Survey #${surveyId}`,
              preview,
              loading: false,
              error: null,
            }
          } catch (e) {
            return {
              surveyId,
              siteName: `Survey #${surveyId}`,
              preview: null,
              loading: false,
              error: parseApiError(e, 'Failed to load preview').message,
            }
          }
        }),
      )
      setSiteData(results)
      setLoading(false)
    }

    void fetchAll()
  }, [open, surveyIds])

  // Check if all previews are ready
  const allReady = siteData.every((d) => d.preview?.ready && d.preview?.can_generate_proposal)
  const hasErrors = siteData.some((d) => d.error || (d.preview && d.preview.errors.length > 0))
  const canGenerate = !loading && allReady && !hasErrors

  // Calculate combined totals across all sites
  const combinedTotals = siteData.reduce(
    (acc, d) => {
      if (!d.preview) return acc
      const t = d.preview.totals
      return {
        manpower: acc.manpower + (parseFloat(String(t.manpower_total || 0)) || 0),
        grand: acc.grand + (parseFloat(String(t.grand_total || 0)) || 0),
      }
    },
    { manpower: 0, grand: 0 },
  )

  return (
    <Drawer
      open={open}
      title="Commercial Preview"
      description={`${clientName} - ${surveyIds.length} site${surveyIds.length > 1 ? 's' : ''}`}
      onClose={onClose}
      panelClassName="max-w-6xl"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm">
            {siteData.length > 1 && !loading && (
              <span className="text-app-secondary">
                Combined total: <span className="font-semibold text-app-text">{formatMoney(combinedTotals.grand)}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={generating}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onGenerate}
              disabled={!canGenerate || generating}
            >
              {generating ? 'Generating...' : 'Generate Proposal'}
            </Button>
          </div>
        </div>
      }
    >
      {loading && siteData.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Spinner label="Loading commercial preview..." />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {canGenerate ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-status-success" />
                  <span className="text-sm font-medium text-status-success">All sites ready for proposal generation</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-status-danger" />
                  <span className="text-sm font-medium text-status-danger">
                    {hasErrors ? 'Resolve errors before generating proposal' : 'Loading...'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Site sections */}
          {siteData.map((data) => (
            <SitePreviewSection key={data.surveyId} data={data} />
          ))}
        </div>
      )}
    </Drawer>
  )
}
