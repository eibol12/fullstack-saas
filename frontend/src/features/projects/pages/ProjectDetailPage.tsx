import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useProject, useUpdateProject, useDeleteProject } from '@/features/projects/hooks/useProjects'
import { ProjectForm } from '@/features/projects/components/ProjectForm'
import { AnalysisList } from '@/features/projects/components/AnalysisList'
import { ProjectFormData } from '@/types'
import { formatDistanceToNow } from 'date-fns'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)

  const { data: project, isLoading, error } = useProject(id!)
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const handleUpdate = async (data: ProjectFormData) => {
    await updateProject.mutateAsync({ id: id!, data })
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (window.confirm(`Delete project "${project?.name}"? This action cannot be undone.`)) {
      await deleteProject.mutateAsync(id!)
      navigate('/projects')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load project</p>
          <Link
            to="/projects"
            className="mt-4 inline-block text-blue-600 hover:text-blue-700"
          >
            Back to projects
          </Link>
        </div>
      </div>
    )
  }

  const recentAnalyses = [...project.analyses]
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link to="/projects" className="text-blue-600 hover:text-blue-700">
            ← Back to Projects
          </Link>
        </nav>

        {/* Project Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {isEditing ? (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Project</h2>
              <ProjectForm
                initialData={{
                  name: project.name,
                  description: project.description,
                }}
                onSubmit={handleUpdate}
                onCancel={() => setIsEditing(false)}
                submitLabel="Update Project"
              />
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {project.name}
                  </h1>
                  {project.description && (
                    <p className="text-gray-600 mb-4">{project.description}</p>
                  )}
                  <div className="flex space-x-6 text-sm text-gray-500">
                    <div>
                      <span className="font-medium">Created:</span>{' '}
                      {formatDistanceToNow(new Date(project.created_at))} ago
                    </div>
                    <div>
                      <span className="font-medium">Updated:</span>{' '}
                      {formatDistanceToNow(new Date(project.updated_at))} ago
                    </div>
                    <div>
                      <span className="font-medium">Analyses:</span> {project.analyses_count}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Analyses Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Lifting Analyses ({project.analyses_count})
            </h2>
            <button
              onClick={() => navigate(`/analysis?project_id=${id}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Analyses
            </button>
          </div>

          <AnalysisList analyses={recentAnalyses} />
        </div>
      </div>
    </div>
  )
}
