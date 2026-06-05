import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  convertApplicationToDeployment,
  getHiringApplication,
  getInterviewPlan,
  listCandidateMatchResults,
  listInterviewFeedback,
  listInterviews,
  listOffers,
  listPipelineStages,
  moveHiringApplicationStage,
} from '@/api/hiring'
import { listResumes } from '@/api/talent'
import { useAuthStore } from '@/features/auth/authStore'
import { CAP, hasAnyCapability } from '@/lib/capabilities'
import { parseApiError } from '@/lib/apiError'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { OfferFormDrawer } from '@/features/hiring/OfferFormDrawer'
import { HiringApplicationJourney } from '@/features/hiring/HiringJourney'
import { InterviewPanel } from '@/features/hiring/InterviewPanel'
import { ResumeFileActions } from '@/features/talent/ResumeFileActions'
import {
  hiringApplicationStatusLabel,
  HIRING_APPLICATION_STATUS_OPTIONS,
  resumeStatusLabel,
} from '@/features/talent/talentLabels'
import type {
  CandidateMatchResultRow,
  HiringApplicationRow,
  HiringDeploymentConversionResult,
  InterviewFeedbackRow,
  InterviewPlanRow,
  InterviewRow,
  OfferRow,
  PipelineStageRow,
} from '@/features/hiring/types'
import type { EmployeeRow, SiteDeploymentRow } from '@/features/deployment/types'
import type { ResumeRow } from '@/features/talent/types'

function offerStatusVariant(s: string): 'neutral' | 'info' | 'success' | 'danger' | 'warning' | 'attention' {
  if (s === 'draft') return 'neutral'
  if (s === 'released') return 'info'
  if (s === 'accepted') return 'success'
  if (s === 'declined') return 'danger'
  if (s === 'withdrawn') return 'attention'
  if (s === 'expired') return 'warning'
  return 'neutral'
}

