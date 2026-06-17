import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Download } from 'lucide-react'
import { getPublicProposalResponse, submitPublicProposalResponse, downloadPublicProposalPdf } from '@/api/publicSales'
import { parseApiError } from '@/lib/apiError'
import { saveBlob, parseBlobError } from '@/lib/fileDownload'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ClientProposalDocument } from './ClientProposalDocument'
import { clientProposalDataFromPublic } from './clientProposalDocumentData'
import type {
  ProposalBreakupLine,
  ProposalBudgetLine,
  PublicProposalResponse,
  PublicBudgetLine,
  PublicBreakupLine,
} from '@/types/sales'

// --- Helpers ------------------------------------------------------------------

type ResponseValue = 'approved' | 'rejected' | 'revision_required' | 'negotiation_required'

const RESPONSE_OPTIONS: {
  value: ResponseValue
  label: string
  desc: string
  variant: 'success' | 'danger' | 'warning' | 'brand'
}[] = [
  {
    value: 'approved',
    label: 'Approve',
    desc: 'Accept the proposal as presented',
    variant: 'success',
  },
  {
    value: 'rejected',
    label: 'Reject',
    desc: 'Decline the proposal',
    variant: 'danger',
  },
  {
    value: 'revision_required',
    label: 'Request Revision',
    desc: 'Request changes before approval',
    variant: 'warning',
  },
  {
    value: 'negotiation_required',
    label: 'Negotiate',
    desc: 'Request further discussion',
    variant: 'brand',
  },
]

const RESPONSE_LABELS: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  revision_required: 'Revision requested',
  negotiation_required: 'Negotiation requested',
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// --- Layout shell -------------------------------------------------------------

function PublicShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => { if (wasDark) root.classList.add('dark') }
  }, [])

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Header - aligned with app design */}
      <header className="bg-app-surface border-b border-app-border shadow-sm">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <img src="/LOGO-2-1.webp" alt="Logicon" className="h-10 w-10 shrink-0 object-contain" />
            <div className="border-l border-app-border pl-4">
              <p className="text-sm font-semibold text-app-text">Logicon Facility Management</p>
              <p className="text-xs text-app-secondary">{subtitle}</p>
            </div>
          </div>
          <div className="hidden sm:block">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success/10 px-3 py-1 text-xs font-medium text-status-success">
              <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
              Secure Form
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      {/* Footer */}
      <footer className="border-t border-app-border bg-app-surface py-6">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs text-app-subtle">
            Logicon Facility Management - This link is confidential and intended for the recipient only.
          </p>
        </div>
      </footer>
    </div>
  )
}

// --- Section card -------------------------------------------------------------

