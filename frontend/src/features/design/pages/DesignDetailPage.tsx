import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Lock,
  Trash2,
  AlertTriangle,
} from 'lucide-react'

import { CombinationKey, RiggingDesign } from '@/types'
import { DesignResultsDisplay } from '@/features/design/components/DesignResultsDisplay'
import { useCapabilities, canExportPDF } from '@/features/billing/hooks/useCapabilities'
import { useDesign, useDeleteDesign } from '@/features/design/hooks/useDesigns'
import { useAnalysis } from '@/features/analysis/hooks/useAnalyses'

import { PageHeader } from '@/components/ui/PageHeader'
import { DataCard } from '@/components/ui/DataCard'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { GeometryVisualizer } from '@/components/visualizer/GeometryVisualizer'

const REPORT_COMBINATION_ORDER: CombinationKey[] = ['user_specified', 'conservative', 'minimum']

function reportCombinationTitle(key: CombinationKey): string {
  const titles: Record<CombinationKey, string> = {
    user_specified: 'User-Specified Recommendation',
    conservative: 'Conservative Recommendation',
    minimum: 'Minimum Recommendation',
  }
  return titles[key]
}

function getAvailableReportCombinations(
  design: RiggingDesign | null | undefined,
): Array<{ key: CombinationKey; title: string }> {
  const combinations = design?.results?.optimal_combinations
  if (!combinations) return []
  return REPORT_COMBINATION_ORDER
    .filter((key) => Boolean(combinations[key]))
    .map((key) => ({ key, title: reportCombinationTitle(key) }))
}

/** Map a design status to a StatusPill tone (matches DesignCard mapping). */
function statusTone(status?: string | null): StatusTone {
  switch ((status || '').toLowerCase()) {
    case 'approved':
    case 'active':
    case 'final':
      return 'ok'
    case 'draft':
    case 'review':
    case 'pending':
      return 'warn'
    case 'failed':
    case 'rejected':
      return 'fail'
    case 'archived':
      return 'muted'
    default:
      return 'info'
  }
}

