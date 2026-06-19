import {useState} from 'react'
import {Link, useSearchParams, useNavigate} from 'react-router-dom'
import {useDesigns, useCreateDesign, useDeleteDesign} from '@/features/design/hooks/useDesigns'
import { useAnalysis } from '@/features/analysis/hooks/useAnalyses'
import {DesignCard} from '@/features/design/components/DesignCard'
import {DesignForm} from '@/features/design/components/DesignForm'
import {DesignFormData} from '@/types'
import { useCapabilities, canCreateDesign } from '@/features/billing/hooks/useCapabilities'
import { TierLimitBanner } from '@/features/billing/components/TierLimitBanner'
import { UsageBadge } from '@/features/billing/components/UsageBadge'
import { parseApiError } from '@/lib/errors'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { DataCard } from '@/components/ui/DataCard'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'

export default function DesignListPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const analysisId = searchParams.get('analysisId') || undefined
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [createError, setCreateError] = useState<string>('')

    const { data: analysis } = useAnalysis(analysisId ?? '')
    const projectId = analysis?.project as string | undefined

    const {data: designs, isLoading, error} = useDesigns(projectId, analysisId)
    const { data: capabilities, isLoading: capabilitiesLoading } = useCapabilities()
    const createDesign = useCreateDesign()
    const deleteDesign = useDeleteDesign()

    // Count designs in THIS analysis. When opened from the sidebar without an
    // analysisId, `designs` is the GLOBAL list across all analyses, so the
    // per-analysis tier check (e.g. "3 per analysis" for Starter) does not apply.
    const designCount = designs?.length || 0
    const isAnalysisScoped = !!analysisId

    // Tier-based create permission is only meaningful in an analysis scope; the
    // "+ New Design" button is hidden otherwise, so default to allowed=false
    // when no analysis is selected to avoid bogus red banners.
    const { allowed: canCreate, reason: cannotCreateReason } = isAnalysisScoped
      ? canCreateDesign(capabilities, designCount)
      : { allowed: false, reason: '' }

    const handleCreate = async (formData: DesignFormData) => {
        if (!analysisId) {
            toast.error('Analysis ID is required to create a design.')
            return
        }

        try {
            setCreateError('')
            const {name, set_active, user_preferences} = formData

            await createDesign.mutateAsync({
                name,
                set_active,
                user_preferences,
                analysis_id: analysisId
            })
            setShowCreateForm(false)
            toast.success(`Design "${name}" created.`)
        } catch (err) {
            const msg = parseApiError(err)
            setCreateError(msg)
            toast.error(msg)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteDesign.mutateAsync(id)
            toast.success('Design deleted.')
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
                            Error loading designs
                        </span>
                    }
                >
                    <p className="text-sm text-muted-foreground mb-4">
                        {(error as Error)?.message || 'Unable to fetch designs.'}
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
                            <h1 className="text-3xl font-bold text-gray-900">Rigging Designs</h1>
                            <p className="mt-1 text-sm text-gray-600">
                                {designCount}{' '}
                                {designCount === 1 ? 'design' : 'designs'}{' '}
                                {isAnalysisScoped ? 'in this analysis' : 'across all your analyses'}
                            </p>
                        </div>
                        {capabilities && isAnalysisScoped && (
                            <UsageBadge capabilities={capabilities} type="designs" currentCount={designCount} />
                        )}
                    </div>
                    <div className="flex space-x-3">
                        <Link to={projectId ? `/analysis?project_id=${projectId}` : '/analysis'} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">Back to Analysis</Link>
                        {analysisId && (
                            <button
                                onClick={() => setShowCreateForm(true)}
                                disabled={!canCreate || capabilitiesLoading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!canCreate ? cannotCreateReason : undefined}
                            >
                                + New Design
                            </button>
                        )}
                    </div>
                </div>

                {/* Tier Limit Banner — only meaningful within an analysis scope */}
                {capabilities && isAnalysisScoped && !canCreate && (
                    <div className="mb-6">
                        <TierLimitBanner
                            capabilities={capabilities}
                            limitType="designs"
                            onUpgrade={handleUpgrade}
                        />
                    </div>
                )}

                {/* Create Form Modal */}
                {showCreateForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Design</h2>
                        {createError && (
                            <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
                                <p className="text-sm text-red-800">{createError}</p>
                            </div>
                        )}
                          <DesignForm
                              onSubmit={handleCreate}
                              onCancel={() => {
                                  setShowCreateForm(false)
                                  setCreateError('')
                              }}
                              submitLabel="Create & Calculate"
                              liftingPointsQty={analysis?.lifting_points_qty ?? null}
                          />
                        </div>
                    </div>
                )}

                {/* Designs List */}
                {designs && designs.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                        <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No designs yet</h3>
                        <p className="mt-2 text-sm text-gray-500">Get started by creating your first design.</p>
                        {analysisId && canCreate && (
                            <button onClick={() => setShowCreateForm(true)} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Your First Design</button>
                        )}
                    </div>
                ): (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {designs?.map(design => (
                            <DesignCard key={design.id} design={design} onDelete={handleDelete} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
