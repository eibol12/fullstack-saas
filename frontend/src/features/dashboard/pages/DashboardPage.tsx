import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, FolderPlus, CreditCard, X } from 'lucide-react'

import { useAuthStore } from '@/features/auth/stores/authStore'
import { useProjectsOverview, useCreateProject } from '@/features/projects/hooks/useProjects'
import { ProjectForm } from '@/features/projects/components/ProjectForm'
import { useCapabilities, isProjectLimitReached } from '@/features/billing/hooks/useCapabilities'
import { TierLimitBanner } from '@/features/billing/components/TierLimitBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProjectsOverviewTable } from '@/features/dashboard/components/ProjectsOverviewTable'

/**
 * DashboardPage (centralized projects table)
 *
 * Replaces the legacy KPI/quick-actions dashboard with the management
 * table described in the engineer-UX refactor: every project the user
 * owns, with MGW (dry weight), counts, last-updated, and expandable
 * rows showing analyses → designs → report links.
 *
 * The KPI/quick-action content is kept as a compact strip above the
 * table to preserve the existing entry points (new project, billing)
 * without dedicating a full page to them.
 */
export default function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const { data: projects, isLoading, error } = useProjectsOverview()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const { data: capabilities } = useCapabilities()
  const createProjectMutation = useCreateProject()
  const isLimitReached = isProjectLimitReached(capabilities)

  // KPI roll-up computed on the same payload — avoids a second request
  // just to render the header counts.
  const stats = useMemo(() => {
    if (!projects) return { projects: 0, analyses: 0, designs: 0 }
    return {
      projects: projects.length,
      analyses: projects.reduce((acc, p) => acc + p.analyses_count, 0),
      designs: projects.reduce((acc, p) => acc + p.designs_count, 0),
    }
  }, [projects])

  const handleCreateProject = async (data: { name: string; description?: string }) => {
    try {
      setCreateError(null)
      const newProject = await createProjectMutation.mutateAsync(data)
      setShowCreateForm(false)
      navigate(`/projects/${newProject.id}/workspace`)
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create project. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        {/* -------- Header strip -------- */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome back{user?.username ? `, ${user.username}` : ''}
            </h1>
            <p className="text-sm text-slate-600">
              Manage every project, analysis, and rigging design from a single table.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              <FolderPlus className="h-4 w-4" />
              New project
            </button>
            <Link
              to="/billing"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <CreditCard className="h-4 w-4" />
              Billing
            </Link>
          </div>
        </div>

        {/* -------- Compact KPI strip -------- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile label="Projects" value={stats.projects} loading={isLoading} />
          <KpiTile label="Analyses" value={stats.analyses} loading={isLoading} />
          <KpiTile label="Designs" value={stats.designs} loading={isLoading} />
        </div>

        {/* -------- Main table -------- */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Failed to load projects</p>
              <p className="text-xs text-red-600">{(error as Error).message}</p>
            </div>
          </div>
        ) : (
          <ProjectsOverviewTable
            projects={projects ?? []}
            onCreateProjectClick={() => setShowCreateForm(true)}
          />
        )}
      </div>

      {/* -------- Create Project Modal -------- */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 font-display">Create New Project</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setCreateError(null)
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {capabilities && (
              <TierLimitBanner
                capabilities={capabilities}
                limitType="projects"
                onUpgrade={() => {
                  setShowCreateForm(false)
                  navigate('/billing')
                }}
              />
            )}

            {isLimitReached ? (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md font-medium hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {createError && (
                  <div className="rounded-md bg-red-50 p-3 border border-red-200 text-sm text-red-700">
                    {createError}
                  </div>
                )}
                <ProjectForm
                  onSubmit={handleCreateProject}
                  onCancel={() => setShowCreateForm(false)}
                  submitLabel="Create Project"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiTile({
  label,
  value,
  loading,
}: {
  label: string
  value: number
  loading: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">
        {loading ? <span className="animate-pulse text-slate-300">…</span> : value}
      </p>
    </div>
  )
}
