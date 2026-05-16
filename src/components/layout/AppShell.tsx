import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Footer } from '@/components/layout/Footer'
import { useAuthStore } from '@/features/auth/authStore'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen flex-col bg-app-bg">
      {/* Full-width chrome: logo + wordmark span the whole viewport, including above the sidebar */}
      <Topbar onMenuClick={() => setMobileOpen(true)} onLogout={handleLogout} />
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="hidden min-h-0 md:flex">
          <Sidebar />
        </div>
        <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}




