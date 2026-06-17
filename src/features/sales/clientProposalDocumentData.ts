/**
 * Normalized data type for client proposal documents.
 * Adapters convert internal and public API responses to this common shape.
 */

import type { ProposalVersion, SalesLead, PublicProposalResponse } from '@/types/sales'

export interface ClientProposalDocumentData {
  clientName: string
  clientEmail?: string | null
  contactPerson?: string | null
  siteName?: string | null
  proposalVersion?: number | null
  preparedDate?: string | null
  validUntil?: string | null
  manpowerTotal?: number | null
  subtotalAmount?: string | null
  managementFeeAmount?: string | null
  managementFeePercent?: string | null
  gstAmount?: string | null
  gstApplicable?: boolean | null
  grandTotal?: string | null
  notes?: string | null
}

function hasPositiveAmount(value: string | null | undefined): boolean | null {
  if (value == null || value === '') return null
  const n = Number.parseFloat(value.replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  return n > 0
}

/**
 * Convert internal proposal + lead data to normalized document data.
 * Used by internal preview page.
 */
export function clientProposalDataFromInternal(
  proposal: ProposalVersion,
  lead: SalesLead | null,
): ClientProposalDocumentData {
  return {
    clientName: lead?.client_name ?? 'Client',
    clientEmail: lead?.client_email ?? null,
    contactPerson: lead?.client_contact_person ?? null,
    siteName: null, // Derived from budget lines if needed
    proposalVersion: proposal.version_number,
    preparedDate: proposal.created_at ?? null,
    validUntil: proposal.valid_to ?? null,
    manpowerTotal: proposal.manpower_total ?? null,
    subtotalAmount: proposal.subtotal_amount ?? null,
    managementFeeAmount: proposal.management_fee_amount ?? null,
    managementFeePercent: null, // Internal API has amount, not percent
    gstAmount: proposal.gst_amount ?? null,
    gstApplicable: hasPositiveAmount(proposal.gst_amount),
    grandTotal: proposal.grand_total ?? null,
    notes: proposal.notes ?? null,
  }
}

/**
 * Convert public proposal response to normalized document data.
 * Used by public response page.
 * Note: Public API does not expose subtotal, management fee amount, or gst amount.
 */
export function clientProposalDataFromPublic(
  data: PublicProposalResponse,
): ClientProposalDocumentData {
  return {
    clientName: data.client_name ?? 'Client',
    clientEmail: data.client_email ?? null,
    contactPerson: data.client_contact_person ?? null,
    siteName: null,
    proposalVersion: data.proposal_version_number ?? null,
    preparedDate: null, // Public API does not expose created_at
    validUntil: data.valid_to ?? null,
    manpowerTotal: data.manpower_total ?? null,
    subtotalAmount: null, // Public API does not expose subtotal
    managementFeeAmount: null, // Public API has percent, not amount
    managementFeePercent: data.management_fee_percent ?? null,
    gstAmount: null, // Public API does not expose gst amount
    gstApplicable: data.gst_applicable ?? null,
    grandTotal: data.grand_total ?? null,
    notes: data.notes ?? null,
  }
}
