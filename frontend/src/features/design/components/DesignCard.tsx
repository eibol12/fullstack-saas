import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { RiggingDesignSummary } from '@/types'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'

interface DesignCardProps {
  design: RiggingDesignSummary
  onDelete?: (id: string) => void
}

/**
 * Map a design status string to a StatusPill tone. Backend currently emits
 * values like "draft", "active", "approved", "archived", "failed", etc.
 * Unknown statuses fall back to "info".
 */
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

/**
 * DesignCard
 *
 * Refactored to use the Blueprint & Steel design tokens introduced by the
 * UX/UI overhaul:
 *   - bg-card / border-border instead of hard-coded white/gray
 *   - StatusPill for status + active state (subtle outline + glowing dot)
 *   - font-mono tabular-nums for version numbers (engineering data)
 *   - subtle elevation on hover
 */
export function DesignCard({ design, onDelete }: DesignCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm(`Delete design "${design.name}"?`)) {
      onDelete?.(design.id)
    }
  }

  return (
    <Link
      to={`/design/${design.id}`}
      className="group block rounded-xl border border-border bg-card p-5 shadow-inset-soft
                 transition-all hover:border-primary/40 hover:shadow-paper hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {design.analysis_name && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-1 truncate">
              {design.analysis_name}
            </p>
          )}
          <h3 className="text-base font-semibold tracking-tight text-foreground mb-3 truncate">
            {design.name}
          </h3>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <StatusPill tone={statusTone(design.status)} pulse={false}>
              {design.status || 'unknown'}
            </StatusPill>
            <StatusPill tone={design.is_active ? 'ok' : 'muted'} pulse={design.is_active}>
              {design.is_active ? 'Active' : 'Inactive'}
            </StatusPill>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="uppercase tracking-wide">v</span>
              <span className="font-mono tabular-nums text-foreground ml-1">
                {design.version}
              </span>
            </span>
            <span>
              Updated{' '}
              <span className="font-mono tabular-nums text-foreground">
                {formatDistanceToNow(new Date(design.updated_at))}
              </span>{' '}
              ago
            </span>
          </div>
        </div>

        {onDelete && (
          <button
            onClick={handleDelete}
            className="shrink-0 p-2 rounded-md text-muted-foreground
                       opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10
                       transition-all focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={`Delete design ${design.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </Link>
  )
}

export default DesignCard
