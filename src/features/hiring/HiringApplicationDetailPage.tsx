import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getHiringApplication,
  listCandidateMatchResults,
  listPipelineStages,
  moveHiringApplicationStage,
} from '@/api/hiring'
import { listResumes } from '@/api/talent'
import { useAuthStore } from '@/features/auth/authStore'
import { CAP, hasAnyCapability } from '@/lib/capabilities'
import { parseApiError } from '@/lib/apiError'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { ResumeFileActions } from '@/features/talent/ResumeFileActions'
import {
  hiringApplicationStatusLabel,
  HIRING_APPLICATION_STATUS_OPTIONS,
  resumeStatusLabel,
} from '@/features/talent/talentLabels'
import type { CandidateMatchResultRow, HiringApplicationRow, PipelineStageRow } from '@/features/hiring/types'
import type { ResumeRow } from '@/features/talent/types'

export function HiringApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const appId = Number(id)
  const meCaps = useAuthStore((s) => s.me?.capabilities ?? [])
  const canMove = hasAnyCapability(meCaps, [CAP.HIRING_APPLICATION_UPDATE])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<HiringApplicationRow | null>(null)
  const [stages, setStages] = useState<PipelineStageRow[]>([])
  const [matches, setMatches] = useState<CandidateMatchResultRow[]>([])
  const [resumes, setResumes] = useState<ResumeRow[]>([])

  const [moveStageId, setMoveStageId] = useState('')
  const [moveStatus, setMoveStatus] = useState('')
  const [moveComment, setMoveComment] = useState('')
  const [moveBusy, setMoveBusy] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)

  const loadApplication = useCallback(async () => {
    if (!Number.isFinite(appId) || appId < 1) return
    const app = await getHiringApplication(appId)
    setRow(app)
    const [st, rs] = await Promise.all([listPipelineStages({}), listResumes({ candidate: app.candidate })])
    setStages(st.items.sort((a, b) => a.order - b.order))
    setResumes(rs.items)
    try {
      const mt = await listCandidateMatchResults({ candidate: app.candidate, mrf_line_item: app.mrf_line_item })
      setMatches(mt.items)
    } catch {
      setMatches([])
    }
  }, [appId])

  useEffect(() => {
    if (!Number.isFinite(appId) || appId < 1) {
      setError('Invalid application.')
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        await loadApplication()
      } catch (e: unknown) {
        if (!cancelled) setError(parseApiError(e, 'Could not load application').message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [appId, loadApplication])

  async function submitMove() {
    if (!row) return
    setMoveBusy(true)
    setMoveError(null)
    const sid = moveStageId.trim() ? Number(moveStageId) : undefined
    const st = moveStatus.trim() || undefined
    if (!sid && !st) {
      setMoveError('Choose a pipeline stage and/or a status.')
      setMoveBusy(false)
      return
    }
    try {
      const updated = await moveHiringApplicationStage(row.id, {
        stage_id: sid,
        status: st ?? null,
        comment: moveComment.trim(),
      })
      setRow(updated)
      setMoveStageId('')
      setMoveStatus('')
      setMoveComment('')
      await loadApplication()
    } catch (e: unknown) {
      setMoveError(parseApiError(e, 'Could not move candidate').message)
    } finally {
      setMoveBusy(false)
    }
  }

  if (!Number.isFinite(appId) || appId < 1) return <ErrorState message="Invalid application id." />
  if (loading) return <Spinner label="Loading application…" />
  if (error) return <ErrorState message={error} />
  if (!row) return <EmptyState title="Application not found" description="It may have been removed." />

  const topMatch = matches[0]

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-2 border-b border-app-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">Applications</p>
          <h2 className="text-xl font-semibold tracking-tight text-app-text">{row.candidate_name ?? `Candidate #${row.candidate}`}</h2>
          <p className="mt-1 text-sm text-app-secondary">
            {row.job_role_name} · {row.site_name}
            {row.client_name ? ` · ${row.client_name}` : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="neutral">{row.current_stage_name ?? 'Pipeline stage'}</Badge>
            <Badge variant="neutral">{hiringApplicationStatusLabel(row.status)}</Badge>
          </div>
        </div>
        <Link
          to="/hiring-applications"
          className="inline-flex min-h-9 items-center justify-center rounded-panel border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-text hover:bg-app-muted"
        >
          Back to list
        </Link>
      </div>

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Demand</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-app-subtle">MRF</dt>
            <dd className="font-mono text-xs">#{row.mrf}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-app-subtle">Line item</dt>
            <dd className="font-mono text-xs">#{row.mrf_line_item}</dd>
          </div>
        </dl>
      </section>

      {topMatch ? (
        <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
          <p className="text-sm font-semibold text-app-text">Match score</p>
          <p className="mt-2 text-sm text-app-secondary">
            Overall:{' '}
            <span className="font-semibold text-app-text">
              {topMatch.final_score != null ? String(topMatch.final_score) : topMatch.match_score != null ? String(topMatch.match_score) : '—'}
            </span>
            {topMatch.match_reason ? <span className="mt-1 block text-xs">{topMatch.match_reason}</span> : null}
          </p>
        </section>
      ) : null}

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Resume status</p>
        {resumes.length === 0 ? (
          <p className="mt-2 text-sm text-app-secondary">No resumes on file for this candidate.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {resumes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-panel border border-app-border bg-app-muted px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-app-text">{r.original_filename || `Resume #${r.id}`}</p>
                  <Badge variant="neutral" className="mt-1">
                    {resumeStatusLabel(r.status)}
                  </Badge>
                </div>
                <ResumeFileActions resume={r} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Stage history</p>
        {(row.recent_stage_history ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-app-secondary">No history yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {(row.recent_stage_history ?? []).map((h) => (
              <li key={h.id} className="rounded-panel border border-app-border bg-app-muted px-3 py-2 text-xs text-app-secondary">
                <span className="font-medium text-app-text">
                  {h.from_stage_name ?? 'Start'} → {h.to_stage_name ?? '—'}
                </span>
                <span className="mx-2">·</span>
                {hiringApplicationStatusLabel(h.to_status)}
                {h.moved_by_username ? (
                  <span className="mt-1 block text-app-subtle">By {h.moved_by_username}</span>
                ) : null}
                {h.comment ? <span className="mt-1 block italic">{h.comment}</span> : null}
                {h.created_at ? <span className="mt-1 block">{new Date(h.created_at).toLocaleString()}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canMove ? (
        <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
          <p className="text-sm font-semibold text-app-text">Move candidate</p>
          <p className="mt-1 text-xs text-app-secondary">Update pipeline stage and/or hiring status. At least one field is required.</p>
          {moveError ? (
            <div className="mt-3">
              <ErrorState message={moveError} />
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Select id="mv_stage" label="Next pipeline stage" value={moveStageId} onChange={(e) => setMoveStageId(e.target.value)}>
              <option value="">Keep / choose stage</option>
              {stages.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select id="mv_status" label="Status" value={moveStatus} onChange={(e) => setMoveStatus(e.target.value)}>
              <option value="">Keep / choose status</option>
              {HIRING_APPLICATION_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-3">
            <Input id="mv_comment" label="Comment" value={moveComment} onChange={(e) => setMoveComment(e.target.value)} />
          </div>
          <div className="mt-4">
            <Button type="button" onClick={() => void submitMove()} disabled={moveBusy}>
              {moveBusy ? 'Saving…' : 'Apply move'}
            </Button>
          </div>
        </section>
      ) : (
        <p className="text-xs text-app-subtle">You do not have access to move this application.</p>
      )}

      <p className="text-xs text-app-subtle">
        <Link className="text-brand-700 underline" to={`/candidates/${row.candidate}`}>
          Open full candidate profile
        </Link>
      </p>
    </div>
  )
}
