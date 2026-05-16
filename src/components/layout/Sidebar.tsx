import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/authStore'
import { hasAnyCapability } from '@/lib/capabilities'
import { navGroups } from '@/components/layout/navConfig'
import { cn } from '@/lib/cn'
import { shellNavIconClassName, shellNavLinkClassName } from '@/components/layout/navLinkStyles'

export function Sidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const caps = useAuthStore((s) => s.me?.capabilities ?? [])

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
              {group.items.map((item) => (
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
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
