import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createCampaignJobRole, deleteCampaignJobRole, listCampaignJobRoles, updateCampaignJobRole } from '@/api/campaignJobRoles'
import { listJobRoles } from '@/api/jobs'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { parseApiError } from '@/lib/apiError'
import type { CampaignJobRoleRow } from '@/features/campaigns/types'

type JobRoleLookup = { id: number; name: string; code: string }

export function CampaignRoleManager({ campaignId }: { campaignId: number }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CampaignJobRoleRow[]>([])

  const [jobRolesLoading, setJobRolesLoading] = useState(true)
  const [jobRolesError, setJobRolesError] = useState<string | null>(null)
  const [jobRoles, setJobRoles] = useState<JobRoleLookup[]>([])

  const [selectedJobRole, setSelectedJobRole] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const activeRoles = useMemo(() => rows.filter((r) => r.is_active), [rows])
  const inactiveRoles = useMemo(() => rows.filter((r) => !r.is_active), [rows])
  const activeJobRoleIds = useMemo(() => new Set(activeRoles.map((r) => r.job_role)), [activeRoles])
  const inactiveByJobRoleId = useMemo(() => new Map(inactiveRoles.map((r) => [r.job_role, r])), [inactiveRoles])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await listCampaignJobRoles({ campaign: campaignId, page: 1 })
      setRows(res.items)
    } catch (e: unknown) {
      setRows([])
      setError(parseApiError(e, 'Failed to load campaign roles').message)
    } finally {
      setLoading(false)
    }
  }

  async function loadJobRoles() {
    setJobRolesLoading(true)
    setJobRolesError(null)
    try {
      const res = await listJobRoles('')
      setJobRoles(res as JobRoleLookup[])
    } catch (e: unknown) {
      setJobRoles([])
      setJobRolesError(parseApiError(e, 'Job roles lookup failed').message)
    } finally {
      setJobRolesLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    void loadJobRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  async function handleAdd() {
    if (!selectedJobRole || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const jobRoleId = Number(selectedJobRole)
      const inactive = inactiveByJobRoleId.get(jobRoleId)
      if (inactive) {
        await updateCampaignJobRole(inactive.id, { is_active: true })
      } else {
        await createCampaignJobRole({ campaign: campaignId, job_role: jobRoleId, is_active: true })
      }
      setSelectedJobRole('')
      await refresh()
    } catch (e: unknown) {
      setSubmitError(parseApiError(e, 'Could not add role').message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(row: CampaignJobRoleRow) {
    if (submitting) return
    const ok = window.confirm(`Remove role "${row.job_role_name}" from this campaign?`)
    if (!ok) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await deleteCampaignJobRole(row.id)
      await refresh()
    } catch (e: unknown) {
      setSubmitError(parseApiError(e, 'Could not remove role').message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
        <Spinner label="Loading campaign roles..." />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} />
  }

  return (
    <div className="rounded-panel border border-app-border bg-app-surface p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-app-text">Campaign roles</p>
          <p className="text-xs text-app-secondary">Attach job roles that candidates can select on the public apply form.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {activeRoles.length ? (
          activeRoles.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-2 rounded-panel border border-app-border bg-app-muted px-2.5 py-1 text-xs">
              <Badge variant="info">{r.job_role_code}</Badge>
              <span className="text-app-text">{r.job_role_name}</span>
              <button
                type="button"
                className="rounded-panel p-1 text-app-subtle hover:bg-app-surface"
                onClick={() => handleRemove(r)}
                disabled={submitting}
                aria-label={`Remove ${r.job_role_name}`}
                title="Remove role"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))
        ) : (
          <p className="text-sm text-app-secondary">No roles attached yet.</p>
        )}
      </div>

      {inactiveRoles.length ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-app-subtle">Inactive</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {inactiveRoles.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-2 rounded-panel border border-app-border bg-app-surface px-2.5 py-1 text-xs opacity-70">
                <Badge variant="neutral">{r.job_role_code}</Badge>
                <span className="text-app-secondary">{r.job_role_name}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Select
          id={`add_job_role_${campaignId}`}
          label="Add role"
          value={selectedJobRole}
          onChange={(e) => setSelectedJobRole(e.target.value)}
          disabled={jobRolesLoading || !!jobRolesError || submitting}
        >
          <option value="">Select a job role...</option>
          {jobRoles
            .filter((r) => !activeJobRoleIds.has(r.id))
            .map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name} ({r.code})
              </option>
            ))}
        </Select>
        <Button
          type="button"
          className="min-h-10"
          onClick={handleAdd}
          disabled={!selectedJobRole || !!jobRolesError || submitting}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add
        </Button>
      </div>

      {jobRolesError ? <p className="mt-2 text-xs text-status-warning">Job role lookup failed: {jobRolesError}</p> : null}
      {submitError ? <p className="mt-2 text-xs text-status-danger">{submitError}</p> : null}
    </div>
  )
}


