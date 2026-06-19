import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAnalysis, useDeleteAnalysis } from '@/features/analysis/hooks/useAnalyses'
import { AnalysisResultsDisplay } from '@/features/analysis/components/AnalysisResultsDisplay'

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: analysis, isLoading, error } = useAnalysis(id!)
  const deleteAnalysis = useDeleteAnalysis()

  const handleDelete = async () => {
    if (!id || !analysis) return

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the analysis "${analysis.name}"? This action cannot be undone.`
    )

    if (!confirmDelete) return

    try {
      await deleteAnalysis.mutateAsync({ id, projectId: analysis.project })
      navigate(`/analysis?project_id=${analysis.project}`)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete analysis')
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading analysis...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !analysis) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-red-900">Error Loading Analysis</h2>
          </div>
          <p className="text-red-700 mb-4">
            {error instanceof Error ? error.message : 'Analysis not found'}
          </p>
          <Link
            to="/analysis"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            Back to Analysis List
          </Link>
        </div>
      </div>
    )
  }

  // Main content
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with breadcrumb and actions */}
      <div className="mb-6">
        {/* Breadcrumb */}
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
                Dashboard
              </Link>
            </li>
            <li>
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </li>
            <li>
              <Link to={`/analysis?project_id=${analysis.project}`} className="text-gray-500 hover:text-gray-700">
                Analyses
              </Link>
            </li>
            <li>
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </li>
            <li>
              <span className="text-gray-900 font-medium">{analysis.name}</span>
            </li>
          </ol>
        </nav>

        {/* Page title and actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{analysis.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Created on {new Date(analysis.created_at).toLocaleDateString()} at{' '}
              {new Date(analysis.created_at).toLocaleTimeString()}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-3">
            <Link
              to={`/design?analysisId=${encodeURIComponent(analysis.id)}`}
              className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2h5a2 2 0 012 2v12a2 2 0 01-2 2z" />
              </svg>
              View Designs
            </Link>

            <Link
              to={`/projects/${analysis.project}`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              View Project
            </Link>

            <button
              onClick={handleDelete}
              disabled={deleteAnalysis.isPending}
              className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {deleteAnalysis.isPending ? 'Deleting...' : 'Delete Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Results Display */}
      <AnalysisResultsDisplay analysis={analysis} />
    </div>
  )
}
