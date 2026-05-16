import type { ReactNode } from 'react'
import {
  ADMIN_LABELS,
  displayOrDash,
  formatExperienceRange,
  IT_LABELS,
  selectedSupportLabels,
} from '@/features/mrf/mrfClientForm'
import type { MRFRow } from '@/features/mrf/types'

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
      <p className="text-sm font-semibold text-app-text">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value || value === '-') return null
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="shrink-0 text-app-subtle">{label}</dt>
      <dd className="max-w-[65%] whitespace-pre-wrap text-right font-medium text-app-text">{value}</dd>
    </div>
  )
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-app-secondary">None selected</p>
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-full border border-app-border bg-app-muted px-2.5 py-0.5 text-xs font-medium text-app-text">
          {item}
        </li>
      ))}
    </ul>
  )
}

function hasClientPdfContent(row: MRFRow): boolean {
  const exp = formatExperienceRange(row.experience_min_years, row.experience_max_years)
  if (row.request_number?.trim()) return true
  if (exp) return true
  if (row.reporting_to?.trim()) return true
  if (row.mis_requirement?.trim()) return true
  if (row.education_requirement?.trim()) return true
  if (row.gender_preference?.trim()) return true
  if (row.special_requirement?.trim()) return true
  if (row.salary_range_text?.trim()) return true
  if (row.ctc_budget_text?.trim()) return true
  if (row.reference_note?.trim()) return true
  if (row.other_remarks?.trim()) return true
  if (row.support_requirement) return true
  return false
}

export function MRFClientFormDisplay({ row }: { row: MRFRow }) {
  if (!hasClientPdfContent(row)) return null

  const sr = row.support_requirement
  const itItems = selectedSupportLabels(sr, IT_LABELS)
  const adminItems = selectedSupportLabels(sr, ADMIN_LABELS)
  const exp = formatExperienceRange(row.experience_min_years, row.experience_max_years)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DetailSection title="Job information">
        <dl className="grid gap-2">
          <DetailRow label="Requisition number" value={displayOrDash(row.request_number)} />
          <DetailRow label="Experience range" value={exp ?? '-'} />
          <DetailRow label="Reporting to" value={displayOrDash(row.reporting_to)} />
          <DetailRow label="MIS requirement" value={displayOrDash(row.mis_requirement)} />
          <DetailRow label="Education" value={displayOrDash(row.education_requirement)} />
          <DetailRow label="Gender preference" value={displayOrDash(row.gender_preference)} />
          <DetailRow label="Special requirement" value={displayOrDash(row.special_requirement)} />
        </dl>
      </DetailSection>

      <DetailSection title="Salary / budget">
        <dl className="grid gap-2">
          <DetailRow label="Salary range" value={displayOrDash(row.salary_range_text)} />
          <DetailRow label="CTC budget" value={displayOrDash(row.ctc_budget_text)} />
        </dl>
      </DetailSection>

      <DetailSection title="IT requirements">
        <TagList items={itItems} />
        {sr?.own_or_rental?.trim() ? (
          <p className="mt-2 text-sm text-app-secondary">
            Own / rental: <span className="font-medium text-app-text">{sr.own_or_rental}</span>
          </p>
        ) : null}
      </DetailSection>

      <DetailSection title="Admin requirements">
        <TagList items={adminItems} />
        {sr?.admin_location?.trim() ? (
          <p className="mt-2 text-sm text-app-secondary">
            Admin location: <span className="font-medium text-app-text">{sr.admin_location}</span>
          </p>
        ) : null}
        {sr?.admin_other?.trim() ? (
          <p className="mt-2 text-sm text-app-secondary">
            Admin other: <span className="font-medium text-app-text">{sr.admin_other}</span>
          </p>
        ) : null}
      </DetailSection>

      <DetailSection title="Other remarks">
        <dl className="grid gap-2">
          <DetailRow label="Reference note" value={displayOrDash(row.reference_note)} />
          <DetailRow label="Other remarks" value={displayOrDash(row.other_remarks)} />
        </dl>
      </DetailSection>
    </div>
  )
}
