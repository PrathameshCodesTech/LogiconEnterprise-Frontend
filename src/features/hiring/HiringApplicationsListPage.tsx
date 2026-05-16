import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listHiringApplications } from '@/api/hiring'
import { listJobRoles, type JobRoleRow } from '@/api/jobs'
import { listSites, type SiteProfileRow } from '@/api/sites'
import { parseApiError } from '@/lib/apiError'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { hiringApplicationStatusLabel, HIRING_APPLICATION_STATUS_OPTIONS } from '@/features/talent/talentLabels'
import type { HiringApplicationRow } from '@/features/hiring/types'

function parseNum(v: string | null): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function parsePage(v: string | null): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.floor(n)
}

export function HiringApplicationsListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const site = parseNum(params.get('site'))
  const job_role = parseNum(params.get('job_role'))
  const search = params.get('search') ?? ''
  const page = parsePage(params.get('page'))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<HiringApplicationRow[]>([])
  const [count, setCount] = useState<number | undefined>(undefined)

  const [sites, setSites] = useState<SiteProfileRow[]>([])
  const [roles, setRoles] = useState<JobRoleRow[]>([])
  const [lookupsLoading, setLookupsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLookupsLoading(true)
      try {
        const [sRes, rRes] = await Promise.all([
          listSites({ page: 1 }),
          listJobRoles({ is_active: true, page: 1 }),
        ])
        if (!cancelled) {
          setSites(sRes.items)
          setRoles(rRes.items)
        }
      } catch {
        if (!cancelled) {
          setSites([])
          setRoles([])
        }
      } finally {
        if (!cancelled) setLookupsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await listHiringApplications({
          status: status || undefined,
          site,
          job_role,
          search: search.trim() || undefined,
          page,
        })
        if (!cancelled) {
          setRows(res.items)
          setCount(res.count)
        }
      } catch (e: unknown) {
        if (!cancelled) setError(parseApiError(e, 'Could not load applications').message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, site, job_role, search, page])

  function setField(key: string, value: string) {
    const p = new URLSearchParams(params)
    if (value) p.set(key, value)
    else p.delete(key)
    p.set('page', '1')
    setParams(p, { replace: true })
  }

  const statusOptions = useMemo(() => [{ value: '', label: 'Any status' }, ...HIRING_APPLICATION_STATUS_OPTIONS], [])

  return (
    <div className="w-full space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-app-text">Applications</h2>
        <p className="text-sm text-app-secondary">Track candidates against hiring demands and pipeline stages.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-panel border border-app-border bg-app-surface p-3 shadow-panel">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" aria-hidden />
          <input
            type="search"
            placeholder="Search candidate name or phone…"
            value={search}
            onChange={(e) => setField('search', e.target.value)}
            className="w-full rounded-panel border border-app-border bg-app-muted py-2 pl-9 pr-3 text-sm text-app-text placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select id="ha_status" label="Status" value={status} onChange={(e) => setField('status', e.target.value)} disabled={lookupsLoading}>
            {statusOptions.map((o) => (
              <option key={o.value || 'any'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select id="ha_site" label="Site" value={site != null ? String(site) : ''} onChange={(e) => setField('site', e.target.value)}>
            <option value="">Any site</option>
            {sites.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select id="ha_role" label="Job role" value={job_role != null ? String(job_role) : ''} onChange={(e) => setField('job_role', e.target.value)}>
            <option value="">Any role</option>
            {roles.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <Spinner label="Loading applications…" /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="No applications" description="Try changing filters or add a candidate from hiring demands." />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <THead>
                <TR>
                  <TH className="py-2">Candidate</TH>
                  <TH className="py-2">Site / client</TH>
                  <TH className="py-2">Job role</TH>
                  <TH className="py-2">MRF</TH>
                  <TH className="py-2">Pipeline stage</TH>
                  <TH className="py-2">Status</TH>
                  <TH className="py-2">Created</TH>
                  <TH className="py-2 text-right"> </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((a) => (
                  <TR key={a.id}>
                    <TD className="py-2 text-sm font-medium">{a.candidate_name ?? `Candidate #${a.candidate}`}</TD>
                    <TD className="py-2 text-xs text-app-secondary">
                      {a.site_name ?? `Site #${a.site}`}
                      {a.client_name ? ` · ${a.client_name}` : null}
                    </TD>
                    <TD className="py-2 text-xs">{a.job_role_name ?? `Role #${a.job_role}`}</TD>
                    <TD className="py-2 font-mono text-xs">#{a.mrf}</TD>
                    <TD className="py-2 text-xs">{a.current_stage_name ?? '—'}</TD>
                    <TD className="py-2 text-xs">{hiringApplicationStatusLabel(a.status)}</TD>
                    <TD className="py-2 text-xs text-app-secondary">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : '—'}
                    </TD>
                    <TD className="py-2 text-right">
                      <Button type="button" variant="secondary" className="min-h-8 px-2" onClick={() => navigate(`/hiring-applications/${a.id}`)}>
                        Open
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {rows.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/hiring-applications/${a.id}`)}
                className="w-full rounded-panel border border-app-border bg-app-surface p-3 text-left shadow-panel transition-colors hover:border-brand-500/40"
              >
                <p className="font-medium text-app-text">{a.candidate_name ?? `Candidate #${a.candidate}`}</p>
                <p className="mt-1 text-xs text-app-secondary">
                  {a.job_role_name} · {a.site_name}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="text-app-subtle">Stage:</span> {a.current_stage_name ?? '—'}
                  <span className="text-app-subtle">·</span>
                  {hiringApplicationStatusLabel(a.status)}
                </div>
              </button>
            ))}
          </div>

          {count != null ? <p className="text-xs text-app-subtle">Total: {count}</p> : null}
        </>
      ) : null}
    </div>
  )
}
