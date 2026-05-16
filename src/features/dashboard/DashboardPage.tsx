import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { navItems } from '@/components/layout/navConfig'
import { useAuthStore } from '@/features/auth/authStore'
import { dashboardWidgetGridClass, selectVisibleDashboardWidgets } from '@/features/dashboard/dashboardWidgets'
import { DASHBOARD_SECTION_LABELS, DASHBOARD_SECTION_ORDER, type DashboardSectionId } from '@/features/dashboard/types'
import { displayName } from '@/features/users/types'
import { hasAnyCapability } from '@/lib/capabilities'
import { cn } from '@/lib/cn'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'

export function DashboardPage() {
  const me = useAuthStore((s) => s.me)
  const meLoading = useAuthStore((s) => s.meLoading)
  const meError = useAuthStore((s) => s.meError)

  const visibleWidgets = useMemo(() => selectVisibleDashboardWidgets(me), [me])

  const widgetsBySection = useMemo(() => {
    const m = new Map<DashboardSectionId, ReturnType<typeof selectVisibleDashboardWidgets>>()
    for (const id of DASHBOARD_SECTION_ORDER) {
      m.set(id, [])
    }
    for (const w of visibleWidgets) {
      m.get(w.section)!.push(w)
    }
    return m
  }, [visibleWidgets])

  const quickLinks = useMemo(() => {
    const caps = me?.capabilities ?? []
    return navItems.filter((item) => {
      if (item.path === '/dashboard' || item.path === '/me' || item.path === '/my-tasks') return false
      if (!item.requiredCapabilities?.length) return true
      return hasAnyCapability(caps, item.requiredCapabilities)
    })
  }, [me?.capabilities])

  if (meLoading && !me) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading dashboard" />
      </div>
    )
  }

  if (meError && !me) {
    return <ErrorState message={meError} />
  }

  if (!me) {
    return <ErrorState message="Sign in to view the dashboard." />
  }

  return (
    <div className="w-full space-y-6">
      <header className="border-b border-app-border pb-4">
        <h1 className="text-lg font-semibold text-app-text">Dashboard</h1>
        <p className="mt-1 text-sm text-app-secondary">Work and operational signals for your access.</p>
        <p className="mt-2 text-xs text-app-subtle">
          <span className="text-app-text">{displayName(me)}</span>
          {me.email ? <span className="text-app-secondary"> · {me.email}</span> : null}
        </p>
      </header>

      {visibleWidgets.length === 0 ? (
        <p className="text-sm text-app-secondary">
          No dashboard widgets match your current role. Use Available areas below or My access to open modules.
        </p>
      ) : null}

      {DASHBOARD_SECTION_ORDER.map((sectionId) => {
        const widgets = widgetsBySection.get(sectionId) ?? []
        if (!widgets.length) return null
        return (
          <section key={sectionId} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-app-subtle">
              {DASHBOARD_SECTION_LABELS[sectionId]}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {widgets.map((w) => {
                const Comp = w.component
                return (
                  <div key={w.id} className={cn(dashboardWidgetGridClass(w.size))}>
                    <Comp />
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <section className="border-t border-app-border pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-app-subtle">Available areas</h2>
        <p className="mt-1 text-xs text-app-secondary">Shortcuts to modules your account can open.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {quickLinks.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className="inline-flex min-h-9 items-center rounded-panel border border-app-border bg-app-muted px-3 py-1.5 text-xs font-medium text-app-text hover:border-brand-600 hover:text-brand-700"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        {quickLinks.length === 0 ? (
          <p className="mt-3 text-xs text-app-secondary">
            No additional module shortcuts. Use{' '}
            <Link to="/me" className="font-medium text-brand-600 hover:underline">
              My access
            </Link>{' '}
            to review roles.
          </p>
        ) : null}
      </section>
    </div>
  )
}
