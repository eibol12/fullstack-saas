import { Link } from 'react-router-dom'
import { AnalysisSummary } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ANALYSIS_DISPLAY_LABELS } from '@/lib/analysisDisplay'

interface AnalysisListProps {
  analyses: AnalysisSummary[]
}

export function AnalysisList({ analyses }: AnalysisListProps) {
  if (analyses.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
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
        <h3 className="mt-2 text-sm font-medium text-gray-900">No analyses yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new lifting analysis.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {analyses.map((analysis) => (
        <Link
          key={analysis.id}
          to={`/analysis/${analysis.id}`}
          className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                {analysis.name}
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                <div>
                  <span className="font-medium">{ANALYSIS_DISPLAY_LABELS.dryWeight}:</span> {analysis.maximum_gross_weight} kg
                </div>
                <div>
                  <span className="font-medium">{ANALYSIS_DISPLAY_LABELS.scenario}:</span> {analysis.location}
                </div>
                <div>
                  <span className="font-medium">Lifting Points:</span> {analysis.lifting_points_qty}
                </div>
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {formatDistanceToNow(new Date(analysis.created_at))} ago
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
