import { useEffect, useMemo, useState } from 'react'
import { FileText, Search, UserPlus } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listCandidates } from '@/api/talent'
import { useAuthStore } from '@/features/auth/authStore'
import { CAP, hasAnyCapability } from '@/lib/capabilities'
import { parseApiError } from '@/lib/apiError'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { ManualResumeIntakeDrawer } from '@/features/talent/ManualResumeIntakeDrawer'
import { resumeStatusLabel } from '@/features/talent/talentLabels'
import type { CandidateRow } from '@/features/talent/types'

function parsePage(v: string | null): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.floor(n)
}

function displayName(c: CandidateRow): string {
  if (c.full_name?.trim()) return c.full_name.trim()
  return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ')
}

function formatExp(y: string | number | null | undefined): string | null {
  if (y == null || y === '') return null
  return String(y)
}

function resumeDocFilename(c: CandidateRow): string {
  const slug = displayName(c)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
  if (slug) return `${slug}_Resume.pdf`
  return `Resume_${c.id}.pdf`
}

function hasResumeFile(c: CandidateRow): boolean {
  return (c.resume_count ?? 0) > 0 || Boolean(c.latest_resume_status)
}

const LIFECYCLE_OPTS = [
  { value: '', label: 'Any lifecycle' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blacklisted', label: 'Blacklisted' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'employee_converted', label: 'Employee converted' },
  { value: 'do_not_contact', label: 'Do not contact' },
]

const AVAILABILITY_OPTS = [
  { value: '', label: 'Any availability' },
  { value: 'available_now', label: 'Available now' },
  { value: 'available_from_date', label: 'Available from date' },
  { value: 'currently_deployed', label: 'Currently deployed' },
  { value: 'notice_period', label: 'Notice period' },
  { value: 'not_available', label: 'Not available' },
  { value: 'unknown', label: 'Unknown' },
]

function PoolDocumentCard({ c, onOpen }: { c: CandidateRow; onOpen: () => void }) {
  const name = displayName(c)
  const exp = formatExp(c.total_experience_years)
  const stored = hasResumeFile(c)
  const status = c.latest_resume_status ? resumeStatusLabel(c.latest_resume_status) : stored ? 'On file' : 'No file'

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-full flex-col overflow-hidden rounded-panel border border-app-border bg-app-surface text-left shadow-panel',
        'transition-all hover:border-brand-500/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg',
      )}
    >
      <div
        className={cn(
          'relative flex aspect-[4/3] flex-col items-center justify-center border-b border-app-border px-4 py-6',
          stored
            ? 'bg-gradient-to-b from-red-50/90 via-app-muted to-app-surface dark:from-red-950/30 dark:via-app-muted dark:to-app-surface'
            : 'border-dashed bg-app-muted/60',
        )}
      >
        <div
          className={cn(
            'flex h-16 w-14 flex-col items-center justify-center rounded-md border shadow-sm',
            stored ? 'border-red-200/80 bg-white dark:border-red-900/50 dark:bg-app-surface' : 'border-app-border bg-app-surface',
          )}
        >
          <FileText
            className={cn('h-8 w-8', stored ? 'text-red-600/80 dark:text-red-400/80' : 'text-app-subtle')}
            strokeWidth={1.5}
            aria-hidden
          />
          <span
            className={cn(
              'mt-0.5 text-[9px] font-bold uppercase tracking-wider',
              stored ? 'text-red-700/90 dark:text-red-300/90' : 'text-app-subtle',
            )}
          >
            {stored ? 'PDF' : '-'}
          </span>
        </div>
        <Badge variant="neutral" className="absolute right-2 top-2 text-[10px]">
          {status}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <p className="truncate font-mono text-xs font-medium text-app-text" title={resumeDocFilename(c)}>
            {resumeDocFilename(c)}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-app-text">{name}</p>
        </div>
        <p className="line-clamp-2 text-xs text-app-secondary">
          {[c.current_role?.trim(), c.current_location?.trim()].filter(Boolean).join(' | ') || 'Role and location not set'}
          {exp ? ` | ${exp} yrs` : ''}
        </p>
        <p className="truncate font-mono text-[11px] text-app-subtle">{c.phone}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {(c.skills_count ?? 0) > 0 ? (
            <Badge variant="neutral" className="text-[10px]">
              {c.skills_count} skills
            </Badge>
          ) : null}
          {(c.resume_count ?? 0) > 1 ? (
            <Badge variant="neutral" className="text-[10px]">
              {c.resume_count} files
            </Badge>
          ) : null}
        </div>
        <p className="text-[11px] font-medium text-brand-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-300">
          Open profile -&gt;
        </p>
      </div>
    </button>
  )
}

