import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/authStore'
import { hasAnyCapability } from '@/lib/capabilities'
import { navGroups } from '@/components/layout/navConfig'
import { cn } from '@/lib/cn'
import { shellNavIconClassName, shellNavLinkClassName } from '@/components/layout/navLinkStyles'
import { useNotificationStore } from '@/features/notifications/useNotifications'
import type { UnreadByArea } from '@/features/notifications/types'

/** Maps nav paths to notification area keys */
function getUnreadCountForPath(path: string, unreadByArea: UnreadByArea): number {
  switch (path) {
    case '/my-tasks':
      return unreadByArea.workflow
    case '/sales/operations-surveys':
      return unreadByArea.operationsSurveys
    case '/sales/dashboard':
    case '/sales/leads':
      return unreadByArea.sales
    case '/mobilisation':
      return unreadByArea.mobilisation
    case '/mrf':
      return unreadByArea.mrf
    default:
      return 0
  }
}

function NavBadge({ count }: { count: number }) {
  if (count === 0) return null
  const display = count > 9 ? '9+' : count
  return (
    <span className="relative ml-auto flex items-center">
      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
        {display}
      </span>
      <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-50" />
    </span>
  )
}

export function Sidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const caps = useAuthStore((s) => s.me?.capabilities ?? [])
  const unreadByArea = useNotificationStore((s) => s.unreadByArea)

  const visibleGroups = navGroups
    .map((group) => ({
      label: group.label,
      items: group.items.filter((item) => {
        if (!item.requiredCapabilities?.length) {
          return true
        }
        return hasAnyCapability(caps, item.requiredCapabilities)
      }),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <aside
      className={cn(
        'app-sidebar flex h-full min-h-0 w-[15rem] shrink-0 flex-col border-r border-nav-border bg-nav-bg shadow-nav-inset',
        className,
      )}
    >
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 pt-4" aria-label="Main">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-nav-label">{group.label}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const unreadCount = getUnreadCountForPath(item.path, unreadByArea)
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onNavigate}
                    className={({ isActive }) => shellNavLinkClassName(isActive)}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={shellNavIconClassName(isActive)} aria-hidden />
                        <span className="truncate">{item.label}</span>
                        <NavBadge count={unreadCount} />
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
