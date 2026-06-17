import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getRankedCandidatePool, shortlistCandidateForDemand } from '@/api/hiring'
import type { RankedCandidatePoolParams } from '@/api/hiring'
import { listJobRoles, type JobRoleRow } from '@/api/jobs'
import { parseApiError } from '@/lib/apiError'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { CandidateMatchScorecard } from '@/features/hiring/CandidateMatchScorecard'
import { matchStatusBadgeVariant } from '@/features/hiring/matchScoreLabels'
import { poolRowToScorecard } from '@/features/hiring/matchResultMapper'
import {
  candidateJourneyStatusLabel,
  candidateJourneyStatusVariant,
  isJourneyStatusBlocked,
  sourceTypeLabel,
  sourceTypeVariant,
  availabilityStatusLabel,
  availabilityStatusVariant,
  SOURCE_TYPE_FILTER_OPTIONS,
  DOCUMENT_TYPE_FILTER_OPTIONS,
  JOURNEY_STATUS_FILTER_OPTIONS,
  AVAILABILITY_STATUS_FILTER_OPTIONS,
} from '@/features/talent/talentLabels'
import {
  hasLaneInfo,
  hiringLaneBadgeLabel,
  requiresClientReview,
} from '@/features/hiring/hiringLaneLabels'
import type { CandidatePoolResultRow, HiringDemandRow, PoolCandidateSummary } from '@/features/hiring/types'

function displayName(c: PoolCandidateSummary): string {
  if (c.full_name?.trim()) return c.full_name.trim()
  return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ')
}

function formatExp(y: string | number | null | undefined): string {
  if (y == null || y === '') return '-'
  return String(y)
}

function lifecycleLabel(s: string | null | undefined): string {
  if (!s) return '-'
  return s.replace(/_/g, ' ')
}

function defaultLocation(demand: HiringDemandRow): string {
  return demand.site_name?.trim() || demand.client_name?.trim() || ''
}

