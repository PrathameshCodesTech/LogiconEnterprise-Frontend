import { useCallback, useEffect, useState } from 'react'
import { getDashboardSummary } from '@/api/dashboard'
import type { DashboardSummaryResponse } from '@/features/dashboard/types'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { MyWorkWidget } from '@/features/dashboard/widgets/MyWorkWidget'
import { ClientOverviewWidget } from '@/features/dashboard/widgets/ClientOverviewWidget'
import { MRFSummaryWidget } from '@/features/dashboard/widgets/MRFSummaryWidget'
import { OnboardingSummaryWidget } from '@/features/dashboard/widgets/OnboardingSummaryWidget'
import { BudgetSummaryWidget } from '@/features/dashboard/widgets/BudgetSummaryWidget'
import { HiringSummaryWidget } from '@/features/dashboard/widgets/HiringSummaryWidget'
import { TalentSummaryWidget } from '@/features/dashboard/widgets/TalentSummaryWidget'
import { RecentActivityWidget } from '@/features/dashboard/widgets/RecentActivityWidget'
import { hasAnyCount } from '@/features/dashboard/dashboardChartUtils'

// ─── grid helpers ─────────────────────────────────────────────────────────────

const SPAN_SINGLE = 'col-span-1'
const SPAN_DOUBLE = 'col-span-1 md:col-span-2'
const SPAN_FULL = 'col-span-1 md:col-span-2 lg:col-span-4'

function hasHiringData(hiring: DashboardSummaryResponse['sections']['hiring']): boolean {
  return (
    hiring.application_count > 0 ||
    hiring.demand_count > 0 ||
    hasAnyCount(hiring.charts?.by_status) ||
    hasAnyCount(hiring.charts?.by_stage) ||
    hasAnyCount(hiring.charts?.by_job_role)
  )
}

function hasTalentData(talent: DashboardSummaryResponse['sections']['talent']): boolean {
  return (
    talent.candidate_count > 0 ||
    talent.resume_count > 0 ||
    hasAnyCount(talent.charts?.by_resume_status) ||
    hasAnyCount(talent.charts?.by_availability) ||
    hasAnyCount(talent.charts?.top_skills)
  )
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(() => {
    setLoading(true)
    setError(null)
    getDashboardSummary()
      .then((res) => {
        setData(res)
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.detail ??
          err?.message ??
          'Failed to load dashboard. Please try again.'
        setError(String(msg))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading dashboard" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="w-full space-y-4">
        <ErrorState message={error} />
        <button
          type="button"
          onClick={fetchSummary}
          className="inline-flex min-h-9 items-center rounded-panel border border-app-border bg-app-muted px-3 py-1.5 text-xs font-medium text-app-text hover:border-brand-600 hover:text-brand-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const { audience, user, sections } = data
  const isClient = audience === 'client'

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-app-border pb-4">
        <div>
          <h1 className="text-lg font-semibold text-app-text">Dashboard</h1>
          <p className="mt-1 text-sm text-app-secondary">Work and operational signals for your access.</p>
          <p className="mt-1 text-xs text-app-subtle">
            <span className="text-app-text">{user.username}</span>
            {user.email ? <span className="text-app-secondary"> · {user.email}</span> : null}
            <span className="text-app-subtle"> · {user.user_type}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSummary}
          disabled={loading}
          className="inline-flex min-h-9 items-center rounded-panel border border-app-border bg-app-muted px-3 py-1.5 text-xs font-medium text-app-text hover:border-brand-600 hover:text-brand-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {isClient ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {/* Row 1: My work + Client overview */}
          <div className={SPAN_SINGLE}>
            <MyWorkWidget data={sections.my_work} />
          </div>
          <div className={SPAN_DOUBLE}>
            <ClientOverviewWidget data={sections.client_overview} compactForClientAudience />
          </div>

          {/* Row 2: MRF + Budget charts */}
          <div className={SPAN_DOUBLE}>
            <MRFSummaryWidget data={sections.mrf} />
          </div>
          <div className={SPAN_DOUBLE}>
            <BudgetSummaryWidget data={sections.budget} />
          </div>

          {/* Row 3: Recent activity */}
          <div className={SPAN_FULL}>
            <RecentActivityWidget items={sections.recent_activity} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className={SPAN_SINGLE}>
            <MyWorkWidget data={sections.my_work} />
          </div>

          <div className={SPAN_DOUBLE}>
            <OnboardingSummaryWidget data={sections.onboarding} />
          </div>

          <div className={SPAN_DOUBLE}>
            <MRFSummaryWidget data={sections.mrf} />
          </div>

          <div className={SPAN_DOUBLE}>
            <BudgetSummaryWidget data={sections.budget} />
          </div>

          {hasHiringData(sections.hiring) ? (
            <div className={SPAN_DOUBLE}>
              <HiringSummaryWidget data={sections.hiring} />
            </div>
          ) : null}

          {hasTalentData(sections.talent) ? (
            <div className={SPAN_DOUBLE}>
              <TalentSummaryWidget data={sections.talent} />
            </div>
          ) : null}

          <div className={SPAN_FULL}>
            <RecentActivityWidget items={sections.recent_activity} />
          </div>
        </div>
      )}
    </div>
  )
}
