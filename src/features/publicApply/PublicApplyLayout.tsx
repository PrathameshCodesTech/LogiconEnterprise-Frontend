import { useEffect, type ReactNode } from 'react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { t } from '@/features/publicApply/i18n'
import type { LangCode } from '@/features/publicApply/types'

/**
 * Public apply must be light-only while mounted, then restore previous theme on unmount.
 */
export function PublicApplyLayout({
  lang,
  showThemeToggle = false,
  headerRight,
  children,
}: {
  lang: LangCode
  showThemeToggle?: boolean
  headerRight?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => {
      if (wasDark) root.classList.add('dark')
    }
  }, [])

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <header className="border-b border-app-border bg-app-surface">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/LOGO-2-1.webp" alt="LOGICON" className="h-10 w-10 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-app-text">{t(lang, 'appTitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {headerRight}
            {showThemeToggle ? <ThemeToggle /> : null}
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}


