import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, SendHorizontal, UserPlus } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import { CAP, hasAnyCapability } from '@/lib/capabilities'
import {
  getHiringDemand,
  getRankedCandidatePool,
  listHiringApplications,
  sendApplicationToClientReview,
  sendShortlistedToClientReview,
  shortlistCandidateForDemand,
} from '@/api/hiring'
import { parseApiError } from '@/lib/apiError'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { hiringApplicationStatusLabel } from '@/features/talent/talentLabels'
import type {
  CandidatePoolResultRow,
  HiringApplicationRow,
  HiringDemandRow,
} from '@/features/hiring/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtScore(v: number | string | null | undefined): string {
  if (v == null) return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return `${(n * 100).toFixed(0)}%`
}

function fmtExp(v: string | number | null | undefined): string {
  if (v == null || v === '') return '-'
  return `${v} yrs`
}

function matchVariant(s: string | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (!s) return 'neutral'
  if (s === 'qualified') return 'success'
  if (s === 'partial') return 'warning'
  return 'danger'
}

function decisionVariant(s: string | null | undefined): 'success' | 'danger' | 'warning' | 'neutral' {
  if (!s) return 'neutral'
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'danger'
  if (s === 'pending') return 'warning'
  return 'neutral'
}

function candidateName(row: CandidatePoolResultRow): string {
  const c = row.candidate
  if (c.full_name?.trim()) return c.full_name.trim()
  return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ') || `Candidate #${c.id}`
}

// ─── Inline banners ───────────────────────────────────────────────────────────

function InlineError({ message }: { message: string }) {
  return (
    <p className="mt-1 text-xs text-status-danger">{message}</p>
  )
}

function InlineSuccess({ message }: { message: string }) {
  return (
    <p className="mt-1 text-xs text-status-hired">{message}</p>
  )
}

// ─── Demand summary header ────────────────────────────────────────────────────

function DemandSummary({ demand }: { demand: HiringDemandRow }) {
  return (
    <div className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-app-text">
            {demand.job_role_name ?? `Role #${demand.job_role_id}`}
          </h2>
          <p className="mt-0.5 text-sm text-app-secondary">
            {demand.client_name?.trim() || '—'}
            {demand.site_name ? ` · ${demand.site_name}` : ''}
            {demand.billing_type ? ` · ${demand.billing_type}` : ''}
          </p>
          <p className="mt-0.5 font-mono text-xs text-app-subtle">MRF #{demand.mrf_id}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-center text-sm">
          <Stat label="Requested" value={demand.requested_headcount} />
          <Stat label="Applications" value={demand.application_count} />
          <Stat label="Shortlisted" value={demand.shortlisted_count} />
          <Stat label="Selected" value={demand.selected_count} />
          <Stat label="Offer accepted" value={demand.offer_accepted_count} />
          <Stat label="Open" value={demand.open_count} highlight />
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="min-w-[48px]">
      <p className={cn('text-lg font-bold', highlight ? 'text-brand-700' : 'text-app-text')}>{value}</p>
      <p className="text-xs text-app-secondary">{label}</p>
    </div>
  )
}

// ─── Pool filters ─────────────────────────────────────────────────────────────

interface PoolFilters {
  skills: string
  location: string
  minExp: string
  maxExp: string
  minScore: string
}

const BLANK_POOL_FILTERS: PoolFilters = {
  skills: '',
  location: '',
  minExp: '',
  maxExp: '',
  minScore: '',
}

// ─── CandidatePoolTab ─────────────────────────────────────────────────────────

