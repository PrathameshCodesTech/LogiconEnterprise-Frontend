/** Business-friendly labels for resume processing state (no technical jargon). */
export function resumeStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  const map: Record<string, string> = {
    uploaded: 'Received',
    extracting: 'Processing',
    ocr_required: 'Needs extra capture',
    parsing: 'Structuring',
    validating: 'Checking',
    indexed: 'Ready',
    manual_review: 'Needs review',
    failed: 'Could not process',
    duplicate_file: 'Duplicate file',
  }
  return map[status] ?? status.replace(/_/g, ' ')
}

export function hiringApplicationStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  const map: Record<string, string> = {
    draft: 'Draft',
    shortlisted: 'Shortlisted',
    client_review: 'Client review',
    interview_scheduled: 'Interview scheduled',
    interview_in_progress: 'Interview in progress',
    selected: 'Selected',
    rejected: 'Rejected',
    offer_released: 'Offer released',
    offer_accepted: 'Offer accepted',
    offer_declined: 'Offer declined',
    deployed: 'Deployed',
    cancelled: 'Cancelled',
  }
  return map[status] ?? status.replace(/_/g, ' ')
}

export const HIRING_APPLICATION_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'draft', label: hiringApplicationStatusLabel('draft') },
  { value: 'shortlisted', label: hiringApplicationStatusLabel('shortlisted') },
  { value: 'client_review', label: hiringApplicationStatusLabel('client_review') },
  { value: 'interview_scheduled', label: hiringApplicationStatusLabel('interview_scheduled') },
  { value: 'interview_in_progress', label: hiringApplicationStatusLabel('interview_in_progress') },
  { value: 'selected', label: hiringApplicationStatusLabel('selected') },
  { value: 'rejected', label: hiringApplicationStatusLabel('rejected') },
  { value: 'offer_released', label: hiringApplicationStatusLabel('offer_released') },
  { value: 'offer_accepted', label: hiringApplicationStatusLabel('offer_accepted') },
  { value: 'offer_declined', label: hiringApplicationStatusLabel('offer_declined') },
  { value: 'deployed', label: hiringApplicationStatusLabel('deployed') },
  { value: 'cancelled', label: hiringApplicationStatusLabel('cancelled') },
]
