import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  FileText,
  Lock,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'

import { useProject } from '@/features/projects/hooks/useProjects'
import {
  useAnalysis,
  useCreateAnalysis,
  useDeleteAnalysis,
  useUpdateAnalysis,
} from '@/features/analysis/hooks/useAnalyses'
import {
  useDesign,
  useDesigns,
  useCreateDesign,
  useDeleteDesign,
  useUpdateDesign,
} from '@/features/design/hooks/useDesigns'
import { AnalysisForm } from '@/features/analysis/components/AnalysisForm'
import { AnalysisResultsDisplay } from '@/features/analysis/components/AnalysisResultsDisplay'
import { DesignForm } from '@/features/design/components/DesignForm'
import { DesignResultsDisplay } from '@/features/design/components/DesignResultsDisplay'
import { buildAnalysisCreatePayload } from '@/features/analysis/utils/buildAnalysisCreatePayload'
import { analysisToFormData } from '@/features/workspace/utils/analysisToFormData'
import { AnalysisFormData, CombinationKey, DesignFormData } from '@/types'
import { parseApiError } from '@/lib/errors'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { DataCard } from '@/components/ui/DataCard'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { cn } from '@/lib/utils'

type TabId = 'analysis' | 'design' | 'report'

function isTabId(value: string | null): value is TabId {
  return value === 'analysis' || value === 'design' || value === 'report'
}

// ─── Rail step node ────────────────────────────────────────────────────────────

interface RailStepNodeProps {
  number: number
  isActive: boolean
  isDone: boolean
  isLocked: boolean
  onClick: () => void
}

