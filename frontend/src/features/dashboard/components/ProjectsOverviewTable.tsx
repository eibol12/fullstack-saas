import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderOpen,
  Search,
  Trash2,
} from 'lucide-react'

import { ProjectOverview } from '@/types'
import { cn } from '@/lib/utils'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { useDeleteProject } from '@/features/projects/hooks/useProjects'
import { useDeleteAnalysis } from '@/features/analysis/hooks/useAnalyses'
import { useDeleteDesign } from '@/features/design/hooks/useDesigns'

/**
 * SORT
 *
 * Columns the table can be sorted by. Sorting is purely client-side
 * because the overview payload is already the full list of projects
 * for the authenticated user (one round-trip), and the dataset is
 * expected to stay small (≪ 1k projects per user).
 */
type SortKey = 'name' | 'analyses' | 'designs' | 'updated_at'
type SortDir = 'asc' | 'desc'

interface ProjectsOverviewTableProps {
  projects: ProjectOverview[]
  onCreateProjectClick?: () => void
}

const HEADERS: ReadonlyArray<{ key: SortKey; label: string; align?: 'right' }> = [
  { key: 'name', label: 'Project' },
  { key: 'analyses', label: '# Analyses', align: 'right' },
  { key: 'designs', label: '# Designs', align: 'right' },
  { key: 'updated_at', label: 'Last updated' },
]

function formatWeight(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

/**
 * ProjectsOverviewTable
 *
 * Hierarchical, sortable table rendering every project the user owns
 * with its analyses → designs and direct links into the unified
 * `/projects/:id/workspace` and the design report preview. Replaces
 * the old KPI/quick-action dashboard.
 *
 * UX choices:
 *  - Expand/collapse per row keeps the default view compact even for
 *    users with dozens of projects.
 *  - Action buttons mirror the new workspace-first navigation: opening
 *    a project always lands on `/projects/:id/workspace`.
 *  - "Has report" on a design is a server-computed boolean (true once
 *    the engine populated `results`); we surface it as a deep link.
 */
export function ProjectsOverviewTable({ projects, onCreateProjectClick }: ProjectsOverviewTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? [...projects].filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q)),
        )
      : [...projects]
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let av: number | string
      let bv: number | string
      switch (sortKey) {
        case 'name':
          av = a.name.toLowerCase()
          bv = b.name.toLowerCase()
          break
        case 'analyses':
          av = a.analyses_count
          bv = b.analyses_count
          break
        case 'designs':
          av = a.designs_count
          bv = b.designs_count
          break
        case 'updated_at':
          av = new Date(a.updated_at).getTime()
          bv = new Date(b.updated_at).getTime()
          break
      }
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return list
  }, [projects, sortKey, sortDir])

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-700">No projects yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Create a project to start running lifting analyses and rigging designs.
        </p>
        <button
          type="button"
          onClick={onCreateProjectClick}
          className="mt-4 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create first project
        </button>
      </div>
    )
  }


  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-8 px-3 py-3" />
            {HEADERS.map((h) => (
              <th
                key={h.key}
                className={cn(
                  'px-4 py-3 font-medium select-none',
                  h.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(h.key)}
                  className={cn(
                    'inline-flex items-center gap-1 hover:text-slate-900',
                    sortKey === h.key && 'text-slate-900',
                  )}
                >
                  {h.label}
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
            ))}
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                {search ? `No projects match "${search}"` : 'No projects yet.'}
              </td>
            </tr>
          ) : (
            sorted.map((project) => {
              const isOpen = expanded.has(project.id)
              return (
                <ProjectRow
                  key={project.id}
                  project={project}
                  isOpen={isOpen}
                  onToggle={() => toggleExpand(project.id)}
                />
              )
            })
          )}
        </tbody>
      </table>
    </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Row components                                                            */
/* -------------------------------------------------------------------------- */

