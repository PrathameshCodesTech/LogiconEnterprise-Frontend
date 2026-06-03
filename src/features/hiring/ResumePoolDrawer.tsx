import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createHiringApplication, listDemandCandidatePool } from '@/api/hiring'
import { parseApiError } from '@/lib/apiError'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import type { HiringDemandRow } from '@/features/hiring/types'
import type { CandidateRow } from '@/features/talent/types'

function displayName(c: CandidateRow): string {
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

function defaultRole(demand: HiringDemandRow): string {
  return demand.job_role_name?.trim() || ''
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
  const [role, setRole] = useState('')
  const [location, setLocation] = useState('')
  const [skill, setSkill] = useState('')
  const [minExperience, setMinExperience] = useState('')
  const [maxExperience, setMaxExperience] = useState('')

  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CandidateRow[]>([])
  const [count, setCount] = useState<number | undefined>(undefined)

  const [linkingId, setLinkingId] = useState<number | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkedAppId, setLinkedAppId] = useState<number | null>(null)

  const resetFilters = useCallback((d: HiringDemandRow) => {
    setRole(defaultRole(d))
    setLocation(defaultLocation(d))
    setSkill('')
    setMinExperience('')
    setMaxExperience('')
  }, [])

  useEffect(() => {
    if (!open || !demand) return
    resetFilters(demand)
    setSearched(false)
    setError(null)
    setRows([])
    setCount(undefined)
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
      const res = await listDemandCandidatePool(demand.id, {
        role: role.trim() || undefined,
        location: location.trim() || undefined,
        skill: skill.trim() || undefined,
        min_experience: minExperience.trim() || undefined,
        max_experience: maxExperience.trim() || undefined,
        page,
      })
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
    setLinkError(null)
    setLinkedAppId(null)
  }

  async function linkCandidate(candidate: CandidateRow) {
    if (!demand) return
    setLinkingId(candidate.id)
    setLinkError(null)
    setLinkedAppId(null)
    try {
      const app = await createHiringApplication({
        candidate: candidate.id,
        mrf_line_item: demand.id,
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
  const demandSummary = demand
    ? `${demand.job_role_name ?? 'Role'} | ${demand.site_name ?? 'Site'}${demand.client_name ? ` | ${demand.client_name}` : ''}`
    : ''

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
        <div className="grid gap-3 sm:grid-cols-2">
          <Input id="pool_role" label="Role" value={role} onChange={(e) => setRole(e.target.value)} />
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
            {rows.map((c) => (
              <li key={c.id} className="rounded-panel border border-app-border bg-app-muted/50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-app-text">{displayName(c)}</p>
                    <p className="mt-0.5 font-mono text-xs text-app-secondary">{c.phone}</p>
                    <p className="mt-1 text-xs text-app-secondary">
                      {c.current_role?.trim() || '-'} | {c.current_location?.trim() || '-'} | {formatExp(c.total_experience_years)} yrs
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.lifecycle_status ? <Badge variant="neutral">{lifecycleLabel(c.lifecycle_status)}</Badge> : null}
                      {c.availability_status ? <Badge variant="neutral">{lifecycleLabel(c.availability_status)}</Badge> : null}
                      {(c.skills_count ?? 0) > 0 ? <Badge variant="neutral">{c.skills_count} skills</Badge> : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="min-h-8 shrink-0 text-xs"
                    disabled={busy || linkedAppId != null}
                    onClick={() => void linkCandidate(c)}
                  >
                    {linkingId === c.id ? 'Linking...' : 'Link to demand'}
                  </Button>
                </div>
              </li>
            ))}
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