export default function DesignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: design, isLoading: loading, error: queryError } = useDesign(id!)
  const deleteDesign = useDeleteDesign()
  const [selectedReportKey, setSelectedReportKey] = useState<CombinationKey | ''>('')
  const { data: capabilities, isLoading: capabilitiesLoading } = useCapabilities()
  const { allowed: canReport, reason: cannotReportReason } = canExportPDF(capabilities)

  // Pull the linked analysis lazily so the read-only geometry visualizer has
  // the original L/h configuration (the design payload only carries
  // { id, name } for its parent analysis).
  const analysisId = design?.analysis?.id
  const { data: analysis } = useAnalysis(analysisId ?? '')

  const availableReportCombinations = useMemo(
    () => getAvailableReportCombinations(design),
    [design],
  )

  useEffect(() => {
    if (!selectedReportKey) return
    const stillAvailable = availableReportCombinations.some(
      (combination) => combination.key === selectedReportKey,
    )
    if (!stillAvailable) setSelectedReportKey('')
  }, [availableReportCombinations, selectedReportKey])

  const reportPreviewHref = id
    ? selectedReportKey
      ? `/design/${id}/report?selected_key=${selectedReportKey}`
      : `/design/${id}/report`
    : '/design'

  const handleDelete = async () => {
    if (!id || !design) return
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the design "${design.name}"? This action cannot be undone.`,
    )
    if (!confirmDelete) return

    try {
      await deleteDesign.mutateAsync(id)
      const destination = design.analysis?.id
        ? `/design?analysisId=${design.analysis.id}`
        : '/design'
      navigate(destination)
    } catch (err: any) {
      console.error('Failed to delete design:', err)
      alert(err.response?.data?.detail || 'Failed to delete design')
    }
  }

  // ---------- Loading state (skeletons replace the spinner) ----------
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-7 w-64 mb-3" />
        <Skeleton className="h-4 w-40 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <SkeletonText lines={4} />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  // ---------- Error state ----------
  if (queryError || !design) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DataCard
          title={
            <span className="inline-flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Error loading design
            </span>
          }
        >
          <p className="text-sm text-muted-foreground mb-4">
            {queryError?.message || 'Design not found'}
          </p>
          <Link
            to="/design"
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2
                       text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Design List
          </Link>
        </DataCard>
      </div>
    )
  }

  // ---------- Page actions (right side of sticky header) ----------
  const headerActions = (
    <>
      {availableReportCombinations.length > 0 && (
        <label className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap uppercase tracking-wide">Combination</span>
          <select
            value={selectedReportKey}
            onChange={(event) =>
              setSelectedReportKey(event.target.value as CombinationKey | '')
            }
            className="min-w-[14rem] rounded-md border border-input bg-card px-3 py-1.5
                       text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Select report combination"
          >
            <option value="">Auto Select</option>
            {availableReportCombinations.map((combination) => (
              <option key={combination.key} value={combination.key}>
                {combination.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {!capabilitiesLoading && canReport && (
        <Link
          to={reportPreviewHref}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-card
                     px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          <FileText className="h-4 w-4" />
          Report Preview
        </Link>
      )}
      {!capabilitiesLoading && !canReport && (
        <span
          title={cannotReportReason ?? 'Upgrade to Starter or higher'}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-muted/40
                     px-3 py-1.5 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-70"
        >
          <Lock className="h-4 w-4" />
          Report Preview
        </span>
      )}

      <button
        onClick={handleDelete}
        disabled={deleteDesign.isPending}
        className="inline-flex items-center gap-2 rounded-md border border-destructive/40
                   bg-card px-3 py-1.5 text-sm font-medium text-destructive
                   hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-destructive/40"
      >
        <Trash2 className="h-4 w-4" />
        {deleteDesign.isPending ? 'Deleting…' : 'Delete'}
      </button>
    </>
  )

  const cfg = analysis?.configuration

  return (
    <div>
      {/* Sticky page header — stays just below the top bar (h-14) so the
          engineer keeps design context while scrolling the appendix. */}
      <PageHeader
        sticky
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Link to="/design" className="hover:text-foreground">
              Designs
            </Link>
            <span aria-hidden>/</span>
            <span>
              {design.analysis?.name ?? 'Untitled analysis'}
            </span>
          </span>
        }
        title={
          <span className="inline-flex items-center gap-3">
            {design.name}
            <span className="text-sm font-mono tabular-nums font-normal text-muted-foreground">
              v{design.version}
            </span>
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill tone={statusTone(design.status)} pulse={false}>
              {design.status || 'unknown'}
            </StatusPill>
            <StatusPill tone={design.is_active ? 'ok' : 'muted'} pulse={design.is_active}>
              {design.is_active ? 'Active' : 'Inactive'}
            </StatusPill>
          </span>
        }
        actions={headerActions}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Read-only geometry preview, driven by the linked analysis. */}
        {cfg && (
          <DataCard
            title="Lifting Geometry"
            subtitle="Read-only schematic of the configuration this design was calculated from."
            variant="glass"
          >
            <GeometryVisualizer
              L1={cfg.L1}
              L2={cfg.L2}
              L3={cfg.L3}
              L4={cfg.L4}
              B1={cfg.B1}
              B2={cfg.B2}
              B3={cfg.B3}
              B4={cfg.B4}
              h1={cfg.h1}
              h2={cfg.h2}
              h3={cfg.h3}
              h4={cfg.h4}
              quadrant={cfg.quadrant}
              lifting_points_qty={cfg.lifting_points_qty}
              crane_height={cfg.h_max}
              load_label={design.analysis?.name ?? design.name}
              height={360}
            />
          </DataCard>
        )}

        {/* Existing engineering results panel — untouched to preserve all
            sub-components and behavior. */}
        <DesignResultsDisplay design={design} />
      </div>
    </div>
  )
}