function SectionCard({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="bg-app-surface rounded-xl border border-app-border shadow-panel mb-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-brand-800">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// --- Status message pages -----------------------------------------------------

function StatusPage({
  subtitle,
  heading,
  body,
  subBody,
}: {
  subtitle: string
  heading: string
  body: string
  subBody?: string
}) {
  return (
    <PublicShell subtitle={subtitle}>
      <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center shadow-panel">
        <p className="text-base font-semibold text-app-text">{heading}</p>
        <p className="mt-2 text-sm text-app-secondary">{body}</p>
        {subBody ? <p className="mt-1 text-sm text-app-secondary">{subBody}</p> : null}
      </div>
    </PublicShell>
  )
}

// --- Validate form ------------------------------------------------------------

type FormState = {
  response: ResponseValue | ''
  respondent_name: string
  respondent_email: string
  remarks: string
}

function validateForm(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.response) errors.response = 'Please select a decision.'
  if (!form.respondent_name.trim()) errors.respondent_name = 'Name is required.'
  if (!form.respondent_email.trim()) {
    errors.respondent_email = 'Email is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.respondent_email)) {
    errors.respondent_email = 'Please enter a valid email address.'
  }
  const needsRemarks = ['rejected', 'revision_required', 'negotiation_required'].includes(form.response ?? '')
  if (needsRemarks && !form.remarks.trim()) {
    errors.remarks = 'Please provide your remarks for this decision.'
  }
  return errors
}

// --- Main page ----------------------------------------------------------------

type PageState = 'loading' | 'loaded' | 'not_found' | 'expired' | 'already_responded' | 'error' | 'submitted'
type TokenErrorCode = 'invalid_token' | 'expired' | 'revoked' | 'used' | 'already_responded' | 'not_approved' | ''

function tokenErrorStatusCopy(code: TokenErrorCode): { heading: string; body: string; subBody: string } {
  switch (code) {
    case 'revoked':
      return {
        heading: 'This proposal link is no longer active',
        body: 'A newer secure proposal link has been sent for this proposal.',
        subBody: 'Please use the latest email link sent by Logicon.',
      }
    case 'used':
    case 'already_responded':
      return {
        heading: 'Response already submitted',
        body: 'This proposal has already been responded to.',
        subBody: 'Please contact the Logicon team if another response is required.',
      }
    case 'expired':
      return {
        heading: 'This proposal link has expired',
        body: 'The review period for this proposal link has ended.',
        subBody: 'Please contact the Logicon team for a new link.',
      }
    case 'not_approved':
      return {
        heading: 'This proposal is not available for client review',
        body: 'This proposal is not ready for external response.',
        subBody: 'Please contact the Logicon team for assistance.',
      }
    default:
      return {
        heading: 'This proposal link is no longer available',
        body: 'The link may be invalid or the proposal may no longer exist.',
        subBody: 'Please contact the Logicon team for a valid proposal link.',
      }
  }
}

export function PublicProposalResponsePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [tokenErrorCode, setTokenErrorCode] = useState<TokenErrorCode>('')
  const [proposalData, setProposalData] = useState<PublicProposalResponse | null>(null)

  const [form, setForm] = useState<FormState>({
    response: '',
    respondent_name: '',
    respondent_email: '',
    remarks: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setPageState('not_found')
      return
    }
    void loadProposal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function loadProposal() {
    try {
      setTokenErrorCode('')
      const result = await getPublicProposalResponse(token)
      setProposalData(result)
      setForm((current) => ({
        ...current,
        respondent_name: current.respondent_name || result.recipient_name || result.client_contact_person || '',
        respondent_email: current.respondent_email || result.recipient_email || result.client_email || '',
      }))
      if (result.already_responded) {
        setPageState('already_responded')
      } else if (!result.can_respond) {
        setPageState('expired')
      } else {
        setPageState('loaded')
      }
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        const status = e.response?.status
        const data = e.response?.data as { detail?: string; code?: TokenErrorCode } | undefined
        const detail = String(data?.detail ?? '')
        const code = data?.code ?? ''
        setTokenErrorCode(code)
        if (code === 'used' || code === 'already_responded') {
          setPageState('expired')
        } else if (status === 404) {
          setPageState('not_found')
        } else if (status === 410 || /expir/i.test(detail)) {
          setPageState('expired')
        } else {
          setPageState('error')
          setErrorMsg(parseApiError(e, 'Unable to load proposal review').message)
        }
      } else {
        setPageState('error')
        setErrorMsg('Unable to load proposal review.')
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitPublicProposalResponse(token, {
        response: form.response as ResponseValue,
        respondent_name: form.respondent_name.trim(),
        respondent_email: form.respondent_email.trim(),
        remarks: form.remarks.trim() || undefined,
      })
      setPageState('submitted')
    } catch (err: unknown) {
      setSubmitError(parseApiError(err, 'Unable to submit response. Please try again.').message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownloadPdf() {
    setPdfDownloading(true)
    setPdfError(null)
    try {
      const { blob, filename } = await downloadPublicProposalPdf(token)
      // Check if backend returned JSON error instead of PDF
      if (blob.type === 'application/json') {
        setPdfError(await parseBlobError(blob))
        return
      }
      saveBlob(blob, filename)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
        setPdfError(await parseBlobError(err.response.data))
      } else {
        setPdfError(parseApiError(err, 'Failed to download PDF').message)
      }
    } finally {
      setPdfDownloading(false)
    }
  }

  // -- Loading / terminal states ----------------------------------------------

  if (!token) {
    return (
      <StatusPage
        subtitle="Proposal Review"
        heading="Invalid proposal link"
        body="The link you followed does not contain a valid proposal token."
        subBody="Please contact the Logicon team for a valid proposal link."
      />
    )
  }

  if (pageState === 'loading') {
    return (
      <PublicShell subtitle="Proposal Review">
        <Spinner label="Loading proposal..." />
      </PublicShell>
    )
  }

  if (pageState === 'not_found') {
    const copy = tokenErrorStatusCopy(tokenErrorCode)
    return (
      <StatusPage
        subtitle="Proposal Review"
        heading={copy.heading}
        body={copy.body}
        subBody={copy.subBody}
      />
    )
  }

  if (pageState === 'expired') {
    const copy = tokenErrorStatusCopy(tokenErrorCode || 'expired')
    return (
      <StatusPage
        subtitle="Proposal Review"
        heading={copy.heading}
        body={copy.body}
        subBody={copy.subBody}
      />
    )
  }

  if (pageState === 'already_responded') {
    const responded = proposalData?.responded_at
    const responseLabel = proposalData?.client_response ? (RESPONSE_LABELS[proposalData.client_response] ?? proposalData.client_response) : '-'
    return (
      <PublicShell subtitle="Proposal Review">
        <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center shadow-panel">
          <p className="text-base font-semibold text-app-text">Response already submitted</p>
          <p className="mt-2 text-sm text-app-secondary">
            This proposal has already been responded to.
          </p>
          <dl className="mt-4 inline-grid grid-cols-2 gap-x-6 gap-y-2 text-left text-sm">
            <dt className="text-app-subtle">Decision</dt>
            <dd className="font-medium text-app-text">{responseLabel}</dd>
            {responded ? (
              <>
                <dt className="text-app-subtle">Submitted</dt>
                <dd className="font-medium text-app-text">{formatDateTime(responded)}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </PublicShell>
    )
  }

  if (pageState === 'error') {
    return (
      <StatusPage
        subtitle="Proposal Review"
        heading="Unable to load proposal review"
        body={errorMsg || 'An unexpected error occurred.'}
        subBody="Please try again or contact the Logicon team."
      />
    )
  }

  if (pageState === 'submitted') {
    const chosenLabel = RESPONSE_LABELS[form.response] ?? form.response
    return (
      <PublicShell subtitle="Proposal Review">
        <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center shadow-panel">
          <p className="text-base font-semibold text-app-text">Thank you for your response</p>
          <p className="mt-2 text-sm text-app-secondary">
            Your decision <span className="font-medium text-app-text">"{chosenLabel}"</span> has been
            recorded. The Logicon team will be in touch shortly.
          </p>
        </div>
      </PublicShell>
    )
  }

  // -- Loaded state ------------------------------------------------------------

  const d = proposalData!
  const budgetLines: PublicBudgetLine[] = d.budget_lines ?? []
  const breakupLines: PublicBreakupLine[] = d.breakup_lines ?? []
  const groupedBudgetLines: ProposalBudgetLine[] = budgetLines.map((line) => ({
    id: line.id,
    proposal_version: 0,
    site: line.site ?? line.site_id ?? null,
    site_name: line.site_name ?? null,
    role_requirement: line.role_requirement ?? null,
    service_category: line.service_category ?? '',
    job_role: line.job_role ?? line.job_role_id ?? null,
    job_role_name: line.job_role_name ?? null,
    description: line.description ?? '',
    manpower_count: line.manpower_count ?? null,
    unit_cost: line.unit_cost ?? null,
    total_cost: line.total_cost ?? null,
    sort_order: line.sort_order ?? 0,
  }))
  const groupedBreakupLines: ProposalBreakupLine[] = breakupLines.map((line) => ({
    id: line.id,
    proposal_version: 0,
    site: line.site ?? line.site_id ?? null,
    site_name: line.site_name ?? null,
    role_requirement: line.role_requirement ?? null,
    job_role: line.job_role ?? line.job_role_id ?? null,
    job_role_name: line.job_role_name ?? null,
    component_name: line.component_name ?? '',
    component_type: line.component_type ?? '',
    percentage: line.percentage ?? null,
    amount: line.amount ?? null,
    sort_order: line.sort_order ?? 0,
  }))

  return (
    <PublicShell subtitle="Commercial Proposal">
      {/* Intro message */}
      <div className="mb-6 rounded-xl border border-app-border bg-app-surface p-5 shadow-panel">
        <p className="text-sm text-app-secondary">
          Review the commercial proposal below and submit your response. You may print or save the proposal as PDF using the button provided.
        </p>
      </div>

      {/* Commercial Proposal Document - primary view */}
      <div className="mb-6">
        <div className="mb-4 flex justify-end no-print">
          <Button
            variant="secondary"
            onClick={() => void handleDownloadPdf()}
            disabled={pdfDownloading}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {pdfDownloading ? 'Downloading...' : 'Download PDF'}
          </Button>
        </div>
        {pdfError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{pdfError}</p>
          </div>
        )}
        <ClientProposalDocument
          data={clientProposalDataFromPublic(d)}
          budgetLines={groupedBudgetLines}
          breakupLines={groupedBreakupLines}
        />
      </div>

      {/* Response form */}
      <div className="no-print">
        <SectionCard title="Your Response">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6" noValidate>
          {/* Decision */}
          <div>
            <p className="mb-2 text-sm font-medium text-app-text">
              Decision <span className="text-status-danger">*</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {RESPONSE_OPTIONS.map((opt) => {
                const isSelected = form.response === opt.value
                const variantClasses = {
                  success: isSelected ? 'border-status-success bg-status-success/10' : 'border-app-border hover:border-status-success/50',
                  danger: isSelected ? 'border-status-danger bg-status-danger/10' : 'border-app-border hover:border-status-danger/50',
                  warning: isSelected ? 'border-status-warning bg-status-warning/10' : 'border-app-border hover:border-status-warning/50',
                  brand: isSelected ? 'border-brand-500 bg-brand-500/10' : 'border-app-border hover:border-brand-500/50',
                }
                const textClasses = {
                  success: isSelected ? 'text-status-success' : 'text-app-text',
                  danger: isSelected ? 'text-status-danger' : 'text-app-text',
                  warning: isSelected ? 'text-status-warning' : 'text-app-text',
                  brand: isSelected ? 'text-brand-600' : 'text-app-text',
                }
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors ${variantClasses[opt.variant]}`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => setForm((f) => ({ ...f, response: opt.value }))}
                      className="mt-0.5 shrink-0 accent-brand-600"
                    />
                    <div>
                      <p className={`text-sm font-medium ${textClasses[opt.variant]}`}>{opt.label}</p>
                      <p className="text-xs text-app-secondary">{opt.desc}</p>
                    </div>
                  </label>
                )
              })}
            </div>
            {fieldErrors.response ? (
              <p className="mt-1.5 text-sm text-status-danger">{fieldErrors.response}</p>
            ) : null}
          </div>

          {/* Contact details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="resp-name" className="mb-1 block text-sm font-medium text-app-text">
                Your name <span className="text-status-danger">*</span>
              </label>
              <input
                id="resp-name"
                type="text"
                value={form.respondent_name}
                onChange={(e) => setForm((f) => ({ ...f, respondent_name: e.target.value }))}
                placeholder="Full name"
                className="min-h-10 w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              {fieldErrors.respondent_name ? (
                <p className="mt-1 text-sm text-status-danger">{fieldErrors.respondent_name}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="resp-email" className="mb-1 block text-sm font-medium text-app-text">
                Your email <span className="text-status-danger">*</span>
              </label>
              <input
                id="resp-email"
                type="email"
                value={form.respondent_email}
                onChange={(e) => setForm((f) => ({ ...f, respondent_email: e.target.value }))}
                placeholder="email@company.com"
                className="min-h-10 w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              {fieldErrors.respondent_email ? (
                <p className="mt-1 text-sm text-status-danger">{fieldErrors.respondent_email}</p>
              ) : null}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label htmlFor="resp-remarks" className="mb-1 block text-sm font-medium text-app-text">
              Remarks
              {['rejected', 'revision_required', 'negotiation_required'].includes(form.response) ? (
                <span className="text-status-danger"> *</span>
              ) : (
                <span className="ml-1 text-xs font-normal text-app-subtle">(optional for approval)</span>
              )}
            </label>
            <textarea
              id="resp-remarks"
              rows={4}
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              placeholder="Any comments, questions, or conditions..."
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            {fieldErrors.remarks ? (
              <p className="mt-1 text-sm text-status-danger">{fieldErrors.remarks}</p>
            ) : null}
          </div>

          {/* Submit */}
          {submitError ? (
            <p className="text-sm text-status-danger">{submitError}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-800 px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-900 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Response'}
          </button>
        </form>
        </SectionCard>
      </div>
    </PublicShell>
  )
}

