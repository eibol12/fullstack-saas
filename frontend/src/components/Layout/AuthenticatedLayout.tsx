import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  Building2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { authApi } from '@/api/endpoints/auth'
import { cn } from '@/lib/utils'

/**
 * Top-level navigation items for the authenticated app-shell.
 * Each entry maps to a top-level feature route.
 */
const NAV_ITEMS = [
  { to: '/dashboard',        label: 'Workspace', icon: LayoutDashboard },
  { to: '/billing',          label: 'Billing',   icon: CreditCard },
  { to: '/settings/company', label: 'Company',   icon: Building2 },
] as const

const SIDEBAR_KEY = 'grispen.sidebar.collapsed'

/**
 * AuthenticatedLayout
 *
 * App-shell for every authenticated route. Provides:
 *  - Collapsible left sidebar (engineering CAD-style layout)
 *  - Sticky top bar with user identity + logout
 *  - Drafting-board background tint
 *  - Mobile drawer that slides over the canvas
 *
 * Sticky summary headers from individual pages (e.g. DesignDetailPage)
 * stack BELOW the top bar via `top-14` because the top bar is h-14.
 */
export default function AuthenticatedLayout() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const location = useLocation()

  // Desktop collapsed state — persisted across reloads.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(SIDEBAR_KEY) === '1'
  })
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  // Mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false)
  // Close drawer on route change
  useEffect(() => setMobileOpen(false), [location.pathname])

  const isReportRoute = location.pathname.includes('/report')

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      logout()
      navigate('/login')
    }
  }

  // Reports get a clean canvas without sidebar/topbar visual noise.
  if (isReportRoute) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ============== SIDEBAR (desktop) ============== */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden md:flex flex-col',
          'border-r border-border bg-card/80 backdrop-blur',
          'transition-[width] duration-200 ease-out print:hidden',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />
        <SidebarFooter
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </aside>

      {/* ============== SIDEBAR (mobile drawer) ============== */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
          <aside
            className="absolute inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col shadow-paper"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarBrand collapsed={false} />
            <SidebarNav collapsed={false} />
            <SidebarFooter collapsed={false} onToggle={() => setMobileOpen(false)} mobile />
          </aside>
        </div>
      )}

      {/* ============== MAIN COLUMN ============== */}
      <div
        className={cn(
          'transition-[padding] duration-200 ease-out',
          'md:pl-60',
          collapsed && 'md:pl-16',
        )}
      >
        {/* Sticky top bar */}
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/85 backdrop-blur print:hidden">
          <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-md border border-border hover:bg-muted"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-xs text-muted-foreground">
                {user?.email || user?.username}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-3.5rem)] bg-drafting">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/* -----------------------------------------------------------
 * Sub-components
 * --------------------------------------------------------- */

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      to="/dashboard"
      className="flex items-center gap-2 h-14 px-3 border-b border-border shrink-0"
    >
      <span
        className="grid place-items-center h-8 w-8 rounded-md bg-primary text-primary-foreground font-bold text-xs shadow-inset-soft"
        aria-hidden
      >
        GR
      </span>
      {!collapsed && (
        <span className="font-semibold tracking-tight text-sm text-foreground truncate">
          Grispen Rigging
        </span>
      )}
    </Link>
  )
}

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary dark:text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              collapsed && 'justify-center px-0',
            )
          }
          title={collapsed ? label : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarFooter({
  collapsed,
  onToggle,
  mobile = false,
}: {
  collapsed: boolean
  onToggle: () => void
  mobile?: boolean
}) {
  return (
    <div className="border-t border-border p-2">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium',
          'text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
          collapsed && 'justify-center px-0',
        )}
        aria-label={mobile ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <>
            <ChevronLeft className="h-4 w-4" />
            <span>{mobile ? 'Close' : 'Collapse'}</span>
          </>
        )}
      </button>
    </div>
  )
}
