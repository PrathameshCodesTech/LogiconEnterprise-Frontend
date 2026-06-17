# Client Proposal Document Preview - Implementation Plan

## Goal

Create an enterprise-grade client-facing proposal preview that looks like a professional document/PDF, not internal app tables. This validates the document structure before building backend PDF generation.

---

## Existing Code Analysis

### Data Sources (Already Available)
- `getProposalVersion(id)` → ProposalVersion (main proposal with financials)
- `listProposalBudgetLines({proposal_version})` → ProposalBudgetLine[] (role/cost structure)
- `listProposalBreakupLines({proposal_version})` → ProposalBreakupLine[] (salary components)
- `getSalesLead(leadId)` → SalesLead (client context)
- `getPublicProposalResponse(token)` → PublicProposalResponse (public API already combines all data)

### Existing Helper (Reusable)
- `buildBreakupRoleGroups()` in `salesBreakupGrouping.ts` - groups breakup by role_requirement
- `getUnmappedBreakupLines()` - validates role mapping completeness

### Key Insight
The `role_requirement` field links budget lines ↔ breakup lines. Grouping already works via `groupKey = "req:{roleRequirementId}"`.

---

## New Files to Create

### 1. `src/features/sales/proposalDocumentTerms.ts`
Centralized terms & assumptions wording for reuse by backend PDF later.

```typescript
export const PROPOSAL_TERMS = {
  commercials_monthly: 'All commercial values are monthly unless otherwise specified.',
  taxes_applicable: 'Taxes (GST) are applicable as per prevailing laws.',
  statutory_rules: 'Statutory components are calculated as per configured compliance rules.',
  subject_approval: 'This proposal is subject to client acceptance and final confirmation.',
  deployment_onboarding: 'Final deployment is contingent upon successful onboarding completion.',
  validity: 'Proposal validity is as per the dates mentioned in the document header.',
}

export const PROPOSAL_TERMS_LIST = Object.values(PROPOSAL_TERMS)
```

### 2. `src/features/sales/ClientProposalDocument.tsx`
Main reusable document component.

**Props Interface:**
```typescript
interface ClientProposalDocumentProps {
  // Core data
  proposal: ProposalVersion
  lead: SalesLead | null
  budgetLines: ProposalBudgetLine[]
  breakupLines: ProposalBreakupLine[]

  // Context
  clientName?: string
  clientEmail?: string
  siteName?: string

  // Mode
  isPublic?: boolean  // true for public response page
  showActions?: boolean  // show print button etc.

  // Metadata
  generatedAt?: string
  sentAt?: string
}
```

**Document Sections:**
1. Header (branding, title, client, dates)
2. Executive Summary (totals, manpower count)
3. Proposed Manpower (role-wise budget lines table)
4. Commercial Summary (subtotal, fees, GST, grand total)
5. Role-wise Cost Structure (grouped breakup, strict mode)
6. Terms & Assumptions (static wording from constants)

### 3. `src/features/sales/ClientProposalPreviewPage.tsx`
Full-page preview route for internal users.

**Route:** `/sales/proposals/:id/preview`

**Features:**
- Loads proposal data
- Renders `ClientProposalDocument`
- Print button
- Back to workspace button

### 4. `src/features/sales/clientProposalDocument.css`
Print-friendly styles (separate file for clarity).

```css
@media print {
  /* Hide app chrome */
  .no-print { display: none !important; }

  /* Page setup */
  @page {
    size: A4;
    margin: 20mm;
  }

  /* Section breaks */
  .print-break-before { page-break-before: always; }
  .print-avoid-break { page-break-inside: avoid; }

  /* Clean backgrounds */
  body { background: white !important; }
}
```

---

## Existing Files to Modify

### 1. `SalesProposalWorkspacePage.tsx`

**Add "Preview client proposal" button** near the Client Response tab area.

Location: In the tab content area or header actions.

```tsx
// Near send to client / client response section
<Button variant="secondary" onClick={() => navigate(`/sales/proposals/${proposalId}/preview`)}>
  <FileText className="mr-1.5 h-4 w-4" />
  Preview client proposal
</Button>
```

### 2. `PublicProposalResponsePage.tsx`

**Add "View proposal" collapsible section** that renders `ClientProposalDocument` in public/readonly mode.

The existing page already shows proposal details inline. We wrap those details with the new document component for consistency.

