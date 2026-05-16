import {
  finalizationStatusLabel,
  proposedUserInviteStatusLabel,
  proposedUserScopeLabel,
  proposedUserTypeLabel,
} from '@/features/clientOnboarding/types'
import { ProposedBudgetSections } from '@/features/clientOnboarding/proposedBudgetUx'
import type { WorkflowMyTask, WorkflowTaskClientOnboarding, WorkflowTaskOnboardingProposedSite } from '@/features/workflow/types'
import { Badge } from '@/components/ui/Badge'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import {
  activeBadge,
  displayText,
  formatDate,
  formatMoney,
  formatWhen,
  humanize,
} from '@/features/workflowTasks/workflowTaskOnboardingViews'

function humanizeOnboardingType(code: string): string {
  if (code === 'new_client') return 'New client'
  if (code === 'new_site_expansion') return 'New site expansion'
  return humanize(code)
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-app-subtle">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-app-text">{value}</p>
    </div>
  )
}

export function OnboardingOverviewTab({ task, ob }: { task: WorkflowMyTask; ob: WorkflowTaskClientOnboarding }) {
  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Request</dt>
        <dd className="mt-1 font-medium text-app-text">{task.target_title}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Current approval</dt>
        <dd className="mt-1 text-app-text">{task.step_name}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Assigned department</dt>
        <dd className="mt-1 text-app-text">{task.assigned_department_name?.trim() || '-'}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Request status</dt>
        <dd className="mt-1 text-app-text">{humanize(task.target_status)}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Onboarding type</dt>
        <dd className="mt-1 text-app-text">{humanizeOnboardingType(ob.onboarding_type)}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Finalization status</dt>
        <dd className="mt-1 text-app-text">{finalizationStatusLabel(ob.finalization_status)}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Expected sites count</dt>
        <dd className="mt-1 text-app-text">{displayText(ob.expected_sites_count)}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Activated</dt>
        <dd className="mt-1 text-app-secondary">{formatWhen(task.activated_at)}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Due</dt>
        <dd className="mt-1 text-app-secondary">{formatWhen(task.due_at)}</dd>
      </div>
    </dl>
  )
}

export function ClientTabOnboarding({ ob }: { ob: WorkflowTaskClientOnboarding }) {
  const isNewClient = ob.onboarding_type === 'new_client'
  if (isNewClient) {
    return (
      <div className="space-y-4">
        <FieldBlock label="Proposed client name" value={displayText(ob.proposed_client_name)} />
        <FieldBlock label="Proposed client code" value={displayText(ob.proposed_client_code)} />
        <FieldBlock label="Contact name" value={displayText(ob.proposed_contact_name)} />
        <FieldBlock label="Contact email" value={displayText(ob.proposed_contact_email)} />
        <FieldBlock label="Contact phone" value={displayText(ob.proposed_contact_phone)} />
        <FieldBlock label="Industry" value={displayText(ob.proposed_industry)} />
        <FieldBlock label="Billing address" value={displayText(ob.proposed_billing_address)} />
        <FieldBlock label="GST number" value={displayText(ob.proposed_gst_number)} />
        <FieldBlock label="Summary" value={displayText(ob.summary)} />
        <FieldBlock label="Notes" value={displayText(ob.notes)} />
      </div>
    )
  }
  const clientLabel =
    ob.client_name?.trim() ?
      ob.client != null ?
        `${ob.client_name} (#${ob.client})`
      : ob.client_name
    : ob.client != null ?
      `#${ob.client}`
    : '-'
  return (
    <div className="space-y-4">
      <FieldBlock label="Existing client" value={clientLabel} />
      <FieldBlock label="Proposed setup summary" value={displayText(ob.summary)} />
      <FieldBlock label="Notes" value={displayText(ob.notes)} />
    </div>
  )
}