function CandidatePoolTab({
  demandId,
  canShortlist,
  onShortlisted,
}: {
  demandId: number
  canShortlist: boolean
  onShortlisted: () => void
}) {
  const [filters, setFilters] = useState<PoolFilters>(BLANK_POOL_FILTERS)
  const [rows, setRows] = useState<CandidatePoolResultRow[]>([])
  const [count, setCount] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shortlistingId, setShortlistingId] = useState<number | null>(null)
  const [shortlistErrors, setShortlistErrors] = useState<Record<number, string>>({})
  const [shortlistSuccess, setShortlistSuccess] = useState<Record<number, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = { ranked: 'true' }
      if (filters.skills.trim()) params.skills = filters.skills.trim()
      if (filters.location.trim()) params.location = filters.location.trim()
      if (filters.minExp.trim()) params.min_experience = filters.minExp.trim()
      if (filters.maxExp.trim()) params.max_experience = filters.maxExp.trim()
      if (filters.minScore.trim()) params.min_score = filters.minScore.trim()
      const res = await getRankedCandidatePool(demandId, params as Parameters<typeof getRankedCandidatePool>[1])
      setRows(res.items)
      setCount(res.count)
    } catch (e: unknown) {
      setError(parseApiError(e, 'Could not load candidate pool').message)
    } finally {
      setLoading(false)
    }
  }, [demandId, filters])

  useEffect(() => {
    void load()
  }, [load])

  function setFilter(key: keyof PoolFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  async function handleShortlist(row: CandidatePoolResultRow) {
    const cid = row.candidate.id
    setShortlistingId(cid)
    setShortlistErrors((prev) => ({ ...prev, [cid]: '' }))
    setShortlistSuccess((prev) => ({ ...prev, [cid]: false }))
    try {
      await shortlistCandidateForDemand(demandId, { candidate: cid })
      setShortlistSuccess((prev) => ({ ...prev, [cid]: true }))
      onShortlisted()
      void load()
    } catch (e: unknown) {
      setShortlistErrors((prev) => ({
        ...prev,
        [cid]: parseApiError(e, 'Could not shortlist candidate').message,
      }))
    } finally {
      setShortlistingId(null)
    }
  }

  const inputCls =
    'h-7 w-full rounded border border-app-border bg-app-surface px-2 text-xs text-app-text placeholder-app-muted focus:outline-none focus:ring-1 focus:ring-brand-500'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-panel border border-app-border bg-app-surface p-3 shadow-panel">
        <FilterField label="Skills" value={filters.skills} onChange={(v) => setFilter('skills', v)} placeholder="e.g. housekeeping" />
        <FilterField label="Location" value={filters.location} onChange={(v) => setFilter('location', v)} placeholder="City or state" />
        <FilterField label="Min exp (yrs)" value={filters.minExp} onChange={(v) => setFilter('minExp', v)} placeholder="e.g. 2" type="number" />
        <FilterField label="Max exp (yrs)" value={filters.maxExp} onChange={(v) => setFilter('maxExp', v)} placeholder="e.g. 10" type="number" />
        <FilterField label="Min score (0–1)" value={filters.minScore} onChange={(v) => setFilter('minScore', v)} placeholder="e.g. 0.6" type="number" />
        <div className="flex items-end gap-2 ml-auto">
          <Button
            type="button"
            variant="secondary"
            className="min-h-7 gap-1 px-2 text-xs"
            onClick={() => setFilters(BLANK_POOL_FILTERS)}
            disabled={loading}
          >
            Clear
          </Button>
          <Button
            type="button"
            className="min-h-7 gap-1 px-2 text-xs"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            Refresh
          </Button>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {loading && rows.length === 0 ? <Spinner label="Loading ranked candidates…" /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="No candidates in pool"
          description="Adjust filters or check back after more resumes are indexed."
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-panel border border-app-border bg-app-surface shadow-panel">
          <Table>
            <THead>
              <TR>
                <TH className="py-2 w-8">#</TH>
                <TH className="py-2">Candidate</TH>
                <TH className="py-2">Role / Location</TH>
                <TH className="py-2">Exp</TH>
                <TH className="py-2">Score</TH>
                <TH className="py-2">Status</TH>
                <TH className="py-2">Matched skills</TH>
                {canShortlist ? <TH className="py-2 text-right"> </TH> : null}
              </TR>
            </THead>
            <TBody>
              {rows.map((row, idx) => {
                const cid = row.candidate.id
                const busy = shortlistingId === cid
                const done = shortlistSuccess[cid] ?? false
                const rowErr = shortlistErrors[cid] ?? ''
                const cssInputClass = inputCls
                void cssInputClass
                return (
                  <TR key={cid}>
                    <TD className="py-2 text-xs text-app-subtle">{idx + 1}</TD>
                    <TD className="py-2">
                      <p className="text-sm font-medium text-app-text">{candidateName(row)}</p>
                      <p className="font-mono text-xs text-app-secondary">{row.candidate.phone}</p>
                    </TD>
                    <TD className="py-2 text-xs text-app-secondary">
                      <p>{row.candidate.current_role?.trim() || '-'}</p>
                      <p>{row.candidate.current_location?.trim() || '-'}</p>
                    </TD>
                    <TD className="py-2 text-xs">{fmtExp(row.candidate.total_experience_years)}</TD>
                    <TD className="py-2 text-xs font-medium">{fmtScore(row.score)}</TD>
                    <TD className="py-2">
                      {row.match_status ? (
                        <Badge variant={matchVariant(row.match_status)} className="text-[11px]">
                          {row.match_status.replace(/_/g, ' ')}
                        </Badge>
                      ) : null}
                    </TD>
                    <TD className="py-2 text-xs text-app-secondary max-w-[200px]">
                      {row.matched_skills && row.matched_skills.length > 0 ? (
                        <span className="text-status-hired">{row.matched_skills.slice(0, 4).join(', ')}{row.matched_skills.length > 4 ? ` +${row.matched_skills.length - 4}` : ''}</span>
                      ) : '-'}
                      {row.missing_skills && row.missing_skills.length > 0 ? (
                        <span className="block text-status-danger">
                          Missing: {row.missing_skills.slice(0, 3).join(', ')}{row.missing_skills.length > 3 ? ` +${row.missing_skills.length - 3}` : ''}
                        </span>
                      ) : null}
                    </TD>
                    {canShortlist ? (
                      <TD className="py-2 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          {done ? (
                            <Badge variant="success" className="text-[11px]">Shortlisted</Badge>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              className="min-h-7 gap-1 px-2 text-xs"
                              disabled={busy || shortlistingId != null}
                              onClick={() => void handleShortlist(row)}
                            >
                              <UserPlus className="h-3 w-3" aria-hidden />
                              {busy ? 'Shortlisting…' : 'Shortlist'}
                            </Button>
                          )}
                          {rowErr ? <InlineError message={rowErr} /> : null}
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                )
              })}
            </TBody>
          </Table>
          {count != null ? <p className="px-3 py-2 text-xs text-app-subtle">Total: {count}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function FilterField({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[120px]">
      <label className="text-[10px] font-medium text-app-secondary uppercase tracking-wide">{label}</label>
      <input
        type={type ?? 'text'}
        className="h-7 w-full rounded border border-app-border bg-app-surface px-2 text-xs text-app-text placeholder-app-muted focus:outline-none focus:ring-1 focus:ring-brand-500"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// ─── ApplicationsTab ──────────────────────────────────────────────────────────

function ApplicationsTab({
  demand,
  canSendToClient,
}: {
  demand: HiringDemandRow
  canSendToClient: boolean
}) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<HiringApplicationRow[]>([])
  const [count, setCount] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [sendingId, setSendingId] = useState<number | null>(null)
  const [sendErrors, setSendErrors] = useState<Record<number, string>>({})
  const [sendSuccess, setSendSuccess] = useState<Record<number, boolean>>({})
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ sent: number; skipped: number } | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listHiringApplications({
        site: demand.site_id ?? undefined,
        job_role: demand.job_role_id,
        status: statusFilter || undefined,
      })
      setRows(res.items)
      setCount(res.count)
    } catch (e: unknown) {
      setError(parseApiError(e, 'Could not load applications').message)
    } finally {
      setLoading(false)
    }
  }, [demand.site_id, demand.job_role_id, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSendToClient(appId: number) {
    setSendingId(appId)
    setSendErrors((prev) => ({ ...prev, [appId]: '' }))
    setSendSuccess((prev) => ({ ...prev, [appId]: false }))
    try {
      await sendApplicationToClientReview(appId, {})
      setSendSuccess((prev) => ({ ...prev, [appId]: true }))
      void load()
    } catch (e: unknown) {
      setSendErrors((prev) => ({
        ...prev,
        [appId]: parseApiError(e, 'Could not send to client review').message,
      }))
    } finally {
      setSendingId(null)
    }
  }

  async function handleBulkSend() {
    setBulkBusy(true)
    setBulkResult(null)
    setBulkError(null)
    try {
      const res = await sendShortlistedToClientReview(demand.id, {})
      setBulkResult({ sent: res.sent, skipped: res.skipped })
      void load()
    } catch (e: unknown) {
      setBulkError(parseApiError(e, 'Bulk send failed').message)
    } finally {
      setBulkBusy(false)
    }
  }

  const STATUS_OPTS = [
    { value: '', label: 'Any status' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'client_review', label: 'Client review' },
    { value: 'selected', label: 'Selected' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'offer_released', label: 'Offer released' },
    { value: 'offer_accepted', label: 'Offer accepted' },
    { value: 'offer_declined', label: 'Offer declined' },
    { value: 'deployed', label: 'Deployed' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded border border-app-border bg-app-surface px-2 text-xs text-app-text focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          className="min-h-8 gap-1 px-2 text-xs"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
        </Button>
        {canSendToClient && (
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              className="min-h-8 gap-1 px-2 text-xs"
              disabled={bulkBusy || loading}
              onClick={() => void handleBulkSend()}
            >
              <SendHorizontal className="h-3.5 w-3.5" aria-hidden />
              {bulkBusy ? 'Sending…' : 'Send shortlisted to client'}
            </Button>
          </div>
        )}
      </div>

      {bulkResult ? (
        <InlineSuccess
          message={`Sent: ${bulkResult.sent}, already sent / skipped: ${bulkResult.skipped}`}
        />
      ) : null}
      {bulkError ? <p className="text-xs text-status-danger">{bulkError}</p> : null}

      {error ? <ErrorState message={error} /> : null}
      {loading ? <Spinner label="Loading applications…" /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="No applications"
          description="Shortlist candidates from the pool to start applications for this demand."
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-panel border border-app-border bg-app-surface shadow-panel">
          <Table>
            <THead>
              <TR>
                <TH className="py-2">Candidate</TH>
                <TH className="py-2">Stage</TH>
                <TH className="py-2">Status</TH>
                <TH className="py-2">Client</TH>
                <TH className="py-2">Decision</TH>
                <TH className="py-2">Offer</TH>
                <TH className="py-2 text-right"> </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((app) => {
                const busy = sendingId === app.id
                const sent = sendSuccess[app.id] ?? false
                const appErr = sendErrors[app.id] ?? ''
                const canSend = canSendToClient && !app.client_visible && app.status !== 'rejected' && app.status !== 'cancelled'
                return (
                  <TR key={app.id}>
                    <TD className="py-2">
                      <p className="text-sm font-medium">{app.candidate_name ?? `Candidate #${app.candidate}`}</p>
                      {app.candidate_phone ? <p className="font-mono text-xs text-app-secondary">{app.candidate_phone}</p> : null}
                    </TD>
                    <TD className="py-2 text-xs">{app.current_stage_name ?? '—'}</TD>
                    <TD className="py-2">
                      <Badge variant="neutral" className="text-[11px]">
                        {hiringApplicationStatusLabel(app.status)}
                      </Badge>
                    </TD>
                    <TD className="py-2 text-xs">
                      {app.client_visible ? (
                        <Badge variant="info" className="text-[11px]">Visible</Badge>
                      ) : (
                        <span className="text-app-subtle">—</span>
                      )}
                    </TD>
                    <TD className="py-2">
                      {app.client_decision ? (
                        <Badge variant={decisionVariant(app.client_decision)} className="text-[11px]">
                          {app.client_decision}
                        </Badge>
                      ) : <span className="text-xs text-app-subtle">—</span>}
                    </TD>
                    <TD className="py-2 text-xs">
                      {app.offer_status ? (
                        <Badge variant="neutral" className="text-[11px]">{app.offer_status}</Badge>
                      ) : <span className="text-app-subtle">—</span>}
                    </TD>
                    <TD className="py-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-1">
                          {canSend && !sent ? (
                            <Button
                              type="button"
                              variant="secondary"
                              className="min-h-7 gap-1 px-2 text-xs"
                              disabled={busy || sendingId != null}
                              onClick={() => void handleSendToClient(app.id)}
                            >
                              <SendHorizontal className="h-3 w-3" aria-hidden />
                              {busy ? 'Sending…' : 'Send to client'}
                            </Button>
                          ) : null}
                          {sent ? <Badge variant="success" className="text-[11px]">Sent</Badge> : null}
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-7 px-2 text-xs"
                            onClick={() => navigate(`/hiring/applications/${app.id}`)}
                          >
                            Open
                          </Button>
                        </div>
                        {appErr ? <InlineError message={appErr} /> : null}
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
          {count != null ? <p className="px-3 py-2 text-xs text-app-subtle">Total: {count}</p> : null}
        </div>
      ) : null}
    </div>
  )
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export function HiringDemandDetailPage() {
  const { id } = useParams<{ id: string }>()
  const demandId = id ? Number(id) : NaN
  const meCaps = useAuthStore((s) => s.me?.capabilities ?? [])
  const canShortlist = hasAnyCapability(meCaps, [CAP.HIRING_APPLICATION_CREATE])
  const canSendToClient = hasAnyCapability(meCaps, [CAP.HIRING_APPLICATION_UPDATE])

  const [demand, setDemand] = useState<HiringDemandRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'pool' | 'apps'>('pool')
  const [poolRefreshKey, setPoolRefreshKey] = useState(0)

  useEffect(() => {
    if (!Number.isFinite(demandId)) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const d = await getHiringDemand(demandId)
        if (!cancelled) setDemand(d)
      } catch (e: unknown) {
        if (!cancelled) setError(parseApiError(e, 'Could not load demand').message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [demandId])

  if (!Number.isFinite(demandId)) {
    return <ErrorState message="Invalid demand ID." />
  }

  if (loading) return <Spinner label="Loading demand…" />
  if (error) return <ErrorState message={error} />
  if (!demand) return null

  const TABS: { id: 'pool' | 'apps'; label: string }[] = [
    { id: 'pool', label: 'Candidate pool' },
    { id: 'apps', label: 'Applications' },
  ]

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/hiring/demands"
          className="flex items-center gap-1 text-xs text-app-secondary hover:text-app-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Hiring demands
        </Link>
      </div>

      <DemandSummary demand={demand} />

      <div className="flex gap-0 border-b border-app-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-app-secondary hover:text-app-text',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pool' ? (
        <CandidatePoolTab
          key={poolRefreshKey}
          demandId={demandId}
          canShortlist={canShortlist}
          onShortlisted={() => {
            setTab('apps')
            setPoolRefreshKey((k) => k + 1)
          }}
        />
      ) : (
        <ApplicationsTab
          demand={demand}
          canSendToClient={canSendToClient}
        />
      )}
    </div>
  )
}
