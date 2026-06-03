import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getCandidate,
  listCandidateEducations,
  listCandidateExperiences,
  listResumes,
} from '@/api/talent'
import { listHiringApplications } from '@/api/hiring'
import { parseApiError } from '@/lib/apiError'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { ResumeFileActions } from '@/features/talent/ResumeFileActions'
import { hiringApplicationStatusLabel, resumeStatusLabel } from '@/features/talent/talentLabels'
import type { HiringApplicationRow } from '@/features/hiring/types'
import type { CandidateEducationRow, CandidateExperienceRow, CandidateRow, ResumeRow } from '@/features/talent/types'

function displayName(c: CandidateRow): string {
  if (c.full_name?.trim()) return c.full_name.trim()
  return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ')
}

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const cid = Number(id)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<CandidateRow | null>(null)
  const [resumes, setResumes] = useState<ResumeRow[]>([])
  const [experiences, setExperiences] = useState<CandidateExperienceRow[]>([])
  const [educations, setEducations] = useState<CandidateEducationRow[]>([])
  const [applications, setApplications] = useState<HiringApplicationRow[]>([])

  const validId = useMemo(() => Number.isFinite(cid) && cid > 0, [cid])

  useEffect(() => {
    if (!validId) {
      setError('Invalid candidate.')
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [c, res, exp, edu] = await Promise.all([
          getCandidate(cid),
          listResumes({ candidate: cid }),
          listCandidateExperiences({ candidate: cid }),
          listCandidateEducations({ candidate: cid }),
        ])
        if (cancelled) return
        setRow(c)
        setResumes(res.items)
        setExperiences(exp.items)
        setEducations(edu.items)
        const phone = (c.phone ?? '').trim()
        const appSearch = phone.length >= 6 ? phone : displayName(c)
        const apps = await listHiringApplications({ search: appSearch })
        if (cancelled) return
        setApplications(apps.items.filter((a) => a.candidate === cid))
      } catch (e: unknown) {
        if (!cancelled) setError(parseApiError(e, 'Could not load candidate').message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cid, validId])

  if (!validId) return <ErrorState message="Invalid candidate id." />
  if (loading) return <Spinner label="Loading candidate…" />
  if (error) return <ErrorState message={error} />
  if (!row) return <EmptyState title="Candidate not found" description="This profile may have been removed." />

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-2 border-b border-app-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">Candidates</p>
          <h2 className="text-xl font-semibold tracking-tight text-app-text">{displayName(row)}</h2>
          <p className="mt-1 text-sm text-app-secondary">
            {row.phone}
            {row.email?.trim() ? ` · ${row.email}` : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {row.lifecycle_status ? <Badge variant="neutral">{row.lifecycle_status.replace(/_/g, ' ')}</Badge> : null}
            {row.availability_status ? <Badge variant="neutral">{row.availability_status.replace(/_/g, ' ')}</Badge> : null}
          </div>
        </div>
        <Link
          to="/candidates"
          className={cn(
            'inline-flex min-h-9 shrink-0 items-center justify-center rounded-panel border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-text hover:bg-app-muted',
          )}
        >
          Back to list
        </Link>
      </div>

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Profile summary</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-app-subtle">Current role</dt>
            <dd className="text-right font-medium text-app-text">{row.current_role?.trim() || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-app-subtle">Location</dt>
            <dd className="text-right text-app-text">{row.current_location?.trim() || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-app-subtle">Experience (years)</dt>
            <dd className="text-right text-app-text">{row.total_experience_years != null ? String(row.total_experience_years) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-app-subtle">Company</dt>
            <dd className="text-right text-app-text">{row.current_company?.trim() || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Resume status</p>
        {resumes.length === 0 ? (
          <p className="mt-2 text-sm text-app-secondary">No resume files yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {resumes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-panel border border-app-border bg-app-muted px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-app-text">{r.original_filename || `Resume #${r.id}`}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{resumeStatusLabel(r.status)}</Badge>
                    {r.size_bytes ? (
                      <span className="text-xs text-app-subtle">{Math.round(r.size_bytes / 1024)} KB</span>
                    ) : null}
                    {r.uploaded_at ? (
                      <span className="text-xs text-app-subtle">Uploaded {r.uploaded_at.slice(0, 10)}</span>
                    ) : null}
                  </div>
                </div>
                <ResumeFileActions resume={r} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Skills</p>
        <p className="mt-2 text-sm text-app-secondary">
          Indexed skills on file: <span className="font-medium text-app-text">{row.skills_count ?? 0}</span>. Use candidate search filters to find
          people by skill.
        </p>
      </section>

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Experience</p>
        {experiences.length === 0 ? (
          <p className="mt-2 text-sm text-app-secondary">No experience rows yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH className="py-2">Title</TH>
                  <TH className="py-2">Company</TH>
                  <TH className="py-2">Dates</TH>
                </TR>
              </THead>
              <TBody>
                {experiences.map((x) => (
                  <TR key={x.id}>
                    <TD className="py-2 text-sm">{x.job_title}</TD>
                    <TD className="py-2 text-xs text-app-secondary">{x.company_name ?? '—'}</TD>
                    <TD className="py-2 text-xs text-app-secondary">
                      {(x.start_date ?? '').slice(0, 10)} → {(x.end_date ?? '').slice(0, 10) || (x.is_current ? 'Present' : '—')}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Education</p>
        {educations.length === 0 ? (
          <p className="mt-2 text-sm text-app-secondary">No education rows yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH className="py-2">Degree</TH>
                  <TH className="py-2">Institute</TH>
                  <TH className="py-2">Years</TH>
                </TR>
              </THead>
              <TBody>
                {educations.map((e) => (
                  <TR key={e.id}>
                    <TD className="py-2 text-sm">{e.degree}</TD>
                    <TD className="py-2 text-xs text-app-secondary">{e.institute ?? '—'}</TD>
                    <TD className="py-2 text-xs text-app-secondary">
                      {e.start_year ?? '—'} — {e.end_year ?? '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Applications</p>
        {applications.length === 0 ? (
          <p className="mt-2 text-sm text-app-secondary">No applications linked yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH className="py-2">Role</TH>
                  <TH className="py-2">Site / client</TH>
                  <TH className="py-2">Pipeline stage</TH>
                  <TH className="py-2">Status</TH>
                  <TH className="py-2 text-right"> </TH>
                </TR>
              </THead>
              <TBody>
                {applications.map((a) => (
                  <TR key={a.id}>
                    <TD className="py-2 text-sm">{a.job_role_name ?? `Role #${a.job_role}`}</TD>
                    <TD className="py-2 text-xs text-app-secondary">
                      {a.site_name ?? `Site #${a.site}`}
                      {a.client_name ? ` · ${a.client_name}` : null}
                    </TD>
                    <TD className="py-2 text-xs">{a.current_stage_name ?? '—'}</TD>
                    <TD className="py-2 text-xs">{hiringApplicationStatusLabel(a.status)}</TD>
                    <TD className="py-2 text-right">
                      <Link
                        to={`/hiring/applications/${a.id}`}
                        className="inline-flex min-h-8 items-center justify-center rounded-panel border border-app-border bg-app-surface px-2 text-sm font-medium text-app-text hover:bg-app-muted"
                      >
                        Open
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
