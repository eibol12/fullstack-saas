import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects, useCreateProject, useDeleteProject } from '@/features/projects/hooks/useProjects'
import { ProjectCard } from '@/features/projects/components/ProjectCard'
import { ProjectForm } from '@/features/projects/components/ProjectForm'
import { ProjectFormData } from '@/types'
import { useCapabilities, canCreateProject, isProjectLimitReached } from '@/features/billing/hooks/useCapabilities'
import { TierLimitBanner } from '@/features/billing/components/TierLimitBanner'
import { UsageBadge } from '@/features/billing/components/UsageBadge'
import { parseApiError } from '@/lib/errors'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { DataCard } from '@/components/ui/DataCard'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'

export default function ProjectListPage() {
  const navigate = useNavigate()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createError, setCreateError] = useState<string>('')
  const { data: projects, isLoading, error } = useProjects()
  const { data: capabilities, isLoading: capabilitiesLoading } = useCapabilities()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()

  const { allowed: canCreate, reason: cannotCreateReason } = canCreateProject(capabilities)
  const limitReached = isProjectLimitReached(capabilities)

  const handleCreate = async (data: ProjectFormData) => {
    try {
      setCreateError('')
      await createProject.mutateAsync(data)
      setShowCreateForm(false)
      toast.success(`Project "${data.name}" created.`)
    } catch (err) {
      const msg = parseApiError(err)
      setCreateError(msg)
      toast.error(msg)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProject.mutateAsync(id)
      toast.success('Project deleted.')
    } catch (err) {
      toast.error(parseApiError(err))
    }
  }

  const handleUpgrade = () => {
    navigate('/pricing')
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DataCard
          title={
            <span className="inline-flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Failed to load projects
            </span>
          }
        >
          <p className="text-sm text-muted-foreground mb-4">
            {(error as Error)?.message || 'Unable to fetch projects.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </DataCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage your lifting analysis projects
              </p>
            </div>
            {capabilities && (
              <UsageBadge capabilities={capabilities} type="projects" />
            )}
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            disabled={!canCreate || capabilitiesLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canCreate ? cannotCreateReason : undefined}
          >
            + New Project
          </button>
        </div>

        {/* Tier Limit Banner */}
        {capabilities && limitReached && (
          <div className="mb-6">
            <TierLimitBanner
              capabilities={capabilities}
              limitType="projects"
              onUpgrade={handleUpgrade}
            />
          </div>
        )}

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Project</h2>
              {createError && (
                <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
                  <p className="text-sm text-red-800">{createError}</p>
                </div>
              )}
              <ProjectForm
                onSubmit={handleCreate}
                onCancel={() => {
                  setShowCreateForm(false)
                  setCreateError('')
                }}
                submitLabel="Create Project"
              />
            </div>
          </div>
        )}

        {/* Projects List */}
        {projects && projects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No projects yet</h3>
            <p className="mt-2 text-sm text-gray-500">
              Get started by creating your first project.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
