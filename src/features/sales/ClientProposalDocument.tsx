import { AlertTriangle } from 'lucide-react'
import type { ProposalBudgetLine, ProposalBreakupLine } from '@/types/sales'
import type { ClientProposalDocumentData } from './clientProposalDocumentData'
import { formatMoneyAmount } from '@/features/budgets/budgetDisplay'
import { formatShortDate } from './salesUtils'
import {
  buildBreakupRoleGroups,
  getUnmappedBreakupLines,
} from './salesBreakupGrouping'
import { PROPOSAL_TERMS_LIST } from './proposalDocumentTerms'
import './clientProposalDocument.css'

interface ClientProposalDocumentProps {
  data: ClientProposalDocumentData
  budgetLines: ProposalBudgetLine[]
  breakupLines: ProposalBreakupLine[]
}

function formatAmount(value: string | number | null | undefined): string {
  if (value == null) return '-'
  return formatMoneyAmount(String(value), 'INR')
}

function formatPercent(value: string | null | undefined): string {
  if (value == null) return '-'
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return '-'
  return `${n}%`
}

function deriveSiteName(budgetLines: ProposalBudgetLine[]): string | null {
  const sites = new Set<string>()
  for (const line of budgetLines) {
    if (line.site_name?.trim()) {
      sites.add(line.site_name.trim())
    }
  }
  if (sites.size === 0) return null
  if (sites.size === 1) return [...sites][0] ?? null
  return 'Multiple Sites'
}