```tsx
// Add toggle to show formal document view
<Button variant="secondary" onClick={() => setShowFormalDocument(true)}>
  <FileText className="mr-1.5 h-4 w-4" />
  View formal proposal
</Button>

{showFormalDocument && (
  <ClientProposalDocument
    proposal={mappedProposal}
    lead={null}
    budgetLines={mappedBudgetLines}
    breakupLines={mappedBreakupLines}
    clientName={data.client_name}
    isPublic
    showActions={false}
  />
)}
```

### 3. `src/app/routes.tsx`

**Add preview route:**
```tsx
{
  path: 'sales/proposals/:id/preview',
  element: (
    <RequireCapability anyOf={[CAP.SALES_PROPOSAL_READ]}>
      <ClientProposalPreviewPage />
    </RequireCapability>
  ),
}
```

---

## Document Structure Detail

### Section 1: Header
```
┌─────────────────────────────────────────────────┐
│  [Logicon Logo]                                 │
│                                                 │
│           COMMERCIAL PROPOSAL                   │
│                                                 │
│  Prepared for: {client_name}                    │
│  Site/Location: {site_name || 'Multiple Sites'} │
│  Version: {version_number}                      │
│  Date: {created_at formatted}                   │
│  Valid until: {valid_to || 'As discussed'}      │
└─────────────────────────────────────────────────┘
```

### Section 2: Executive Summary
```
We are pleased to submit this manpower services proposal
for your consideration.

┌──────────────────┬──────────────────┐
│ Total Manpower   │ {manpower_total} │
│ Monthly Value    │ {grand_total}    │
│ GST              │ {gst_amount}     │
│ Grand Total      │ {grand_total}    │
└──────────────────┴──────────────────┘
```

### Section 3: Proposed Manpower
```
┌──────────────────┬────────┬──────────┬────────────┬──────────────┐
│ Role / Service   │ Site   │ Headcount│ Monthly Rate│ Monthly Amt  │
├──────────────────┼────────┼──────────┼────────────┼──────────────┤
│ Security Guard   │ HQ     │ 10       │ ₹25,000    │ ₹2,50,000    │
│ Housekeeping     │ HQ     │ 5        │ ₹18,000    │ ₹90,000      │
│ ...              │        │          │            │              │
└──────────────────┴────────┴──────────┴────────────┴──────────────┘
```

### Section 4: Commercial Summary
```
┌─────────────────────────────────────┐
│ Manpower Subtotal    ₹3,40,000      │
│ Management Fee (X%)  ₹34,000        │
│ GST (18%)            ₹67,320        │
│ ─────────────────────────────────── │
│ GRAND TOTAL          ₹4,41,320      │
└─────────────────────────────────────┘
```

### Section 5: Role-wise Cost Structure
**Per role group (from `buildBreakupRoleGroups`):**

```
┌─────────────────────────────────────────────────┐
│ SECURITY GUARD - HQ                             │
│ Headcount: 10 | Monthly per person: ₹25,000     │
├─────────────────────────────────────────────────┤
│ Earnings                                        │
│   Basic              50%        ₹12,500         │
│   DA                 25%        ₹6,250          │
│   HRA                10%        ₹2,500          │
├─────────────────────────────────────────────────┤
│ Employee Deductions                             │
│   Employee PF        12%        ₹1,500          │
│   Employee ESI       0.75%      ₹187            │
├─────────────────────────────────────────────────┤
│ Employer Contributions                          │
│   Employer PF        13%        ₹1,625          │
│   Employer ESI       3.25%      ₹812            │
└─────────────────────────────────────────────────┘
```

**Strict mode:** If `getUnmappedBreakupLines()` returns any lines, show error instead of table:
```
⚠ Role-wise cost structure is unavailable because proposal breakup
  lines are missing role references.
```

### Section 6: Terms & Assumptions
```
Terms & Assumptions
───────────────────
• All commercial values are monthly unless otherwise specified.
• Taxes (GST) are applicable as per prevailing laws.
• Statutory components are calculated as per configured compliance rules.
• This proposal is subject to client acceptance and final confirmation.
• Final deployment is contingent upon successful onboarding completion.
```

---

## Styling Approach

### Document Container
```tsx
<div className="mx-auto max-w-[210mm] bg-white shadow-lg print:shadow-none">
  {/* A4-like width, centered */}
</div>
```