export function ResumePoolDrawer({
  open,
  demand,
  onClose,
  onLinked,
}: {
  open: boolean
  demand: HiringDemandRow | null
  onClose: () => void
  onLinked: () => void
}) {
  // Primary filters
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('')
  const [skill, setSkill] = useState('')
  const [minExperience, setMinExperience] = useState('')
  const [maxExperience, setMaxExperience] = useState('')

  // Advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [documentType, setDocumentType] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [targetJobRole, setTargetJobRole] = useState<number | ''>('')
  const [availabilityStatus, setAvailabilityStatus] = useState('')
  const [journeyStatus, setJourneyStatus] = useState('')

  // Job roles for dropdown
  const [jobRoles, setJobRoles] = useState<JobRoleRow[]>([])

  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CandidatePoolResultRow[]>([])
  const [count, setCount] = useState<number | undefined>(undefined)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const [linkingId, setLinkingId] = useState<number | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkedAppId, setLinkedAppId] = useState<number | null>(null)

  // Load job roles for mapped role filter
  useEffect(() => {
    void (async () => {
      try {
        const res = await listJobRoles({ is_active: true })
        setJobRoles(res.items)
      } catch {
        // Silently ignore
      }
    })()
  }, [])

  const resetFilters = useCallback((d: HiringDemandRow) => {
    setSearch('')
    setLocation(defaultLocation(d))
    setSkill('')
    setMinExperience('')
    setMaxExperience('')
    setDocumentType('')
    setSourceType('')
    setTargetJobRole('')
    setAvailabilityStatus('')
    setJourneyStatus('')
  }, [])

  useEffect(() => {
    if (!open || !demand) return
    resetFilters(demand)
    setSearched(false)
    setError(null)
    setRows([])
    setCount(undefined)
    setExpandedId(null)
    setLinkError(null)
    setLinkedAppId(null)
    setLinkingId(null)
  }, [open, demand, resetFilters])

  async function runSearch(page = 1) {
    if (!demand) return
    setLoading(true)
    setError(null)
    setLinkError(null)
    setLinkedAppId(null)
    try {
      const params: RankedCandidatePoolParams = { page }
      if (search.trim()) params.search = search.trim()
      if (location.trim()) params.location = location.trim()
      if (skill.trim()) params.skills = skill.trim()
      if (minExperience.trim()) params.min_experience = minExperience.trim()
      if (maxExperience.trim()) params.max_experience = maxExperience.trim()
      if (documentType) params.document_type = documentType
      if (sourceType) params.source_type = sourceType
      if (targetJobRole) params.target_job_role = targetJobRole
      if (availabilityStatus) params.availability_status = availabilityStatus
      if (journeyStatus) params.journey_status = journeyStatus
      const res = await getRankedCandidatePool(demand.id, params)
      setRows(res.items)
      setCount(res.count)
      setSearched(true)
    } catch (e: unknown) {
      setError(parseApiError(e, 'Could not search resume pool').message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function clearFilters() {
    if (demand) resetFilters(demand)
    setSearched(false)
    setError(null)
    setRows([])
    setCount(undefined)
    setExpandedId(null)
    setLinkError(null)
    setLinkedAppId(null)
  }

  async function linkCandidate(row: CandidatePoolResultRow) {
    if (!demand) return
    const candidate = row.candidate
    if (!Number.isFinite(candidate.id)) {
      setLinkError('Candidate id is missing from the pool result. Refresh the search and try again.')
      return
    }
    if (row.match_result == null) {
      setLinkError('Scorecard was not saved. Refresh candidate pool and try again.')
      return
    }
    setLinkingId(candidate.id)
    setLinkError(null)
    setLinkedAppId(null)
    try {
      const app = await shortlistCandidateForDemand(demand.id, {
        candidate: candidate.id,
        match_result: row.match_result,
      })
      setLinkedAppId(app.id)
      onLinked()
    } catch (e: unknown) {
      setLinkError(parseApiError(e, 'Could not link candidate').message)
    } finally {
      setLinkingId(null)
    }
  }

  const busy = loading || linkingId != null
  const laneLabel = demand && hasLaneInfo(demand) ? hiringLaneBadgeLabel(demand) : null
  const demandSummary = demand
    ? `${demand.job_role_name ?? 'Role'} | ${demand.site_name ?? 'Site'}${demand.client_name ? ` | ${demand.client_name}` : ''}${laneLabel ? ` | ${laneLabel}` : ''}`
    : ''
  const needsClientReview = demand ? requiresClientReview(demand) : false

  return (
    <Drawer
      open={open}
      onClose={() => !busy && onClose()}
      title="Find from resume pool"
      description="Search uploaded candidates and link the best match to this hiring demand."
      footer={
        <PoolDrawerFooter onClose={onClose} busy={busy} />
      }
    >
      {demand ? <p className="mb-4 text-xs text-app-secondary">{demandSummary}</p> : null}

      <div className="space-y-4">
        {/* Primary filters */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input id="pool_search" label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, or keyword" />
          <Input id="pool_loc" label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Input id="pool_skill" label="Skill" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. housekeeping" />
          <Input
            id="pool_min_exp"
            label="Min experience (years)"
            value={minExperience}
            onChange={(e) => setMinExperience(e.target.value)}
          />
          <Input
            id="pool_max_exp"
            label="Max experience (years)"
            value={maxExperience}
            onChange={(e) => setMaxExperience(e.target.value)}
          />
        </div>

        {/* Advanced filters toggle */}
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-app-secondary hover:text-app-text"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showAdvanced ? 'Hide advanced filters' : 'Show advanced filters'}
        </button>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="grid gap-3 sm:grid-cols-2 border-t border-app-border pt-3">
            <div>
              <label htmlFor="pool_doc_type" className="block text-xs font-medium text-app-secondary mb-1">Document type</label>
              <select
                id="pool_doc_type"
                className="h-9 w-full rounded border border-app-border bg-app-surface px-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                {DOCUMENT_TYPE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pool_source_type" className="block text-xs font-medium text-app-secondary mb-1">Source type</label>
              <select
                id="pool_source_type"
                className="h-9 w-full rounded border border-app-border bg-app-surface px-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
              >
                {SOURCE_TYPE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pool_mapped_role" className="block text-xs font-medium text-app-secondary mb-1">Mapped role</label>
              <select
                id="pool_mapped_role"
                className="h-9 w-full rounded border border-app-border bg-app-surface px-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={targetJobRole}
                onChange={(e) => setTargetJobRole(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">All roles</option>
                {jobRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pool_availability" className="block text-xs font-medium text-app-secondary mb-1">Availability</label>
              <select
                id="pool_availability"
                className="h-9 w-full rounded border border-app-border bg-app-surface px-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={availabilityStatus}
                onChange={(e) => setAvailabilityStatus(e.target.value)}
              >
                {AVAILABILITY_STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pool_journey" className="block text-xs font-medium text-app-secondary mb-1">Journey status</label>
              <select
                id="pool_journey"
                className="h-9 w-full rounded border border-app-border bg-app-surface px-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={journeyStatus}
                onChange={(e) => setJourneyStatus(e.target.value)}
              >
                {JOURNEY_STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void runSearch()} disabled={!demand || busy}>
            Search
          </Button>
          <Button type="button" variant="secondary" onClick={clearFilters} disabled={busy}>
            Clear filters
          </Button>
        </div>

        {error ? <ErrorState message={error} /> : null}
        {linkError ? <ErrorState message={linkError} /> : null}

        {linkedAppId != null ? (
          <div className="rounded-panel border border-status-success/30 bg-status-success/5 p-3 text-sm">
            <p className="font-medium text-status-success">Candidate linked to this hiring demand.</p>
            <p className="mt-1 text-xs text-app-secondary">
              {needsClientReview
                ? 'Next: Send to client for review from the demand page.'
                : 'Next: Proceed with interview/offer process.'}
            </p>
            <p className="mt-2">
              <Link className="font-medium text-brand-700 underline" to={`/hiring/applications/${linkedAppId}`}>
                Open application
              </Link>
            </p>
          </div>
        ) : null}

        {loading ? <Spinner label="Searching resume pool..." /> : null}

        {!loading && searched && rows.length === 0 && !error ? (
          <EmptyState title="No matching candidates found in the resume pool." />
        ) : null}

        {!loading && rows.length > 0 ? (
          <ul className="space-y-3">
            {rows.map((c) => {
              const journeyBlocked = isJourneyStatusBlocked(c.candidate.journey_status)
              const showJourneyBadge = c.candidate.journey_status && c.candidate.journey_status !== 'unknown'

              return (
                <li key={c.candidate.id} className="rounded-panel border border-app-border bg-app-muted/50 p-3">
                  {/* Warning for blocked journey status */}
                  {journeyBlocked && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        This candidate is{' '}
                        <strong>{candidateJourneyStatusLabel(c.candidate.journey_status, c.candidate.journey_status_label).toLowerCase()}</strong>.
                        Shortlisting may not be appropriate.
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-app-text">{displayName(c.candidate)}</p>
                      <p className="mt-0.5 font-mono text-xs text-app-secondary">{c.candidate.phone}</p>
                      <p className="mt-1 text-xs text-app-secondary">
                        {c.candidate.current_role?.trim() || '-'} | {c.candidate.current_location?.trim() || '-'} | {formatExp(c.candidate.total_experience_years)} yrs
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {/* Source type badge */}
                        {c.candidate.latest_source_type && (
                          <Badge variant={sourceTypeVariant(c.candidate.latest_source_type)}>
                            {sourceTypeLabel(c.candidate.latest_source_type)}
                          </Badge>
                        )}
                        {/* Journey status badge */}
                        {showJourneyBadge && (
                          <Badge variant={candidateJourneyStatusVariant(c.candidate.journey_status)}>
                            {candidateJourneyStatusLabel(c.candidate.journey_status, c.candidate.journey_status_label)}
                          </Badge>
                        )}
                        {c.candidate.lifecycle_status ? <Badge variant="neutral">{lifecycleLabel(c.candidate.lifecycle_status)}</Badge> : null}
                        {c.candidate.availability_status && (
                          <Badge variant={availabilityStatusVariant(c.candidate.availability_status)}>
                            {availabilityStatusLabel(c.candidate.availability_status)}
                          </Badge>
                        )}
                        {(c.candidate.skills_count ?? 0) > 0 ? <Badge variant="neutral">{c.candidate.skills_count} skills</Badge> : null}
                        {c.match_status ? <Badge variant={matchStatusBadgeVariant(c.match_status)}>{c.match_status}</Badge> : null}
                        {c.score != null ? <Badge variant="neutral">Score {Math.round(c.score)}</Badge> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-8 text-xs"
                        onClick={() => setExpandedId(expandedId === c.candidate.id ? null : c.candidate.id)}
                      >
                        {expandedId === c.candidate.id ? 'Hide scorecard' : 'View scorecard'}
                      </Button>
                      <Button
                        type="button"
                        className="min-h-8 text-xs"
                        disabled={busy || linkedAppId != null}
                        onClick={() => void linkCandidate(c)}
                      >
                        {linkingId === c.candidate.id ? 'Linking...' : 'Link to demand'}
                      </Button>
                    </div>
                  </div>
                  {expandedId === c.candidate.id ? (
                    <div className="mt-3">
                      <CandidateMatchScorecard data={poolRowToScorecard(c)} compact />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}

        {count != null && rows.length > 0 ? (
          <p className="text-xs text-app-subtle">Showing {rows.length} of {count} matches.</p>
        ) : null}
      </div>
    </Drawer>
  )
}

function PoolDrawerFooter({ onClose, busy }: { onClose: () => void; busy: boolean }) {
  return (
    <div className="flex justify-end">
      <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
        Close
      </Button>
    </div>
  )
}