function RailStepNode({ number, isActive, isDone, isLocked, onClick }: RailStepNodeProps) {
  return (
    <button
      type="button"
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      aria-current={isActive ? 'step' : undefined}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive &&
          'border-primary bg-primary text-primary-foreground',
        isDone && !isActive &&
          'border-primary bg-primary/10 text-primary hover:bg-primary/20',
        !isActive && !isDone && !isLocked &&
          'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground',
        isLocked &&
          'cursor-not-allowed border-border/40 bg-muted text-muted-foreground/40',
      )}
    >
      {isDone && !isActive ? <Check className="h-3.5 w-3.5" /> : number}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectWorkspacePage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // ---------- URL-driven state ----------
  const tabParam = searchParams.get('tab')
  const activeTab: TabId = isTabId(tabParam) ? tabParam : 'analysis'
  const analysisIdParam = searchParams.get('analysis') ?? ''
  const designIdParam = searchParams.get('design') ?? ''

  // Local UI flags — "soft" edit mode, does not touch the URL so refreshing
  // the page always lands on read mode (results-first, edit on demand).
  const [editingAnalysis, setEditingAnalysis] = useState(false)
  const [creatingAnalysis, setCreatingAnalysis] = useState(false)
  const [editingDesign, setEditingDesign] = useState(false)
  const [creatingDesign, setCreatingDesign] = useState(false)

  // Unsaved-changes guard — holds the intended tab while the dialog is open.
  const [pendingTab, setPendingTab] = useState<TabId | null>(null)

  // Which combination key the user selected "for report" in the design results.
  const [selectedCombinationKey, setSelectedCombinationKey] = useState<CombinationKey | null>(null)

  // ---------- Data ----------
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(
    projectId ?? '',
  )

  const analyses = useMemo(() => {
    const list = project?.analyses ?? []
    return [...list].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
  }, [project])

  const effectiveAnalysisId = analysisIdParam || analyses[0]?.id || ''
  const { data: analysis } = useAnalysis(effectiveAnalysisId)

  const { data: designs } = useDesigns(projectId, effectiveAnalysisId || undefined)
  const sortedDesigns = useMemo(() => {
    const list = designs ?? []
    return [...list].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
  }, [designs])

  const effectiveDesignId = designIdParam || sortedDesigns[0]?.id || ''
  const { data: design } = useDesign(effectiveDesignId)

  // ---------- Mutations ----------
  const createAnalysis = useCreateAnalysis()
  const updateAnalysis = useUpdateAnalysis()
  const deleteAnalysis = useDeleteAnalysis()
  const createDesign = useCreateDesign()
  const updateDesign = useUpdateDesign()
  const deleteDesign = useDeleteDesign()

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'analysis' | 'design'
    id: string
    name: string
  } | null>(null)

  // ---------- URL helpers ----------
  const setParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next, { replace: true })
  }

  const goToTab = (tab: TabId) => setParams({ tab })

  const isDirty = creatingAnalysis || editingAnalysis || creatingDesign || editingDesign

  const requestTabChange = (tab: TabId) => {
    if (isDirty && tab !== activeTab) {
      setPendingTab(tab)
    } else {
      goToTab(tab)
    }
  }

  const confirmTabChange = () => {
    if (!pendingTab) return
    setCreatingAnalysis(false)
    setEditingAnalysis(false)
    setCreatingDesign(false)
    setEditingDesign(false)
    goToTab(pendingTab)
    setPendingTab(null)
  }

  useEffect(() => {
    if (effectiveAnalysisId && !analysisIdParam) {
      setParams({ analysis: effectiveAnalysisId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAnalysisId])

  useEffect(() => {
    if (effectiveDesignId && !designIdParam) {
      setParams({ design: effectiveDesignId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDesignId])

  const handleSelectAnalysis = (id: string) => {
    setEditingAnalysis(false)
    setCreatingAnalysis(false)
    setEditingDesign(false)
    setCreatingDesign(false)
    setParams({ analysis: id, design: undefined })
  }

  // ---------- Submit handlers ----------
  const handleAnalysisSubmit = async (formData: AnalysisFormData) => {
    if (!projectId) {
      toast.error('Project ID is required')
      return
    }
    try {
      if (creatingAnalysis || !analysis) {
        const payload = buildAnalysisCreatePayload(formData, projectId)
        const created = await createAnalysis.mutateAsync(payload)
        toast.success(`Analysis "${created.name}" created.`)
        setCreatingAnalysis(false)
        setParams({ analysis: created.id, tab: 'analysis' })
      } else {
        const { project_id: _ignored, ...patch } = buildAnalysisCreatePayload(formData, projectId)
        await updateAnalysis.mutateAsync({ id: analysis.id, data: patch })
        toast.success('Analysis updated and recomputed.')
        setEditingAnalysis(false)
      }
    } catch (err) {
      toast.error(parseApiError(err))
    }
  }

  const handleDesignSubmit = async (formData: DesignFormData) => {
    try {
      if (creatingDesign || !design) {
        if (!effectiveAnalysisId) {
          toast.error('Select an analysis before creating a design.')
          return
        }
        const created = await createDesign.mutateAsync({
          name: formData.name,
          set_active: formData.set_active,
          user_preferences: formData.user_preferences,
          analysis_id: effectiveAnalysisId,
        })
        toast.success(`Design "${created.name}" created.`)
        setCreatingDesign(false)
        setParams({ design: created.id, tab: 'design' })
      } else {
        await updateDesign.mutateAsync({
          id: design.id,
          data: {
            name: formData.name,
            is_active: formData.set_active,
            user_preferences: formData.user_preferences,
          },
        })
        toast.success('Design updated and recomputed.')
        setEditingDesign(false)
      }
    } catch (err) {
      toast.error(parseApiError(err))
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return
    const { type, id, name } = deleteConfirm
    try {
      if (type === 'analysis') {
        await deleteAnalysis.mutateAsync({ id, projectId: projectId! })
        toast.success(`Analysis "${name}" deleted.`)
        if (id === effectiveAnalysisId) setParams({ analysis: undefined, design: undefined })
      } else {
        await deleteDesign.mutateAsync(id)
        toast.success(`Design "${name}" deleted.`)
        if (id === effectiveDesignId) setParams({ design: undefined })
      }
    } catch (err) {
      toast.error(parseApiError(err))
    } finally {
      setDeleteConfirm(null)
    }
  }

  // ---------- Loading / error states ----------
  if (projectLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
        <Skeleton className="h-8 w-72" />
        <SkeletonText lines={2} />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (projectError || !project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <DataCard
          title={
            <span className="inline-flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Failed to load project
            </span>
          }
        >
          <p className="mb-4 text-sm text-muted-foreground">
            {(projectError as Error)?.message || 'Project not found.'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </button>
        </DataCard>
      </div>
    )
  }

  // ---------- Derived display flags ----------
  const showAnalysisForm = creatingAnalysis || editingAnalysis || !analysis
  const designLocked = !effectiveAnalysisId
  const reportLocked = !effectiveDesignId

  // Step done = has data and not currently in form/edit mode
  const analysisDone = !!analysis && !showAnalysisForm
  const designDone = !!design && !creatingDesign && !editingDesign

  const reportUrl = `/design/${effectiveDesignId}/report${
    selectedCombinationKey ? `?selected_key=${selectedCombinationKey}` : ''
  }`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

      {/* ── Breadcrumb + project header ─────────────────────────────────── */}
      <header>
        <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-sm">
          <Link
            to="/dashboard"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          <Link
            to={`/projects/${projectId}/workspace`}
            className="max-w-[200px] truncate text-muted-foreground transition-colors hover:text-foreground"
          >
            {project.name}
          </Link>
          {analysis && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              <button
                type="button"
                onClick={() => requestTabChange('analysis')}
                className={cn(
                  'max-w-[180px] truncate transition-colors',
                  activeTab === 'analysis'
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {analysis.name}
              </button>
            </>
          )}
          {design && activeTab !== 'analysis' && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              <button
                type="button"
                onClick={() => requestTabChange('design')}
                className={cn(
                  'max-w-[180px] truncate transition-colors',
                  activeTab === 'design'
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {design.name}
              </button>
            </>
          )}
          {activeTab === 'report' && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              <span className="font-medium text-foreground">Report</span>
            </>
          )}
        </nav>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </header>

      {/* ── Mobile step selector (hidden on md+) ────────────────────────── */}
      <div className="flex gap-0 border-b border-border md:hidden">
        {(
          [
            { id: 'analysis' as TabId, label: 'Analysis', locked: false,       done: analysisDone },
            { id: 'design'   as TabId, label: 'Design',   locked: designLocked, done: designDone  },
            { id: 'report'   as TabId, label: 'Report',   locked: reportLocked, done: false       },
          ] as const
        ).map((step) => {
          const isActive = activeTab === step.id
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => !step.locked && requestTabChange(step.id)}
              disabled={step.locked}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-medium -mb-px transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : step.locked
                  ? 'cursor-not-allowed border-transparent text-muted-foreground/40'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {step.done && !isActive ? (
                <Check className="h-3 w-3 text-primary" />
              ) : step.locked ? (
                <Lock className="h-3 w-3" />
              ) : null}
              {step.label}
            </button>
          )
        })}
      </div>

      {/* ── Main two-column workspace ────────────────────────────────────── */}
      <div className="flex items-start gap-8">

        {/* ── Left progress rail (desktop only) ─────────────────────────── */}
        <aside className="hidden md:flex w-52 shrink-0 flex-col">

          {/* ── Step 1: Analysis ── */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <RailStepNode
                number={1}
                isActive={activeTab === 'analysis'}
                isDone={analysisDone}
                isLocked={false}
                onClick={() => requestTabChange('analysis')}
              />
              {/* connector */}
              <div className="mt-1 w-px flex-1 bg-border" style={{ minHeight: '1rem' }} />
            </div>
            <div className="flex-1 pb-3 min-w-0">
              <button
                type="button"
                onClick={() => requestTabChange('analysis')}
                className={cn(
                  'mb-1.5 text-sm font-medium transition-colors',
                  activeTab === 'analysis' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Analysis
              </button>

              {/* Analysis list */}
              <ul className="space-y-0.5">
                {analyses.map((a) => (
                  <li key={a.id} className="group flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleSelectAnalysis(a.id)}
                      className={cn(
                        'min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-xs transition-colors',
                        a.id === effectiveAnalysisId
                          ? 'bg-primary/8 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {a.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ type: 'analysis', id: a.id, name: a.name })}
                      aria-label={`Delete analysis ${a.name}`}
                      className="shrink-0 rounded p-0.5 text-transparent group-hover:text-muted-foreground hover:!text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
                {analyses.length === 0 && (
                  <li className="px-2 text-xs text-muted-foreground">No analyses yet.</li>
                )}
              </ul>

              <button
                type="button"
                onClick={() => {
                  setCreatingAnalysis(true)
                  setEditingAnalysis(false)
                  goToTab('analysis')
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
              >
                <Plus className="h-3 w-3" /> New analysis
              </button>
            </div>
          </div>

          {/* ── Step 2: Design ── */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <RailStepNode
                number={2}
                isActive={activeTab === 'design'}
                isDone={designDone}
                isLocked={designLocked}
                onClick={() => requestTabChange('design')}
              />
              <div className="mt-1 w-px flex-1 bg-border" style={{ minHeight: '1rem' }} />
            </div>
            <div className="flex-1 pb-3 min-w-0">
              <button
                type="button"
                onClick={() => !designLocked && requestTabChange('design')}
                disabled={designLocked}
                className={cn(
                  'mb-1.5 flex items-center gap-1.5 text-sm font-medium transition-colors',
                  activeTab === 'design' && 'text-foreground',
                  !designLocked && activeTab !== 'design' && 'text-muted-foreground hover:text-foreground',
                  designLocked && 'cursor-not-allowed text-muted-foreground/40',
                )}
              >
                Design
                {designLocked && <Lock className="h-3 w-3" />}
              </button>

              {designLocked ? (
                <p className="px-2 text-xs text-muted-foreground/60">
                  Complete an analysis first.
                </p>
              ) : (
                <>
                  <ul className="space-y-0.5">
                    {sortedDesigns.map((d) => (
                      <li key={d.id} className="group flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDesign(false)
                            setCreatingDesign(false)
                            setParams({ design: d.id })
                            if (activeTab !== 'design') goToTab('design')
                          }}
                          className={cn(
                            'min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-xs transition-colors',
                            d.id === effectiveDesignId
                              ? 'bg-primary/8 font-medium text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {d.name}{' '}
                          <span className="text-muted-foreground/60">v{d.version}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ type: 'design', id: d.id, name: d.name })}
                          aria-label={`Delete design ${d.name}`}
                          className="shrink-0 rounded p-0.5 text-transparent group-hover:text-muted-foreground hover:!text-destructive transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                    {sortedDesigns.length === 0 && (
                      <li className="px-2 text-xs text-muted-foreground">No designs yet.</li>
                    )}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingDesign(true)
                      setEditingDesign(false)
                      requestTabChange('design')
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    <Plus className="h-3 w-3" /> New design
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Step 3: Report ── */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <RailStepNode
                number={3}
                isActive={activeTab === 'report'}
                isDone={false}
                isLocked={reportLocked}
                onClick={() => requestTabChange('report')}
              />
            </div>
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => !reportLocked && requestTabChange('report')}
                disabled={reportLocked}
                className={cn(
                  'mb-1.5 flex items-center gap-1.5 text-sm font-medium transition-colors',
                  activeTab === 'report' && 'text-foreground',
                  !reportLocked && activeTab !== 'report' && 'text-muted-foreground hover:text-foreground',
                  reportLocked && 'cursor-not-allowed text-muted-foreground/40',
                )}
              >
                Report
                {reportLocked && <Lock className="h-3 w-3" />}
              </button>

              {reportLocked ? (
                <p className="px-2 text-xs text-muted-foreground/60">
                  Generate a design first.
                </p>
              ) : (
                <div className="px-2 space-y-1">
                  {selectedCombinationKey && (
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {selectedCombinationKey.replace('_', ' ')} combination
                    </p>
                  )}
                  <Link
                    to={reportUrl}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    <FileText className="h-3 w-3" /> Open full report
                  </Link>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── Content area ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── Analysis content ── */}
          {activeTab === 'analysis' && (
            <section className="space-y-4">
              {showAnalysisForm ? (
                <DataCard
                  title={
                    <div className="flex w-full items-center justify-between">
                      <span>
                        {creatingAnalysis || !analysis ? 'New analysis' : `Edit "${analysis.name}"`}
                      </span>
                      {(creatingAnalysis || editingAnalysis) && (
                        <button
                          onClick={() => {
                            setCreatingAnalysis(false)
                            setEditingAnalysis(false)
                          }}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  }
                >
                  <AnalysisForm
                    key={creatingAnalysis ? 'new' : analysis?.id ?? 'empty'}
                    initialData={creatingAnalysis ? undefined : analysisToFormData(analysis)}
                    onSubmit={handleAnalysisSubmit}
                    onCancel={
                      creatingAnalysis || editingAnalysis
                        ? () => {
                            setCreatingAnalysis(false)
                            setEditingAnalysis(false)
                          }
                        : undefined
                    }
                    submitLabel={creatingAnalysis || !analysis ? 'Create analysis' : 'Save & recompute'}
                  />
                </DataCard>
              ) : analysis ? (
                <>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setDeleteConfirm({ type: 'analysis', id: analysis.id, name: analysis.name })}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-card px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                    <button
                      onClick={() => setEditingAnalysis(true)}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <Pencil className="h-4 w-4" /> Edit & recompute
                    </button>
                  </div>
                  <AnalysisResultsDisplay analysis={analysis} />
                </>
              ) : null}
            </section>
          )}

          {/* ── Design content ── */}
          {activeTab === 'design' && (
            <section className="space-y-4">
              {designLocked ? (
                <DataCard title="No analysis yet">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Complete an analysis first — designs require a calculated set of DNV sling
                      loads to work with.
                    </p>
                    <button
                      onClick={() => goToTab('analysis')}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Go to Analysis
                    </button>
                  </div>
                </DataCard>
              ) : (
                <>
                  {/* Mobile-only design switcher (rail is hidden on mobile) */}
                  <div className="flex items-center justify-between flex-wrap gap-2 md:hidden">
                    <div className="flex items-center gap-2">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Design
                      </label>
                      <select
                        value={effectiveDesignId}
                        onChange={(e) => {
                          setEditingDesign(false)
                          setCreatingDesign(false)
                          setParams({ design: e.target.value })
                        }}
                        disabled={sortedDesigns.length === 0}
                        className="min-w-[12rem] rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                      >
                        {sortedDesigns.length === 0 && <option value="">No designs yet</option>}
                        {sortedDesigns.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} (v{d.version})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        setCreatingDesign(true)
                        setEditingDesign(false)
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" /> New design
                    </button>
                  </div>

                  {/* Design form or results */}
                  {creatingDesign || editingDesign || !design ? (
                    <DataCard
                      title={
                        <div className="flex w-full items-center justify-between">
                          <span>
                            {creatingDesign || !design ? 'New design' : `Edit "${design.name}"`}
                          </span>
                          {(creatingDesign || editingDesign) && (
                            <button
                              onClick={() => {
                                setCreatingDesign(false)
                                setEditingDesign(false)
                              }}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3.5 w-3.5" /> Cancel
                            </button>
                          )}
                        </div>
                      }
                    >
                      <DesignForm
                        key={creatingDesign ? 'new' : design?.id ?? 'empty'}
                        initialData={
                          creatingDesign || !design
                            ? undefined
                            : {
                                name: design.name,
                                set_active: design.is_active,
                                user_preferences: design.results?.user_preferences ?? undefined,
                              }
                        }
                        onSubmit={handleDesignSubmit}
                        onCancel={
                          creatingDesign || editingDesign
                            ? () => {
                                setCreatingDesign(false)
                                setEditingDesign(false)
                              }
                            : undefined
                        }
                        submitLabel={creatingDesign || !design ? 'Create design' : 'Save & recompute'}
                      />
                    </DataCard>
                  ) : design ? (
                    <>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setDeleteConfirm({ type: 'design', id: design.id, name: design.name })}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-card px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                        <button
                          onClick={() => setEditingDesign(true)}
                          className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" /> Edit & recompute
                        </button>
                      </div>
                      <DesignResultsDisplay
                        design={design}
                        onCombinationSelect={(key) => setSelectedCombinationKey(key)}
                      />
                    </>
                  ) : null}
                </>
              )}
            </section>
          )}

          {/* ── Report content ── */}
          {activeTab === 'report' && (
            <section className="space-y-4">
              {!reportLocked ? (
                <DataCard title="Report">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Open the full traceable report in a dedicated view. Reports are generated from
                    the currently selected design's results.
                  </p>
                  <div className="space-y-2">
                    {selectedCombinationKey && (
                      <p className="text-xs text-muted-foreground">
                        Reporting combination:{' '}
                        <span className="font-medium capitalize text-foreground">
                          {selectedCombinationKey.replace('_', ' ')}
                        </span>
                        {' '}— change in the Design step.
                      </p>
                    )}
                    <Link
                      to={reportUrl}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <FileText className="h-4 w-4" /> Open report
                    </Link>
                  </div>
                </DataCard>
              ) : (
                <DataCard title="No design yet">
                  <p className="text-sm text-muted-foreground">
                    Generate or select a rigging design first — reports are produced from a
                    design's calculation results.
                  </p>
                </DataCard>
              )}
            </section>
          )}

        </div>
      </div>

      {/* ── Unsaved-changes guard ──────────────────────────────────────── */}
      <ConfirmationModal
        isOpen={pendingTab !== null}
        onClose={() => setPendingTab(null)}
        onConfirm={confirmTabChange}
        title="Unsaved changes"
        message="You have an open form with unsaved changes. Discard them and switch steps?"
        confirmLabel="Discard & switch"
        cancelLabel="Stay here"
        confirmButtonClassName="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
      />

      {/* ── Delete confirmation ────────────────────────────────────────── */}
      <ConfirmationModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirmed}
        title={`Delete ${deleteConfirm?.type ?? ''}`}
        message={`Are you sure you want to delete "${deleteConfirm?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmButtonClassName="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
      />

    </div>
  )
}
