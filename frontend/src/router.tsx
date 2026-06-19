import { createBrowserRouter, Navigate, useParams, useSearchParams } from 'react-router-dom'
import ProtectedRoute from '@/components/Layout/ProtectedRoute'
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout'
import PublicLayout from '@/components/Layout/PublicLayout'
import { lazy, Suspense } from 'react'
import { useAnalysis } from '@/features/analysis/hooks/useAnalyses'
import { useDesign } from '@/features/design/hooks/useDesigns'

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const VerifyEmailPage = lazy(() => import('@/features/auth/pages/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const AnalysisDetailPage = lazy(() => import('@/features/analysis/pages/AnalysisDetailPage'))
const DesignDetailPage = lazy(() => import("@/features/design/pages/DesignDetailPage"))
const DesignReportPage = lazy(() => import("@/features/design/pages/DesignReportPage"))
const ProjectWorkspacePage = lazy(() => import("@/features/workspace/pages/ProjectWorkspacePage"))
const ChangePasswordPage = lazy(() => import('@/features/auth/pages/ChangePasswordPage'))
const CompanySettingsPage = lazy(() => import('@/features/settings/pages/CompanySettingsPage'))
const RegistrationSuccessPage = lazy(() => import('@/features/auth/pages/RegistrationSuccessPage'))
const BillingPage = lazy(() => import('@/features/billing/pages/BillingPage'))
const PricingPage = lazy(() => import('@/features/pricing/pages/PricingPage'))
const DocsPage = lazy(() => import('@/features/docs/pages/DocsPage'))

function PageLoader() {
  return <div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>
}

/**
 * Legacy `/analysis/:id` → `/projects/:projectId/workspace?tab=analysis&analysis=:id`
 *
 * Looks up the analysis to discover its parent project, then forwards to
 * the unified workspace page. Old bookmarks and report links keep working.
 */
function AnalysisRedirect() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useAnalysis(id ?? '')
  if (isLoading) return <PageLoader />
  if (error || !data) return <Navigate to="/dashboard" replace />
  return (
    <Navigate
      to={`/projects/${data.project}/workspace?tab=analysis&analysis=${data.id}`}
      replace
    />
  )
}

/**
 * Legacy `/design/:id` → `/projects/:projectId/workspace?tab=design&analysis=:analysisId&design=:id`
 */
function DesignRedirect() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useDesign(id ?? '')
  if (isLoading) return <PageLoader />
  if (error || !data || !data.project?.id) return <Navigate to="/dashboard" replace />
  const search = new URLSearchParams({ tab: 'design', design: data.id })
  if (data.analysis?.id) search.set('analysis', data.analysis.id)
  return (
    <Navigate
      to={`/projects/${data.project.id}/workspace?${search.toString()}`}
      replace
    />
  )
}

/**
 * Legacy create-analysis entry point. Honours the `?project_id=` query
 * that the old `AnalysisListPage` used to receive from the dashboard and
 * forwards to the workspace.
 */
function AnalysisCreateRedirect() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project_id')
  if (!projectId) return <Navigate to="/dashboard" replace />
  return <Navigate to={`/projects/${projectId}/workspace?tab=analysis`} replace />
}

/**
 * Redirects `/projects/:id` to `/projects/:id/workspace`
 */
function ProjectDetailRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/projects/${id}/workspace`} replace />
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense> },
  { path: '/register', element: <Suspense fallback={<PageLoader />}><RegisterPage /></Suspense> },
  { path: '/verify-email', element: <Suspense fallback={<PageLoader />}><VerifyEmailPage /></Suspense> },
  { path: '/register/success', element: <Suspense fallback={<PageLoader />}><RegistrationSuccessPage /></Suspense> },
  { path: '/forgot-password', element: <Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense> },
  { path: '/reset-password', element: <Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense> },
  {
    element: <PublicLayout />,
    children: [
      { path: '/pricing', element: <Suspense fallback={<PageLoader />}><PricingPage /></Suspense> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AuthenticatedLayout />,
        children: [
          { path: '/dashboard', element: <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense> },
          { path: '/projects', element: <Navigate to="/dashboard" replace /> },
          { path: '/projects/:id', element: <ProjectDetailRedirect /> },
          { path: '/projects/:id/workspace', element: <Suspense fallback={<PageLoader />}><ProjectWorkspacePage /></Suspense> },
          // Legacy list pages remain reachable for deep links, but the
          // primary creation/edit flow is now the unified workspace page.
          { path: '/analysis', element: <Navigate to="/dashboard" replace /> },
          // Legacy detail/create routes redirect into the workspace so
          // existing bookmarks (and report links) keep working.
          { path: '/analysis/new', element: <AnalysisCreateRedirect /> },
          { path: '/analysis/:id', element: <AnalysisRedirect /> },
          { path: '/analysis/:id/legacy', element: <Suspense fallback={<PageLoader />}><AnalysisDetailPage /></Suspense> },
          { path: '/design', element: <Navigate to="/dashboard" replace /> },
          { path: '/design/:id', element: <DesignRedirect /> },
          { path: '/design/:id/legacy', element: <Suspense fallback={<PageLoader />}><DesignDetailPage /></Suspense> },
          { path: '/design/:id/report', element: <Suspense fallback={<PageLoader />}><DesignReportPage /></Suspense> },
          { path: '/billing', element: <Suspense fallback={<PageLoader />}><BillingPage /></Suspense> },
          { path: '/docs', element: <Suspense fallback={<PageLoader />}><DocsPage /></Suspense> },
          { path: '/settings/company', element: <Suspense fallback={<PageLoader />}><CompanySettingsPage /></Suspense> },
          { path: '/settings/password', element: <Suspense fallback={<PageLoader />}><ChangePasswordPage /></Suspense> },
        ],
      },
    ],
  },
  { path: '*', element: <div className="flex items-center justify-center min-h-screen"><div className="text-center"><h1 className="text-4xl font-bold mb-4">404</h1><p className="text-gray-600">Page not found</p></div></div> },
])