function SiteCard({ site }: { site: WorkflowTaskOnboardingProposedSite }) {
  return (
    <div className="rounded-panel border border-app-border bg-app-muted p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-app-text">
          {displayText(site.name)}
          {site.code?.trim() ? <span className="ml-1 font-mono text-xs text-app-secondary">({site.code})</span> : null}
        </p>
        {activeBadge(site.is_active)}
      </div>
      <p className="mt-2 text-xs text-app-secondary">
        {displayText(site.city)}, {displayText(site.state)} {displayText(site.pincode)}
      </p>
      <p className="mt-1 text-xs text-app-secondary">{displayText(site.address)}</p>
      <p className="mt-2 text-xs text-app-secondary">
        Contact: {displayText(site.contact_person)} / {displayText(site.contact_phone)} / {displayText(site.contact_email)}
      </p>
      <p className="mt-1 text-xs text-app-secondary">Location area: {displayText(site.location_area_name)}</p>
    </div>
  )
}

export function SitesTabOnboarding({ ob }: { ob: WorkflowTaskClientOnboarding }) {
  const sites = ob.proposed_sites ?? []
  if (sites.length === 0) {
    return <p className="text-sm text-app-secondary">No proposed sites found.</p>
  }
  return (
    <div className="space-y-4">
      <div className="hidden md:block overflow-x-auto rounded-panel border border-app-border">
        <Table>
          <THead>
            <TR>
              <TH className="py-2">Site</TH>
              <TH className="py-2">Location</TH>
              <TH className="py-2">Address</TH>
              <TH className="py-2">Contact</TH>
              <TH className="py-2">Location area</TH>
              <TH className="py-2">Status</TH>
            </TR>
          </THead>
          <TBody>
            {sites.map((site) => (
              <TR key={site.id}>
                <TD className="py-2 text-sm">
                  <span className="font-medium text-app-text">{displayText(site.name)}</span>
                  {site.code?.trim() ? (
                    <span className="ml-1 font-mono text-xs text-app-secondary">({site.code})</span>
                  ) : null}
                </TD>
                <TD className="py-2 text-xs text-app-secondary">
                  {displayText(site.city)}, {displayText(site.state)} {displayText(site.pincode)}
                </TD>
                <TD className="py-2 text-xs text-app-secondary">{displayText(site.address)}</TD>
                <TD className="py-2 text-xs text-app-secondary">
                  {displayText(site.contact_person)}
                  <br />
                  {displayText(site.contact_phone)} / {displayText(site.contact_email)}
                </TD>
                <TD className="py-2 text-xs text-app-secondary">{displayText(site.location_area_name)}</TD>
                <TD className="py-2">{activeBadge(site.is_active)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        {sites.map((site) => (
          <SiteCard key={site.id} site={site} />
        ))}
      </div>
    </div>
  )
}


export function DepartmentsTabOnboarding({ ob }: { ob: WorkflowTaskClientOnboarding }) {
  const rows = ob.proposed_departments ?? []
  if (rows.length === 0) {
    return <p className="text-sm text-app-secondary">No proposed departments found.</p>
  }
  return (
    <div className="overflow-x-auto rounded-panel border border-app-border">
      <Table>
        <THead>
          <TR>
            <TH className="py-2">Department</TH>
            <TH className="py-2">Scope</TH>
            <TH className="py-2">Proposed site</TH>
            <TH className="py-2">Description</TH>
            <TH className="py-2">Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id}>
              <TD className="py-2 text-sm">
                <span className="font-medium text-app-text">{displayText(row.name)}</span>
                {row.code?.trim() ? (
                  <span className="ml-1 font-mono text-xs text-app-secondary">({row.code})</span>
                ) : null}
              </TD>
              <TD className="py-2 text-xs text-app-secondary">{humanize(row.scope_level)}</TD>
              <TD className="py-2 text-xs text-app-secondary">{displayText(row.proposed_site_name)}</TD>
              <TD className="py-2 text-xs text-app-secondary">{displayText(row.description)}</TD>
              <TD className="py-2">{activeBadge(row.is_active)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  )
}

export function RoleRequirementsTabOnboarding({ ob }: { ob: WorkflowTaskClientOnboarding }) {
  const rows = ob.proposed_role_requirements ?? []
  if (rows.length === 0) {
    return <p className="text-sm text-app-secondary">No proposed role requirements found.</p>
  }
  return (
    <div className="overflow-x-auto rounded-panel border border-app-border">
      <Table>
        <THead>
          <TR>
            <TH className="py-2">Site</TH>
            <TH className="py-2">Department</TH>
            <TH className="py-2">Job role</TH>
            <TH className="py-2">Headcount</TH>
            <TH className="py-2">Billing</TH>
            <TH className="py-2">Wages</TH>
            <TH className="py-2">Effective</TH>
            <TH className="py-2">Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id}>
              <TD className="py-2 text-xs text-app-secondary">{displayText(row.proposed_site_name)}</TD>
              <TD className="py-2 text-xs text-app-secondary">{displayText(row.proposed_department_name)}</TD>
              <TD className="py-2 text-sm">{displayText(row.job_role_name)}</TD>
              <TD className="py-2 text-sm">{row.approved_headcount}</TD>
              <TD className="py-2 text-xs text-app-secondary">
                {humanize(row.billing_type)}
                <br />
                {formatMoney(row.billing_rate, null)}
              </TD>
              <TD className="py-2 text-xs text-app-secondary">
                {formatMoney(row.wage_min, null)} - {formatMoney(row.wage_max, null)}
                <br />
                Shift: {displayText(row.shift_hours)} / {displayText(row.wage_category_name)}
              </TD>
              <TD className="py-2 text-xs text-app-secondary">
                {formatDate(row.effective_from)} - {formatDate(row.effective_to)}
              </TD>
              <TD className="py-2">{activeBadge(row.is_active)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  )
}

export function BudgetsTabOnboarding({ ob }: { ob: WorkflowTaskClientOnboarding }) {
  const rows = ob.proposed_budgets ?? []
  return (
    <ProposedBudgetSections
      budgets={rows}
      title="Proposed budgets"
      emptyMessage="No proposed budgets found."
    />
  )
}

export function UsersTabOnboarding({ ob }: { ob: WorkflowTaskClientOnboarding }) {
  const users = ob.proposed_users ?? []
  if (users.length === 0) {
    return <p className="text-sm text-app-secondary">No proposed users found.</p>
  }
  return (
    <div className="overflow-x-auto rounded-panel border border-app-border">
      <Table>
        <THead>
          <TR>
            <TH className="py-2">Name / email</TH>
            <TH className="py-2">Phone</TH>
            <TH className="py-2">User type</TH>
            <TH className="py-2">Access role</TH>
            <TH className="py-2">Scope</TH>
            <TH className="py-2">Site</TH>
            <TH className="py-2">Contact</TH>
            <TH className="py-2">Invite</TH>
            <TH className="py-2">Created user</TH>
            <TH className="py-2">Status</TH>
          </TR>
        </THead>
        <TBody>
          {users.map((u) => (
            <TR key={u.id}>
              <TD className="py-2 text-sm">
                <span className="font-medium text-app-text">{displayText(u.full_name)}</span>
                <br />
                <span className="text-xs text-app-secondary">{displayText(u.email)}</span>
              </TD>
              <TD className="py-2 text-xs text-app-secondary">{displayText(u.phone)}</TD>
              <TD className="py-2 text-xs">{proposedUserTypeLabel(u.user_type)}</TD>
              <TD className="py-2 text-xs text-app-secondary">
                {u.access_role_name?.trim() ?
                  u.access_role_code?.trim() ?
                    `${u.access_role_name} (${u.access_role_code})`
                  : u.access_role_name
                : displayText(u.access_role_code ?? (u.access_role != null ? `#${u.access_role}` : null))}
              </TD>
              <TD className="py-2 text-xs">{proposedUserScopeLabel(u.scope_level)}</TD>
              <TD className="py-2 text-xs text-app-secondary">{displayText(u.proposed_site_name)}</TD>
              <TD className="py-2">
                {u.is_primary_contact ?
                  <Badge variant="info">Primary contact</Badge>
                : <span className="text-xs text-app-subtle">—</span>}
              </TD>
              <TD className="py-2 text-xs text-app-secondary">{proposedUserInviteStatusLabel(u.invite_status)}</TD>
              <TD className="py-2 text-xs text-app-secondary">
                {u.created_user != null && u.created_user > 0 ? `#${u.created_user}` : '—'}
              </TD>
              <TD className="py-2">{activeBadge(u.is_active)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  )
}

