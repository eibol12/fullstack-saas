import { Link } from 'react-router-dom'
import { AnalysisSummary } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ANALYSIS_DISPLAY_LABELS } from '@/lib/analysisDisplay'

interface AnalysisCardProps {
  analysis: AnalysisSummary
  onDelete?: (id: string) => void
}

export function AnalysisCard({ analysis, onDelete }: AnalysisCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm(`Delete analysis "${analysis.name}"?`)) {
      onDelete?.(analysis.id)
    }
  }

  return (
    <Link to={`/analysis/${analysis.id}`} className="block p-6 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-xs font-medium text-blue-600 mb-1">{analysis.project_name}</p>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{analysis.name}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
            <div><span className="font-medium">{ANALYSIS_DISPLAY_LABELS.dryWeight}:</span> {analysis.maximum_gross_weight} kg</div>
            <div><span className="font-medium">{ANALYSIS_DISPLAY_LABELS.scenario}:</span> {analysis.location}</div>
            <div><span className="font-medium">Lifting Points:</span> {analysis.lifting_points_qty}</div>
          </div>
          <p className="text-xs text-gray-500">Created {formatDistanceToNow(new Date(analysis.created_at))} ago</p>
        </div>
        {onDelete && (
          <button onClick={handleDelete} className="ml-4 p-2 text-gray-400 hover:text-red-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </Link>
  )
}
