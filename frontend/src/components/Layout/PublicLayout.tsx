import { Link, Outlet } from 'react-router-dom'
import { useIsAuthenticated } from '@/features/auth/stores/authStore'

/**
 * PublicLayout Component
 *
 * Shared layout for public pages (Pricing, etc.)
 * Provides navigation bar that adapts based on authentication status
 *
 * Features:
 * - Logo linking to home/dashboard
 * - Navigation links (Pricing)
 * - Conditional auth actions:
 *   - If authenticated: "Dashboard" link
 *   - If not authenticated: "Login" link
 * - Content area via <Outlet /> where child routes render
 *
 * Used by: /pricing and other public marketing pages
 */
export default function PublicLayout() {
  const isAuthenticated = useIsAuthenticated()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side: Logo and nav links */}
            <div className="flex items-center space-x-8">
              <Link
                to={isAuthenticated ? "/dashboard" : "/"}
                className="text-xl font-bold text-slate-900 hover:text-slate-700 transition-colors"
              >
                Rigging SaaS
              </Link>
              <div className="hidden md:flex space-x-1">
                <Link
                  to="/pricing"
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                >
                  Pricing
                </Link>
              </div>
            </div>

            {/* Right side: Auth actions */}
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>
    </div>
  )
}