export function CandidatesListPage() {
  const meCaps = useAuthStore((s) => s.me?.capabilities ?? [])
  const canCreate = hasAnyCapability(meCaps, [CAP.CANDIDATE_CREATE])
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const skill = params.get('skill') ?? ''
  const currentRole = params.get('current_role') ?? ''
  const currentLocation = params.get('current_location') ?? ''
  const lifecycle = params.get('lifecycle_status') ?? ''
  const availability = params.get('availability_status') ?? ''
  const page = parsePage(params.get('page'))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CandidateRow[]>([])
  const [count, setCount] = useState<number | undefined>(undefined)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await listCandidates({
          search: search.trim() || undefined,
          skill: skill.trim() || undefined,
          lifecycle_status: lifecycle || undefined,
          availability_status: availability || undefined,
          page,
        })
        if (cancelled) return
        setRows(res.items)
        setCount(res.count)
      } catch (e: unknown) {
        if (!cancelled) setError(parseApiError(e, 'Could not load resume pool').message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [search, skill, lifecycle, availability, page, refreshKey])

  const filtered = useMemo(() => {
    const rl = currentRole.trim().toLowerCase()
    const ll = currentLocation.trim().toLowerCase()
    if (!rl && !ll) return rows
    return rows.filter((c) => {
      const okRole = !rl || (c.current_role ?? '').toLowerCase().includes(rl)
      const okLoc = !ll || (c.current_location ?? '').toLowerCase().includes(ll)
      return okRole && okLoc
    })
  }, [rows, currentRole, currentLocation])

  function setField(key: string, value: string) {
    const p = new URLSearchParams(params)
    if (value) p.set(key, value)
    else p.delete(key)
    p.set('page', '1')
    setParams(p, { replace: true })
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app-text">Resume pool</h2>
          <p className="text-sm text-app-secondary">
            Stored resume documents tagged to candidates. Open a file to view profile and hiring details.
          </p>
        </div>
        {canCreate ? (
          <Button type="button" className="min-h-9 shrink-0 gap-2" onClick={() => setIntakeOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Add to resume pool
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded-panel border border-app-border bg-app-surface p-3 shadow-panel">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" aria-hidden />
          <input
            type="search"
            placeholder="Search resumes, names, phone, role..."
            value={search}
            onChange={(e) => setField('search', e.target.value)}
            className="w-full rounded-panel border border-app-border bg-app-muted py-2 pl-9 pr-3 text-sm text-app-text placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input id="cand_skill" label="Skill" value={skill} onChange={(e) => setField('skill', e.target.value)} placeholder="e.g. housekeeping" />
          <Input id="cand_role" label="Role" value={currentRole} onChange={(e) => setField('current_role', e.target.value)} placeholder="Filter this page" />
          <Input id="cand_loc" label="Location" value={currentLocation} onChange={(e) => setField('current_location', e.target.value)} placeholder="Filter this page" />
          <Select id="cand_life" label="Lifecycle" value={lifecycle} onChange={(e) => setField('lifecycle_status', e.target.value)}>
            {LIFECYCLE_OPTS.map((o) => (
              <option key={o.value || 'any'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select id="cand_avail" label="Availability" value={availability} onChange={(e) => setField('availability_status', e.target.value)}>
            {AVAILABILITY_OPTS.map((o) => (
              <option key={o.value || 'any-a'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-app-subtle">Role and location filter the current page. Search and skill match the full pool.</p>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <Spinner label="Loading documents..." /> : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="No resumes in the pool yet."
            description="Upload resumes and tag candidates to start building the hiring pool."
          />
          {canCreate ? (
            <div className="flex justify-center">
              <Button type="button" className="min-h-9 gap-2" onClick={() => setIntakeOpen(true)}>
                <UserPlus className="h-4 w-4" aria-hidden />
                Add to resume pool
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <>
          <p className="text-xs text-app-subtle">
            {filtered.length} document{filtered.length === 1 ? '' : 's'}
            {count != null && count > filtered.length ? ` on this page (${count} total)` : ''}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((c) => (
              <PoolDocumentCard key={c.id} c={c} onOpen={() => navigate(`/candidates/${c.id}`)} />
            ))}
          </div>
        </>
      ) : null}

      <ManualResumeIntakeDrawer
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onSuccess={() => {
          setRefreshKey((k) => k + 1)
        }}
      />
    </div>
  )
}
