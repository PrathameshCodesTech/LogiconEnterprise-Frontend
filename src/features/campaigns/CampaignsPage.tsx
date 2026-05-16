import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { createCampaign, deleteCampaign, listCampaigns, updateCampaign } from '@/api/campaigns'
import { listSites } from '@/api/sites'
import { useAuthStore } from '@/features/auth/authStore'
import { CAP, hasAnyCapability } from '@/lib/capabilities'
import { parseApiError } from '@/lib/apiError'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { CampaignForm, type CampaignFormValues, type SiteOption } from '@/features/campaigns/CampaignForm'
import { CampaignQRCodeButton } from '@/features/campaigns/CampaignQRCodeButton'
import { CampaignRoleManager } from '@/features/campaigns/CampaignRoleManager'
import type { CampaignRow } from '@/features/campaigns/types'

function parseBoolParam(v: string | null): boolean | undefined {
  if (v === 'true') return true
  if (v === 'false') return false
  return undefined
}

function parseNumParam(v: string | null): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  return n
}

function parsePage(v: string | null): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1) return undefined
  return Math.floor(n)
}

export function CampaignsPage() {
  const meCaps = useAuthStore((s) => s.me?.capabilities ?? [])
  const canCreate = hasAnyCapability(meCaps, [CAP.CAMPAIGN_CREATE])
  const canUpdate = hasAnyCapability(meCaps, [CAP.CAMPAIGN_UPDATE])
  const canDelete = hasAnyCapability(meCaps, [CAP.CAMPAIGN_DELETE])

  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const is_active = parseBoolParam(params.get('is_active'))
  const site = parseNumParam(params.get('site'))
  const page = parsePage(params.get('page')) ?? 1

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CampaignRow[]>([])
  const [count, setCount] = useState<number | undefined>(undefined)

  const [sitesLoading, setSitesLoading] = useState(false)
  const [sitesError, setSitesError] = useState<string | null>(null)
  const [sites, setSites] = useState<{ id: number; name: string; code: string }[]>([])
  const siteOptions: SiteOption[] = useMemo(
    () => sites.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` })),
    [sites],
  )
  const siteNameById = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editing, setEditing] = useState<CampaignRow | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const formId = useMemo(() => `campaign-form-${drawerMode}`, [drawerMode])

  function updateParam(next: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => {
      if (v == null || v === '') p.delete(k)
      else p.set(k, v)
    })
    if (next.search !== undefined || next.is_active !== undefined || next.site !== undefined) {
      p.delete('page')
    }
    setParams(p)
  }

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await listCampaigns({
        search: search || undefined,
        is_active,
        site,
        page,
      })
      setRows(res.items)
      setCount(res.count)
    } catch (e: unknown) {
      setRows([])
      setCount(undefined)
      setError(parseApiError(e, 'Failed to load campaigns').message)
    } finally {
      setLoading(false)
    }
  }

  async function loadSitesLookup() {
    setSitesLoading(true)
    setSitesError(null)
    try {
      const res = await listSites({ search: '', page: 1 })
      setSites(res.items as { id: number; name: string; code: string }[])
    } catch (e: unknown) {
      setSites([])
      setSitesError(parseApiError(e, 'Site lookup failed').message)
    } finally {
      setSitesLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, is_active, site, page])

  useEffect(() => {
    void loadSitesLookup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPages = useMemo(() => {
    if (typeof count !== 'number') return undefined
    return Math.max(1, Math.ceil(count / 50))
  }, [count])

  function openCreate() {
    setDrawerMode('create')
    setEditing(null)
    setFormError(null)
    setDrawerOpen(true)
  }

  function openEdit(r: CampaignRow) {
    setDrawerMode('edit')
    setEditing(r)
    setFormError(null)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setFormSubmitting(false)
    setFormError(null)
  }

  async function submit(values: CampaignFormValues) {
    setFormSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        name: values.name.trim(),
        title: values.title.trim() || undefined,
        code: values.code.trim(),
        site: values.site ? Number(values.site) : null,
        is_active: values.is_active,
        starts_at: values.starts_at ? new Date(values.starts_at).toISOString() : null,
        ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
        allow_duplicates: values.allow_duplicates,
        requires_otp: values.requires_otp,
        shuffle_fields: values.shuffle_fields,
        default_language: values.default_language,
        enabled_languages: values.enabled_languages,
      }

      if (drawerMode === 'create') {
        await createCampaign(payload)
      } else if (editing) {
        await updateCampaign(editing.id, payload)
      }

      closeDrawer()
      await refresh()
    } catch (e: unknown) {
      setFormError(parseApiError(e, 'Save failed').message)
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleDeactivate(r: CampaignRow) {
    if (!canDelete) return
    const ok = window.confirm(`Deactivate campaign "${r.title || r.name}"?`)
    if (!ok) return
    try {
      await deleteCampaign(r.id)
      await refresh()
    } catch (e: unknown) {
      alert(parseApiError(e, 'Deactivate failed').message)
    }
  }

  const mobileCards = (
    <div className="grid gap-3 md:hidden">
      {rows.map((r) => (
        <div key={r.id} className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-app-text">{r.title || r.name}</p>
              <p className="truncate text-xs text-app-secondary">{r.name}</p>
              <p className="truncate text-xs text-app-subtle">Token: {r.token}</p>
              {r.site ? (
                <p className="truncate text-xs text-app-subtle">
                  Site: {siteNameById.get(r.site) ?? `Site #${r.site}`}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {r.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-app-secondary">
            <span>Lang: {r.default_language}</span>
            <span>Enabled: {r.enabled_languages.join(', ')}</span>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <CampaignQRCodeButton campaign={r} />

            {canUpdate ? (
              <Button variant="secondary" className="min-h-9 px-3" onClick={() => openEdit(r)}>
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="danger" className="min-h-9 px-3" onClick={() => handleDeactivate(r)}>
                Deactivate
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app-text">QR campaigns</h2>
          <p className="text-sm text-app-secondary">
            Create campaigns, attach roles, download QR, and share apply links.
          </p>
        </div>
        {canCreate ? (
          <Button onClick={openCreate} className="sm:self-start" disabled={!!sitesError}>
            Create campaign
          </Button>
        ) : null}
      </div>

      {sitesError ? <ErrorState message={`Site lookup failed. Create/Edit is disabled. ${sitesError}`} /> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-app-subtle">Filters</p>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-subtle">
              <Search className="h-4 w-4" aria-hidden />
            </div>
            <input
              value={search}
              onChange={(e) => updateParam({ search: e.target.value })}
              placeholder="Search name, title, code, token"
              className="min-h-10 w-full rounded-panel border border-app-border bg-app-surface pl-10 pr-3 text-sm text-app-text shadow-panel placeholder:text-app-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              aria-label="Search campaigns"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:w-[520px]">
          <Select
            id="campaign_site_filter"
            label="Site"
            value={site ? String(site) : ''}
            onChange={(e) => updateParam({ site: e.target.value || null })}
            disabled={sitesLoading || !!sitesError}
          >
            <option value="">All</option>
            {sites.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </Select>

          <Select
            id="campaign_active_filter"
            label="Status"
            value={typeof is_active === 'boolean' ? String(is_active) : ''}
            onChange={(e) => updateParam({ is_active: e.target.value || null })}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading campaigns..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No campaigns found" description="Try adjusting your filters, or create a new campaign." />
      ) : (
        <>
          {mobileCards}

          <div className="hidden md:block">
            <Table className="shadow-panel">
              <THead>
                <TR>
                  <TH>Campaign</TH>
                  <TH>Token</TH>
                  <TH>Site</TH>
                  <TH>Status</TH>
                  <TH>Languages</TH>
                  <TH>Roles</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id} className="align-top">
                    <TD className="min-w-[260px] py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-app-text">{r.title || r.name}</p>
                        {r.title && r.name ? <p className="text-xs text-app-secondary">{r.name}</p> : null}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-app-subtle">
                          <span className="rounded border border-app-border bg-app-muted px-2 py-0.5 font-mono">
                            {r.code}
                          </span>
                          <span className="font-mono">{r.token}</span>
                        </div>
                        <p className="text-xs text-app-subtle">
                          {r.starts_at ? `Starts: ${new Date(r.starts_at).toLocaleDateString()}` : 'Starts: —'}
                          {r.ends_at ? ` · Ends: ${new Date(r.ends_at).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                    </TD>
                    <TD className="py-4">
                      <span className="font-mono text-xs text-app-secondary">{r.token}</span>
                    </TD>
                    <TD className="py-4 text-sm text-app-secondary">
                      {r.site ? siteNameById.get(r.site) ?? `Site #${r.site}` : '—'}
                    </TD>
                    <TD>{r.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}</TD>
                    <TD className="py-4 text-xs text-app-secondary">
                      <p>
                        <span className="text-app-subtle">Default</span> {r.default_language}
                      </p>
                      <p className="truncate">
                        <span className="text-app-subtle">Enabled</span> {r.enabled_languages.join(', ')}
                      </p>
                    </TD>
                    <TD className="py-4 text-xs">
                      <div className="flex max-w-[260px] flex-wrap gap-1.5">
                        {r.campaign_roles?.length ? (
                          r.campaign_roles.map((cr) => (
                            <Badge key={cr.id} variant={cr.is_active ? 'info' : 'neutral'}>
                              {cr.job_role_code}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-app-subtle">—</span>
                        )}
                      </div>
                    </TD>
                    <TD className="py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <CampaignQRCodeButton campaign={r} variant="compact" />
                      </div>
                      <div className="mt-2 flex justify-end gap-2">
                        {canUpdate ? (
                          <Button variant="secondary" className="min-h-9 px-3" onClick={() => openEdit(r)}>
                            Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button variant="danger" className="min-h-9 px-3" onClick={() => handleDeactivate(r)}>
                            Deactivate
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {typeof totalPages === 'number' ? (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-sm text-app-secondary">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => updateParam({ page: String(page - 1) })}>
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  disabled={totalPages ? page >= totalPages : rows.length < 50}
                  onClick={() => updateParam({ page: String(page + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <Drawer
        open={drawerOpen}
        title={drawerMode === 'create' ? 'Create campaign' : 'Edit campaign'}
        description={drawerMode === 'create' ? 'Set up a QR campaign and public apply form behavior.' : 'Update campaign settings.'}
        onClose={closeDrawer}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closeDrawer} disabled={formSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form={formId} disabled={formSubmitting || !!sitesError}>
              {formSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      >
        <CampaignForm
          formId={formId}
          mode={drawerMode}
          initialCampaign={editing}
          siteOptions={siteOptions}
          lookupError={sitesError}
          submitting={formSubmitting}
          errorMessage={formError}
          onSubmit={submit}
        />

        {drawerMode === 'edit' && editing ? (
          <div className="mt-6">
            <CampaignRoleManager campaignId={editing.id} />
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}


