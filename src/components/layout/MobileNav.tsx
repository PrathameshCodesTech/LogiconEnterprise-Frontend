import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/authStore'
import { hasAnyCapability } from '@/lib/capabilities'
import { navGroups } from '@/components/layout/navConfig'
import { LogoBand } from '@/components/brand/LogoBand'
import { shellNavIconClassName, shellNavLinkClassName } from '@/components/layout/navLinkStyles'
import { X } from 'lucide-react'

export function MobileNav({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
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

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <button
        type="button"
        className="absolute inset-0 bg-nav-overlay backdrop-blur-[2px]"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside className="app-sidebar absolute left-0 top-0 flex h-full min-h-0 w-[15rem] flex-col border-r border-nav-border bg-nav-bg shadow-nav-drawer">
        <LogoBand
          tone="sidebar"
          compact
          rightSlot={
            <button
              type="button"
              className="inline-flex min-h-9 items-center justify-center rounded-panel px-2 text-nav-wordmark transition-colors hover:bg-nav-icon-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-nav"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          }
        />
        <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 pt-3" aria-label="Main">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-nav-label">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
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
    </div>
  )
}