### Colors (Restrained)
- Background: `bg-white`
- Text: `text-gray-900` (not app tokens - document should be neutral)
- Borders: `border-gray-200`
- Headers: `text-gray-800 font-semibold`
- Subtle: `text-gray-600`

### Tables
- Clean borders, no nested cards
- Zebra striping optional
- Right-align numbers
- No internal IDs or codes visible

### Print
- `@media print` rules hide app buttons
- Page breaks before major sections
- White background forced

---

## Data Mapping

### Internal → Document
```typescript
// From ProposalVersion
const documentData = {
  versionNumber: proposal.version_number,
  preparedDate: formatDate(proposal.created_at),
  validUntil: proposal.valid_to ? formatDate(proposal.valid_to) : null,
  manpowerTotal: proposal.manpower_total,
  subtotal: proposal.subtotal_amount,
  managementFee: proposal.management_fee_amount,
  gst: proposal.gst_amount,
  grandTotal: proposal.grand_total,
}

// From SalesLead
const clientContext = {
  clientName: lead?.client_name || 'Client',
  contactPerson: lead?.client_contact_person,
}

// From BudgetLines
const proposedManpower = budgetLines.map(line => ({
  role: line.job_role_name || line.description || 'Service',
  site: line.site_name || '-',
  headcount: line.manpower_count || 0,
  monthlyRate: line.unit_cost,
  monthlyAmount: line.total_cost,
}))

// From BreakupLines (via buildBreakupRoleGroups)
const roleGroups = buildBreakupRoleGroups(breakupLines, budgetLines)
```

### Public API → Document
```typescript
// PublicProposalResponse already provides combined data
// Map to same structure used internally
```

---

## Validation Rules

1. **Role mapping required for cost structure:**
   ```typescript
   const unmapped = getUnmappedBreakupLines(breakupLines)
   if (unmapped.length > 0) {
     // Show warning, don't render mixed breakup
   }
   ```

2. **No fallback grouping:**
   - Do not show "Unmapped Components" section
   - Show clear error message instead

3. **Hidden fields (never show in client document):**
   - `id`, `proposal_version`, `role_requirement` (IDs)
   - `sort_order`
   - `is_manual_override`
   - Internal `component_code`
   - `remarks` (internal notes)

---

## Actions Summary

### Internal Workspace
| Action | Implementation |
|--------|----------------|
| Preview client proposal | Navigate to `/sales/proposals/:id/preview` |
| Print / Save as PDF | `window.print()` with print CSS |
| Send to client | Existing flow unchanged |

### Public Response Page
| Action | Implementation |
|--------|----------------|
| View formal proposal | Toggle to show `ClientProposalDocument` |
| Print / Save as PDF | `window.print()` with print CSS |
| Respond | Existing response form unchanged |

---

## File Creation Order

1. `proposalDocumentTerms.ts` (constants)
2. `clientProposalDocument.css` (print styles)
3. `ClientProposalDocument.tsx` (main component)
4. `ClientProposalPreviewPage.tsx` (route page)
5. Update `routes.tsx` (add route)
6. Update `SalesProposalWorkspacePage.tsx` (add button)
7. Update `PublicProposalResponsePage.tsx` (add view)

---

## Verification Commands

```bash
# Build check
npm run build

# Security audit
rg "alert\(|confirm\(|prompt\(" src/features/sales src/api

# Type safety
rg ": any\b|as any\b|<any>|TODO" src/features/sales src/api

# Verify new files exist
ls src/features/sales/ClientProposalDocument.tsx
ls src/features/sales/ClientProposalPreviewPage.tsx
ls src/features/sales/proposalDocumentTerms.ts
```

### Manual Testing Checklist
- [ ] Internal proposal workspace shows "Preview client proposal" button
- [ ] Preview opens full-page document view
- [ ] Document shows all 6 sections with correct data
- [ ] Role-wise cost structure groups by role (not mixed)
- [ ] If role mapping missing, shows clear error (no fallback table)
- [ ] Print view hides app buttons
- [ ] Public response page shows "View formal proposal" option
- [ ] Same document layout works in public mode
- [ ] No internal IDs/codes visible in document
- [ ] Currency formatting correct (Indian format)

---

## Not In Scope (Phase 2)

- Backend PDF generation
- Download PDF endpoint
- Email PDF attachment
- Actual PDF file creation

This phase validates the document structure. Phase 2 will implement backend PDF using this exact layout.