export function ClientProposalDocument({
  data,
  budgetLines,
  breakupLines,
}: ClientProposalDocumentProps) {
  const siteName = data.siteName ?? deriveSiteName(budgetLines)
  const unmappedLines = getUnmappedBreakupLines(breakupLines)
  const hasUnmappedLines = unmappedLines.length > 0
  const roleGroups = hasUnmappedLines ? [] : buildBreakupRoleGroups(breakupLines, budgetLines)

  return (
    <div className="proposal-document w-full rounded-lg border border-gray-200 bg-white p-6 shadow-lg sm:p-8 print:border-0 print:p-0 print:shadow-none">
      {/* Section 1: Header */}
      <header className="mb-8 overflow-hidden rounded-lg border border-gray-200">
        {/* Brand header bar */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/LOGO-2-1.webp"
              alt="Logicon"
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span
              style={{
                fontFamily: "'Montserrat', sans-serif",
                letterSpacing: '0.18em',
                backgroundImage: 'var(--wordmark-gradient)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
              className="text-lg font-black"
            >
              LOGICON
            </span>
          </div>
          <span className="text-sm text-gray-500">Enterprise ATS & Workforce</span>
        </div>
        {/* Title */}
        <div className="bg-brand-800 px-6 py-3">
          <h1 className="text-center text-xl font-bold tracking-wide text-white">COMMERCIAL PROPOSAL</h1>
        </div>
        {/* Client info */}
        <div className="grid grid-cols-1 gap-4 border border-gray-200 bg-white p-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-gray-500">Prepared for</p>
            <p className="font-semibold text-gray-900">{data.clientName}</p>
            {data.contactPerson && <p className="text-gray-600">{data.contactPerson}</p>}
          </div>
          <div className="text-left sm:text-right">
            {siteName && (
              <div className="mb-2">
                <p className="text-gray-500">Site / Location</p>
                <p className="font-semibold text-gray-900">{siteName}</p>
              </div>
            )}
            {data.proposalVersion != null && (
              <p className="text-gray-600">Version {data.proposalVersion}</p>
            )}
            {data.preparedDate && (
              <p className="text-gray-600">Date: {formatShortDate(data.preparedDate)}</p>
            )}
            {data.validUntil && (
              <p className="text-gray-600">Valid until: {formatShortDate(data.validUntil)}</p>
            )}
          </div>
        </div>
      </header>

      {/* Section 2: Executive Summary */}
      <section className="mb-8 print-avoid-break">
        <h2 className="section-header">Executive Summary</h2>
        <p className="mb-4 text-sm text-gray-600">
          We are pleased to submit this manpower services proposal for your consideration.
        </p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {data.manpowerTotal != null && (
              <div>
                <p className="text-xs text-gray-500">Total Manpower</p>
                <p className="text-lg font-bold text-gray-900">{data.manpowerTotal}</p>
              </div>
            )}
            {data.grandTotal && (
              <div>
                <p className="text-xs text-gray-500">Grand Total (Monthly)</p>
                <p className="text-lg font-bold text-emerald-600">{formatAmount(data.grandTotal)}</p>
              </div>
            )}
            {data.gstApplicable != null && (
              <div>
                <p className="text-xs text-gray-500">GST</p>
                <p className="text-sm font-medium text-gray-900">
                  {data.gstApplicable ? 'Applicable' : 'Not Applicable'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Proposed Manpower */}
      {budgetLines.length > 0 && (
        <section className="mb-8 print-avoid-break">
          <h2 className="section-header">Proposed Manpower</h2>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Role / Service</th>
                  <th>Site</th>
                  <th className="text-right">Headcount</th>
                  <th className="text-right">Monthly Rate</th>
                  <th className="text-right">Monthly Amount</th>
                </tr>
              </thead>
              <tbody>
                {budgetLines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.job_role_name || line.description || 'Service'}</td>
                    <td>{line.site_name || '-'}</td>
                    <td className="text-right">{line.manpower_count ?? '-'}</td>
                    <td className="text-right">{formatAmount(line.unit_cost)}</td>
                    <td className="text-right font-medium">{formatAmount(line.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 4: Commercial Summary */}
      <section className="mb-8 print-avoid-break">
        <h2 className="section-header">Commercial Summary</h2>
        <div className="rounded-lg border border-gray-200 p-4">
          {data.subtotalAmount && (
            <div className="summary-row">
              <span className="summary-label">Manpower Subtotal</span>
              <span className="summary-value">{formatAmount(data.subtotalAmount)}</span>
            </div>
          )}
          {data.managementFeeAmount && (
            <div className="summary-row">
              <span className="summary-label">Management Fee</span>
              <span className="summary-value">{formatAmount(data.managementFeeAmount)}</span>
            </div>
          )}
          {data.managementFeePercent && !data.managementFeeAmount && (
            <div className="summary-row">
              <span className="summary-label">Management Fee</span>
              <span className="summary-value">{formatPercent(data.managementFeePercent)}</span>
            </div>
          )}
          {data.gstAmount && (
            <div className="summary-row">
              <span className="summary-label">GST (18%)</span>
              <span className="summary-value">{formatAmount(data.gstAmount)}</span>
            </div>
          )}
          {data.gstApplicable && !data.gstAmount && (
            <div className="summary-row">
              <span className="summary-label">GST</span>
              <span className="summary-value">Applicable as per law</span>
            </div>
          )}
          {data.grandTotal && (
            <div className="summary-row border-t-2 border-gray-200 pt-3">
              <span className="summary-label font-semibold">Grand Total</span>
              <span className="summary-total font-bold">{formatAmount(data.grandTotal)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Section 5: Role-wise Cost Structure */}
      <section className="mb-8 print-break-before">
        <h2 className="section-header">Role-wise Cost Structure</h2>

        {hasUnmappedLines ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">
                  Role-wise cost structure is unavailable
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  Proposal breakup lines are missing role references. Please ensure all salary
                  components are mapped to their respective roles.
                </p>
              </div>
            </div>
          </div>
        ) : roleGroups.length === 0 ? (
          <p className="text-sm text-gray-500">No salary breakup data available.</p>
        ) : (
          <div className="space-y-6">
            {roleGroups.map((group) => (
              <div
                key={group.groupKey}
                className="overflow-hidden rounded-lg border border-gray-200 print-avoid-break"
              >
                {/* Role header */}
                <div className="bg-brand-800 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-white">{group.title}</h3>
                      {group.siteName && (
                        <p className="text-sm text-white/80">{group.siteName}</p>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm">
                      {group.headcount != null && (
                        <div>
                          <span className="text-white/70">Headcount: </span>
                          <span className="font-medium text-white">{group.headcount}</span>
                        </div>
                      )}
                      {group.unitCost && (
                        <div>
                          <span className="text-white/70">Per Person: </span>
                          <span className="font-medium text-white">{formatAmount(group.unitCost)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Component sections */}
                <div className="divide-y divide-gray-100">
                  {group.sections.map((section) => (
                    <div key={section.componentType} className="px-4 py-3">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {section.label}
                      </h4>
                      <table className="w-full">
                        <thead>
                          <tr className="text-xs text-gray-500">
                            <th className="pb-1 text-left font-medium">Component</th>
                            <th className="pb-1 text-right font-medium">%</th>
                            <th className="pb-1 text-right font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {section.rows.map((row) => (
                            <tr key={row.id}>
                              <td className="py-1">{row.component_name || '-'}</td>
                              <td className="py-1 text-right text-gray-600">
                                {row.percentage ? formatPercent(row.percentage) : '-'}
                              </td>
                              <td className="py-1 text-right font-medium">
                                {formatAmount(row.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200 text-sm font-medium">
                            <td className="pt-2">{section.label} Total</td>
                            <td className="pt-2"></td>
                            <td className="pt-2 text-right">{formatAmount(section.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}
                </div>

                {/* Role total */}
                <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">Role Total (per person)</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatAmount(group.total)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 6: Terms & Assumptions */}
      <section className="print-avoid-break">
        <h2 className="section-header">Terms &amp; Assumptions</h2>
        <ul className="space-y-2">
          {PROPOSAL_TERMS_LIST.map((term, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400" />
              {term}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
