import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAnalyses, useCreateAnalysis, useDeleteAnalysis } from '@/features/analysis/hooks/useAnalyses'
import { AnalysisCard } from '@/features/analysis/components/AnalysisCard'
import { AnalysisForm } from '@/features/analysis/components/AnalysisForm'
import { AnalysisFormData } from '@/types'
import { buildAnalysisCreatePayload } from '@/features/analysis/utils/buildAnalysisCreatePayload'
import { useCapabilities, canCreateAnalysis } from '@/features/billing/hooks/useCapabilities'
import { TierLimitBanner } from '@/features/billing/components/TierLimitBanner'
import { UsageBadge } from '@/features/billing/components/UsageBadge'
import { parseApiError } from '@/lib/errors'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { DataCard } from '@/components/ui/DataCard'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'

export default function AnalysisListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project_id')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createError, setCreateError] = useState<string>('')

  const { data: analyses, isLoading, error } = useAnalyses(projectId || undefined)
  const { data: capabilities, isLoading: capabilitiesLoading } = useCapabilities()
  const createAnalysis = useCreateAnalysis()
  const deleteAnalysis = useDeleteAnalysis()

  // Count analyses in THIS project. When opened from the sidebar without a
  // project_id, `analyses` is the GLOBAL list across all projects, so per-project
  // tier checks (e.g. "3 per project" for Starter) do not apply here.
  const analysisCount = analyses?.length || 0
  const isProjectScoped = !!projectId

  // Tier-based create permission is only meaningful in a project scope; outside
  // of one we cannot create analyses anyway (the "+ New Analysis" button is
  // hidden), so default to allowed=false / no reason when no project is selected.
  const { allowed: canCreate, reason: cannotCreateReason } = isProjectScoped
    ? canCreateAnalysis(capabilities, analysisCount)
    : { allowed: false, reason: '' }

  const handleCreate = async (formData: AnalysisFormData) => {
    if (!projectId) {
      toast.error('Project ID is required to create an analysis')
      return
    }

    try {
      setCreateError('')
      await createAnalysis.mutateAsync(buildAnalysisCreatePayload(formData, projectId))
      setShowCreateForm(false)
      toast.success(`Analysis "${formData.name}" created.`)
    } catch (err) {
      const msg = parseApiError(err)
      setCreateError(msg)
      toast.error(msg)
    }
  }

  const handleDelete = async (id: string) => {
    if (!projectId) return
    try {
      await deleteAnalysis.mutateAsync({ id, projectId })
      toast.success('Analysis deleted.')
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
              Failed to load analyses
            </span>
          }
        >
          <p className="text-sm text-muted-foreground mb-4">
            {(error as Error)?.message || 'Unable to fetch analyses.'}
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

  // @ts-ignore
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Lifting Analyses</h1>
              <p className="mt-1 text-sm text-gray-600">
                {analysisCount}{' '}
                {analysisCount === 1 ? 'analysis' : 'analyses'}{' '}
                {isProjectScoped ? 'in this project' : 'across all your projects'}
              </p>
            </div>
            {capabilities && isProjectScoped && (
              <UsageBadge capabilities={capabilities} type="analyses" currentCount={analysisCount} />
            )}
          </div>
          <div className="flex space-x-3">
            <Link to="/projects" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">Back to Projects</Link>
            {projectId && (
              <button
                onClick={() => setShowCreateForm(true)}
                disabled={!canCreate || capabilitiesLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!canCreate ? cannotCreateReason : undefined}
              >
                + New Analysis
              </button>
            )}
          </div>
        </div>

        {/* Tier Limit Banner — only meaningful within a project scope */}
        {capabilities && isProjectScoped && !canCreate && (
          <div className="mb-6">
            <TierLimitBanner
              capabilities={capabilities}
              limitType="analyses"
              onUpgrade={handleUpgrade}
            />
          </div>
        )}

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Analysis</h2>
              {createError && (
                <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
                  <p className="text-sm text-red-800">{createError}</p>
                </div>
              )}
              <AnalysisForm
                onSubmit={handleCreate}
                onCancel={() => {
                  setShowCreateForm(false)
                  setCreateError('')
                }}
                submitLabel="Create & Calculate"
              />
            </div>
          </div>
        )}

        {/* Analyses List */}
        {analyses && analyses.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No analyses yet</h3>
            <p className="mt-2 text-sm text-gray-500">Get started by creating your first lifting analysis.</p>
            {projectId && canCreate && (
              <button onClick={() => setShowCreateForm(true)} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Your First Analysis</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analyses?.map((analysis) => (
              <AnalysisCard key={analysis.id} analysis={analysis} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