export function HiringApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const appId = Number(id)
  const [searchParams, setSearchParams] = useSearchParams()
  const meCaps = useAuthStore((s) => s.me?.capabilities ?? [])
  const canMove = hasAnyCapability(meCaps, [CAP.HIRING_APPLICATION_UPDATE])
  const canOfferRead = hasAnyCapability(meCaps, [CAP.OFFER_READ, CAP.OFFER_CREATE, CAP.OFFER_UPDATE, CAP.OFFER_APPROVE, CAP.OFFER_MANAGE])
  const canOfferCreate = hasAnyCapability(meCaps, [CAP.OFFER_CREATE])
  const canConvert = hasAnyCapability(meCaps, [
    CAP.DEPLOYMENT_CREATE,
    CAP.DEPLOYMENT_MANAGE,
    CAP.SITE_DEPLOYMENT_CREATE,
  ])
  const canInterviewRead = hasAnyCapability(meCaps, [CAP.INTERVIEW_READ, CAP.INTERVIEW_CREATE, CAP.INTERVIEW_MANAGE])
  const canInterviewCreate = hasAnyCapability(meCaps, [CAP.INTERVIEW_CREATE])
  const canInterviewManage = hasAnyCapability(meCaps, [CAP.INTERVIEW_MANAGE])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<HiringApplicationRow | null>(null)
  const [stages, setStages] = useState<PipelineStageRow[]>([])
  const [matches, setMatches] = useState<CandidateMatchResultRow[]>([])
  const [resumes, setResumes] = useState<ResumeRow[]>([])
  const [offer, setOffer] = useState<OfferRow | null>(null)
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [feedbacks, setFeedbacks] = useState<InterviewFeedbackRow[]>([])
  const [interviewPlan, setInterviewPlan] = useState<InterviewPlanRow | null>(null)
  const [interviewsLoading, setInterviewsLoading] = useState(false)
  const [offerDrawerOpen, setOfferDrawerOpen] = useState(false)
  const [convertDrawerOpen, setConvertDrawerOpen] = useState(false)
  const [convertResult, setConvertResult] = useState<{
    employee: EmployeeRow
    deployment: SiteDeploymentRow
    created_employee: boolean
    created_deployment: boolean
  } | null>(null)
  const autoOpenedConvertRef = useRef(false)

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
    try {
      const offerRes = await listOffers({ hiring_application: appId })
      const matched = offerRes.items[0] ?? null
      setOffer(matched)
    } catch {
      setOffer(null)
    }
    if (app.interview_plan != null) {
      try {
        const plan = await getInterviewPlan(app.interview_plan)
        setInterviewPlan(plan)
      } catch {
        setInterviewPlan(null)
      }
    } else {
      setInterviewPlan(null)
    }
  }, [appId])

  const loadInterviews = useCallback(async () => {
    if (!Number.isFinite(appId) || appId < 1) return
    if (!canInterviewRead) {
      setInterviews([])
      setFeedbacks([])
      return
    }
    setInterviewsLoading(true)
    try {
      const ivRes = await listInterviews({ hiring_application: appId })
      setInterviews(ivRes.items)
      if (ivRes.items.length > 0) {
        const fbResults = await Promise.all(
          ivRes.items.map((iv) => listInterviewFeedback({ interview: iv.id }).catch(() => ({ items: [] }))),
        )
        setFeedbacks(fbResults.flatMap((r) => r.items))
      } else {
        setFeedbacks([])
      }
    } catch {
      setInterviews([])
      setFeedbacks([])
    } finally {
      setInterviewsLoading(false)
    }
  }, [appId, canInterviewRead])

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
        await loadInterviews()
      } catch (e: unknown) {
        if (!cancelled) setError(parseApiError(e, 'Could not load application').message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [appId, loadApplication, loadInterviews])

  useEffect(() => {
    if (autoOpenedConvertRef.current) return
    if (loading || !row) return
    if (searchParams.get('openConvert') !== '1') return
    const accepted =
      offer?.status === 'accepted' ||
      row.offer_status === 'accepted' ||
      row.status === 'offer_accepted'
    if (row.status === 'deployed' || !accepted || !canConvert) return
    autoOpenedConvertRef.current = true
    setConvertDrawerOpen(true)
  }, [loading, row, offer, searchParams, canConvert])

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

  const clientApproved =
    row.client_decision === 'approved' ||
    ['selected', 'offer_released', 'offer_accepted', 'offer_declined', 'deployed'].includes(row.status)

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
          to="/hiring/applications"
          className="inline-flex min-h-9 items-center justify-center rounded-panel border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-text hover:bg-app-muted"
        >
          Back to list
        </Link>
      </div>

      <HiringApplicationJourney app={row} />

      <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <p className="text-sm font-semibold text-app-text">Demand</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-app-subtle">Client</dt>
            <dd className="text-app-text">{row.client_name?.trim() || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-app-subtle">Site</dt>
            <dd className="text-app-text">{row.site_name?.trim() || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-app-subtle">Job role</dt>
            <dd className="text-app-text">{row.job_role_name?.trim() || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-app-subtle">Request</dt>
            <dd className="font-mono text-xs text-app-subtle">#{row.mrf}</dd>
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

      {canInterviewRead ? (
        <InterviewPanel
          app={row}
          plan={interviewPlan}
          interviews={interviews}
          feedbacks={feedbacks}
          loading={interviewsLoading}
          canCreate={canInterviewCreate}
          canManage={canInterviewManage}
          onChanged={async () => {
            await loadApplication()
            await loadInterviews()
          }}
        />
      ) : null}

      {canOfferRead ? (
        <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-app-text">Offer</p>
            {offer || row.status === 'selected' ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-7 px-3 text-xs"
                onClick={() => setOfferDrawerOpen(true)}
              >
                {offer ? 'Manage offer' : 'Create offer'}
              </Button>
            ) : null}
          </div>
          {!offer && !clientApproved ? (
            <p className="mt-2 text-xs text-app-secondary">
              Client approval is required before creating an offer.
            </p>
          ) : offer ? (
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-app-subtle">Status</dt>
                <dd>
                  <Badge variant={offerStatusVariant(offer.status)} className="text-[11px]">
                    {offer.status}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-app-subtle">Offered CTC</dt>
                <dd className="font-medium text-app-text">
                  {offer.offered_ctc != null ? `₹ ${Number(offer.offered_ctc).toLocaleString('en-IN')}` : '—'}
                </dd>
              </div>
              {offer.joining_date ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-app-subtle">Joining date</dt>
                  <dd className="text-app-text">
                    {new Date(offer.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </dd>
                </div>
              ) : null}
              {offer.released_by_username ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-app-subtle">Released by</dt>
                  <dd className="text-app-text">{offer.released_by_username}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-xs text-app-secondary">
              {canOfferCreate ? 'No offer created yet.' : 'No offer on record for this application.'}
            </p>
          )}
        </section>
      ) : null}

      <DeploymentPanel
        application={row}
        offer={offer}
        canConvert={canConvert}
        convertResult={convertResult}
        onOpenConvert={() => setConvertDrawerOpen(true)}
      />

      {canMove ? (
        <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
          <p className="text-sm font-semibold text-app-text">Admin correction</p>
          <p className="mt-1 text-xs text-app-secondary">
            Manual stage/status override for corrections only. Normal movement happens through the interview pipeline (apply plan, schedule rounds, submit feedback, create offer).
          </p>
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

      <OfferFormDrawer
        open={offerDrawerOpen}
        onClose={() => setOfferDrawerOpen(false)}
        applicationId={appId}
        offer={offer}
        onSuccess={(updated) => {
          setOffer(updated)
          setRow((prev) => prev ? {
            ...prev,
            offer_status: updated.status,
            offered_ctc: updated.offered_ctc != null ? String(updated.offered_ctc) : null,
            offer_joining_date: updated.joining_date ?? null,
          } : prev)
          setOfferDrawerOpen(false)
          void loadApplication()
        }}
      />

      <ConvertToDeploymentDrawer
        open={convertDrawerOpen}
        applicationId={appId}
        offer={offer}
        onClose={() => setConvertDrawerOpen(false)}
        onSuccess={(result) => {
          setConvertResult(result)
          setRow((prev) => prev ? { ...prev, status: 'deployed' } : prev)
          setConvertDrawerOpen(false)
          const next = new URLSearchParams(searchParams)
          if (next.has('openConvert')) {
            next.delete('openConvert')
            setSearchParams(next, { replace: true })
          }
        }}
      />
    </div>
  )
}

// ─── Deployment panel + conversion drawer ─────────────────────────────────────

function isOfferAccepted(application: HiringApplicationRow, offer: OfferRow | null): boolean {
  if (offer?.status === 'accepted') return true
  return application.offer_status === 'accepted' || application.status === 'offer_accepted'
}

function DeploymentPanel({
  application,
  offer,
  canConvert,
  convertResult,
  onOpenConvert,
}: {
  application: HiringApplicationRow
  offer: OfferRow | null
  canConvert: boolean
  convertResult: {
    employee: EmployeeRow
    deployment: SiteDeploymentRow
    created_employee: boolean
    created_deployment: boolean
  } | null
  onOpenConvert: () => void
}) {
  const alreadyDeployed = application.status === 'deployed'
  const accepted = isOfferAccepted(application, offer)

  return (
    <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-app-text">Deployment</p>
        {alreadyDeployed ? (
          <Badge variant="success" className="text-[11px]">Deployed</Badge>
        ) : null}
      </div>

      {convertResult ? (
        <div className="mt-3 space-y-3">
          <div className="rounded border border-status-success/30 bg-status-success/5 p-3 text-xs text-app-text">
            <p className="font-medium">
              {convertResult.created_employee ? 'Employee created.' : 'Existing employee linked.'}{' '}
              {convertResult.created_deployment
                ? 'Deployment created.'
                : 'Existing deployment reused.'}
            </p>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-app-secondary">Employee</dt>
                <dd>
                  <span className="font-medium">
                    {convertResult.employee.full_name ??
                      `${convertResult.employee.first_name} ${convertResult.employee.last_name}`.trim()}
                  </span>{' '}
                  <span className="font-mono text-[11px]">[{convertResult.employee.employee_code}]</span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-app-secondary">Deployment</dt>
                <dd className="font-mono">#{convertResult.deployment.id}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-app-secondary">Site</dt>
                <dd>{convertResult.deployment.site_name ?? `Site #${convertResult.deployment.site}`}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-app-secondary">Status</dt>
                <dd>
                  <Badge variant="neutral" className="text-[11px]">
                    {convertResult.deployment.status}
                  </Badge>
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/deployment/site-deployments?employee=${convertResult.employee.id}`}
                className="inline-flex min-h-8 items-center rounded-panel border border-app-border bg-app-surface px-3 text-xs font-medium text-app-text hover:bg-app-muted"
              >
                Open deployments
              </Link>
              <Link
                to="/deployment/employees"
                className="inline-flex min-h-8 items-center rounded-panel border border-app-border bg-app-surface px-3 text-xs font-medium text-app-text hover:bg-app-muted"
              >
                Employees list
              </Link>
            </div>
          </div>
        </div>
      ) : alreadyDeployed ? (
        <div className="mt-3 space-y-2 text-xs text-app-secondary">
          <p>This application has already been converted to a deployment.</p>
          <Link to="/deployment/employees" className="inline-block text-brand-700 underline">
            Open employees list
          </Link>
        </div>
      ) : !offer ? (
        <p className="mt-2 text-xs text-app-secondary">
          Create and release an offer first. Deployment requires an accepted offer.
        </p>
      ) : !accepted ? (
        <p className="mt-2 text-xs text-app-secondary">
          Offer must be accepted before this candidate can be deployed. Current offer status:{' '}
          <span className="font-medium text-app-text">{offer.status}</span>.
        </p>
      ) : !canConvert ? (
        <p className="mt-2 text-xs text-app-secondary">
          Offer is accepted. You do not have permission to convert applications to deployments.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-app-secondary">
            Offer is accepted. Create the employee record and an initial site deployment.
          </p>
          <Button
            type="button"
            variant="primary"
            className="min-h-9 px-3 text-sm"
            onClick={onOpenConvert}
          >
            Convert to deployment
          </Button>
        </div>
      )}

    </section>
  )
}

function ConvertToDeploymentDrawer({
  open,
  applicationId,
  offer,
  onClose,
  onSuccess,
}: {
  open: boolean
  applicationId: number
  offer: OfferRow | null
  onClose: () => void
  onSuccess: (result: {
    employee: EmployeeRow
    deployment: SiteDeploymentRow
    created_employee: boolean
    created_deployment: boolean
  }) => void
}) {
  const [employeeCode, setEmployeeCode] = useState('')
  const [joinedOn, setJoinedOn] = useState('')
  const [startDate, setStartDate] = useState('')
  const [deploymentStatus, setDeploymentStatus] = useState<'planned' | 'active'>('planned')
  const [shiftHours, setShiftHours] = useState('')
  const [billingType, setBillingType] = useState<'' | 'billable' | 'non_billable'>('')
  const [allowExisting, setAllowExisting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setEmployeeCode('')
      setJoinedOn(offer?.joining_date ?? '')
      setStartDate(offer?.joining_date ?? '')
      setDeploymentStatus('planned')
      setShiftHours('')
      setBillingType('')
      setAllowExisting(false)
      setError(null)
    }
  }, [open, offer])

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    try {
      const res: HiringDeploymentConversionResult = await convertApplicationToDeployment(applicationId, {
        employee_code: employeeCode.trim() || null,
        joined_on: joinedOn || null,
        deployment_start_date: startDate || null,
        deployment_status: deploymentStatus,
        shift_hours: shiftHours.trim() || null,
        billing_type: billingType || null,
        allow_existing_employee: allowExisting,
      })
      const emp = res.employee as EmployeeRow
      const dep = res.deployment as SiteDeploymentRow
      onSuccess({
        employee: emp,
        deployment: dep,
        created_employee: res.created_employee,
        created_deployment: res.created_deployment,
      })
    } catch (e: unknown) {
      setError(parseApiError(e, 'Could not convert application').message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => !busy && onClose()}
      title="Convert to deployment"
      description="Create the employee and a site deployment for this accepted application."
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-9 px-3 text-sm"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="min-h-9 px-3 text-sm"
            disabled={busy}
            onClick={() => void handleSubmit()}
          >
            {busy ? 'Converting…' : 'Convert'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input
          id="cd_emp_code"
          label="Employee code (optional)"
          placeholder="Auto-generated if blank"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="cd_joined_on" className="text-sm font-medium text-app-secondary">
              Joined on
            </label>
            <input
              id="cd_joined_on"
              type="date"
              value={joinedOn}
              onChange={(e) => setJoinedOn(e.target.value)}
              className="min-h-10 rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cd_start_date" className="text-sm font-medium text-app-secondary">
              Deployment start date
            </label>
            <input
              id="cd_start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="min-h-10 rounded-panel border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            id="cd_status"
            label="Initial status"
            value={deploymentStatus}
            onChange={(e) => setDeploymentStatus(e.target.value === 'active' ? 'active' : 'planned')}
          >
            <option value="planned">Planned</option>
            <option value="active">Active</option>
          </Select>
          <Select
            id="cd_billing"
            label="Billing type (optional)"
            value={billingType}
            onChange={(e) => setBillingType((e.target.value as 'billable' | 'non_billable' | '') || '')}
          >
            <option value="">Use MRF default</option>
            <option value="billable">Billable</option>
            <option value="non_billable">Non-billable</option>
          </Select>
        </div>
        <Input
          id="cd_shift"
          label="Shift hours (optional)"
          type="number"
          step="0.1"
          min="0"
          value={shiftHours}
          onChange={(e) => setShiftHours(e.target.value)}
          placeholder="e.g. 8 or 8.5"
        />
        <label className="flex items-start gap-2 text-sm text-app-text">
          <input
            type="checkbox"
            checked={allowExisting}
            onChange={(e) => setAllowExisting(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-app-border"
          />
          <span>
            Reuse existing employee if matched by code or phone
            <span className="block text-xs text-app-subtle">
              Otherwise a duplicate phone or code will return an error.
            </span>
          </span>
        </label>
        {error ? <ErrorState message={error} /> : null}
      </div>
    </Drawer>
  )
}
