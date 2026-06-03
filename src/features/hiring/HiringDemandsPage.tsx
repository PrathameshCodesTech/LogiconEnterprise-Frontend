import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Search, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/authStore'
import { CAP, hasAllCapabilities } from '@/lib/capabilities'
import { listHiringDemands } from '@/api/hiring'
import { parseApiError } from '@/lib/apiError'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { ManualResumeIntakeDrawer } from '@/features/talent/ManualResumeIntakeDrawer'
import { ResumePoolDrawer } from '@/features/hiring/ResumePoolDrawer'
import type { HiringDemandRow } from '@/features/hiring/types'

export function HiringDemandsPage() {
  const meCaps = useAuthStore((s) => s.me?.capabilities ?? [])
  const canFindFromPool = hasAllCapabilities(meCaps, [CAP.CANDIDATE_READ, CAP.HIRING_APPLICATION_CREATE])
  const canAddNewCandidate = hasAllCapabilities(meCaps, [CAP.CANDIDATE_CREATE, CAP.HIRING_APPLICATION_CREATE])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<HiringDemandRow[]>([])
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [poolOpen, setPoolOpen] = useState(false)
  const [selectedDemand, setSelectedDemand] = useState<HiringDemandRow | null>(null)
  const [prefill, setPrefill] = useState<{ mrfId: number; lineId: number } | null>(null)

  const refreshDemands = useCallback(async () => {
    const res = await listHiringDemands({ page: 1 })
    setRows(res.items)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await listHiringDemands({ page: 1 })
        if (!cancelled) setRows(res.items)
      } catch (e: unknown) {
        if (!cancelled) setError(parseApiError(e, 'Could not load hiring demands').message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function openIntake(d: HiringDemandRow) {
    setPrefill({ mrfId: d.mrf_id, lineId: d.id })
    setIntakeOpen(true)
  }

  function closeIntake() {
    setIntakeOpen(false)
    setPrefill(null)
  }

  function openPool(d: HiringDemandRow) {
    setSelectedDemand(d)
    setPoolOpen(true)
  }

  function closePool() {
    setPoolOpen(false)
    setSelectedDemand(null)
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-app-text">Hiring demands</h2>
        <p className="text-sm text-app-secondary">
          Approved staffing needs from MRF line items. Find an existing candidate or add a new one to start an application.
        </p>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <Spinner label="Loading hiring demands..." /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="No hiring demands" description="Approved MRF line items will appear here." />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-panel border border-app-border bg-app-surface shadow-panel">
          <Table>
            <THead>
              <TR>
                <TH className="py-2">MRF</TH>
                <TH className="py-2">Client / site</TH>
                <TH className="py-2">Job role</TH>
                <TH className="py-2">Requested</TH>
                <TH className="py-2">Applications</TH>
                <TH className="py-2">Shortlisted</TH>
                <TH className="py-2">Selected</TH>
                <TH className="py-2">Offer accepted</TH>
                <TH className="py-2">Open</TH>
                <TH className="py-2 text-right"> </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((d) => (
                <TR key={d.id}>
                  <TD className="py-2 font-mono text-xs">#{d.mrf_id}</TD>
                  <TD className="py-2 text-xs text-app-secondary">
                    {d.client_name?.trim() || '-'}
                    {d.site_name ? ` | ${d.site_name}` : null}
                  </TD>
                  <TD className="py-2 text-sm">{d.job_role_name ?? `Role #${d.job_role_id}`}</TD>
                  <TD className="py-2 text-xs">{d.requested_headcount}</TD>
                  <TD className="py-2 text-xs">{d.application_count}</TD>
                  <TD className="py-2 text-xs">{d.shortlisted_count}</TD>
                  <TD className="py-2 text-xs">{d.selected_count}</TD>
                  <TD className="py-2 text-xs">{d.offer_accepted_count}</TD>
                  <TD className="py-2 text-xs font-medium">{d.open_count}</TD>
                  <TD className="py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        to={`/hiring/demands/${d.id}`}
                        className="inline-flex items-center gap-1 min-h-8 rounded-panel border border-app-border bg-app-surface px-2 text-xs text-app-text shadow-panel hover:border-brand-500/40 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        Details
                      </Link>
                      {canFindFromPool ? (
                        <Button type="button" variant="secondary" className="min-h-8 gap-1 px-2 text-xs" onClick={() => openPool(d)}>
                          <Search className="h-3.5 w-3.5" aria-hidden />
                          Find from pool
                        </Button>
                      ) : null}
                      {canAddNewCandidate ? (
                        <Button type="button" variant="secondary" className="min-h-8 gap-1 px-2 text-xs" onClick={() => openIntake(d)}>
                          <UserPlus className="h-3.5 w-3.5" aria-hidden />
                          Add new candidate
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}

      <ManualResumeIntakeDrawer
        open={intakeOpen}
        onClose={closeIntake}
        defaultMrfId={prefill?.mrfId}
        defaultMrfLineItemId={prefill?.lineId}
        onSuccess={() => {
          void refreshDemands().catch(() => {
            /* ignore */
          })
        }}
      />

      <ResumePoolDrawer
        open={poolOpen}
        demand={selectedDemand}
        onClose={closePool}
        onLinked={() => {
          void refreshDemands().catch(() => {
            /* ignore */
          })
        }}
      />
    </div>
  )
}