function ProjectRow({
  project,
  isOpen,
  onToggle,
}: {
  project: ProjectOverview
  isOpen: boolean
  onToggle: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteProject = useDeleteProject()

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync(project.id)
      toast.success(`Project "${project.name}" deleted.`)
    } catch {
      toast.error('Failed to delete project.')
    } finally {
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-3 py-3 align-top">
          <button
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? 'Collapse project' : 'Expand project'}
            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="font-medium text-slate-900">{project.name}</div>
          {project.description && (
            <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">
              {project.description}
            </div>
          )}
        </td>

        <td className="px-4 py-3 align-top text-right tabular-nums text-slate-700">
          {project.analyses_count}
        </td>
        <td className="px-4 py-3 align-top text-right tabular-nums text-slate-700">
          {project.designs_count}
        </td>
        <td className="px-4 py-3 align-top text-slate-700">
          {formatDate(project.updated_at)}
        </td>
        <td className="px-4 py-3 align-top text-right">
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete project ${project.name}`}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <Link
              to={`/projects/${project.id}/workspace`}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </td>
      </tr>

      {isOpen && (
        <tr className="bg-slate-50/60">
          <td colSpan={6} className="px-12 py-4">
            {project.analyses.length === 0 ? (
              <p className="text-xs text-slate-500">
                No analyses yet.{' '}
                <Link
                  to={`/projects/${project.id}/workspace?tab=analysis`}
                  className="text-primary hover:underline"
                >
                  Create the first one →
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {project.analyses.map((analysis) => (
                  <AnalysisBlock
                    key={analysis.id}
                    projectId={project.id}
                    analysis={analysis}
                  />
                ))}
              </div>
            )}
          </td>
        </tr>
      )}

      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete project"
        message={`Are you sure you want to delete "${project.name}" and all its analyses and designs? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmButtonClassName="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
      />
    </>
  )
}

function AnalysisBlock({
  projectId,
  analysis,
}: {
  projectId: string
  analysis: ProjectOverview['analyses'][number]
}) {
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'analysis' | 'design'
    id: string
    name: string
  } | null>(null)
  const deleteAnalysis = useDeleteAnalysis()
  const deleteDesign = useDeleteDesign()

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return
    const { type, id, name } = deleteConfirm
    try {
      if (type === 'analysis') {
        await deleteAnalysis.mutateAsync({ id, projectId })
        toast.success(`Analysis "${name}" deleted.`)
      } else {
        await deleteDesign.mutateAsync(id)
        toast.success(`Design "${name}" deleted.`)
      }
    } catch {
      toast.error(`Failed to delete ${type}.`)
    } finally {
      setDeleteConfirm(null)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="min-w-0">
            <Link
              to={`/projects/${projectId}/workspace?tab=analysis&analysis=${analysis.id}`}
              className="font-medium text-slate-900 hover:text-primary hover:underline"
            >
              {analysis.name}
            </Link>
            <div className="text-xs text-slate-500">
              {analysis.location} · {analysis.lifting_points_qty} lifting points · MGW{' '}
              {formatWeight(analysis.maximum_gross_weight)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Updated {formatDate(analysis.updated_at)}
            </span>
            <button
              type="button"
              onClick={() => setDeleteConfirm({ type: 'analysis', id: analysis.id, name: analysis.name })}
              aria-label={`Delete analysis ${analysis.name}`}
              className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {analysis.designs.length === 0 ? (
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
            No designs yet.{' '}
            <Link
              to={`/projects/${projectId}/workspace?tab=design&analysis=${analysis.id}`}
              className="text-primary hover:underline"
            >
              Create a design →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {analysis.designs.map((design) => (
              <li
                key={design.id}
                className="group flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    to={`/projects/${projectId}/workspace?tab=design&analysis=${analysis.id}&design=${design.id}`}
                    className="text-slate-900 hover:text-primary hover:underline"
                  >
                    {design.name}
                  </Link>
                  <span className="ml-2 text-xs text-slate-500">
                    v{design.version} · {design.status}
                    {design.is_active && (
                      <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        active
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {design.has_report ? (
                    <Link
                      to={`/design/${design.id}/report`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Report
                    </Link>
                  ) : (
                    <span className="text-slate-400">No report</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ type: 'design', id: design.id, name: design.name })}
                    aria-label={`Delete design ${design.name}`}
                    className="rounded p-0.5 text-slate-200 transition-colors hover:bg-red-50 hover:text-destructive group-hover:text-slate-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
    </>
  )
}
