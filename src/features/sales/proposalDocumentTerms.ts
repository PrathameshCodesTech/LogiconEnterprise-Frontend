/**
 * Centralized terms and assumptions wording for client proposal documents.
 * These can be reused by backend PDF generation in Phase 2.
 */

export const PROPOSAL_TERMS = {
  commercials_monthly: 'All commercial values are monthly unless otherwise specified.',
  taxes_applicable: 'Taxes (GST) are applicable as per prevailing laws.',
  statutory_rules: 'Statutory components are calculated as per configured compliance rules.',
  subject_approval: 'This proposal is subject to client acceptance and final confirmation.',
  deployment_onboarding: 'Final deployment is contingent upon successful onboarding completion.',
  validity: 'Proposal validity is as per the dates mentioned in the document header.',
} as const

export const PROPOSAL_TERMS_LIST = Object.values(PROPOSAL_TERMS)
