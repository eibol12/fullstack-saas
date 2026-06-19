import { useEffect } from 'react'
import { Printer, ZoomIn, ZoomOut, RotateCcw, ArrowLeft } from 'lucide-react'

const ZOOM_LEVELS = [0.85, 1, 1.15, 1.3] as const
type Zoom = (typeof ZOOM_LEVELS)[number]

interface ReportFloatingActionBarProps {
  /** Anchor for the "Back to design" link. */
  backTo: string
  /**
   * Current zoom value. Use the imperatively-returned `zoom` from the parent
   * to set the `data-zoom` attribute on the `.report-sheet` element so the
   * CSS scale transform takes effect.
   */
  zoom: Zoom
  onZoomChange: (next: Zoom) => void
  /**
   * Optional explicit download handler (e.g. trigger an API export).
   * Falls back to `window.print()` when omitted.
   */
  onDownload?: () => void
}

/**
 * ReportFloatingActionBar
 *
 * Floating capsule at the bottom of the report viewport with quick actions:
 *  - back to design
 *  - zoom out / zoom in / reset
 *  - print / save as PDF
 *
 * Hidden in @media print via CSS (.report-floating-bar).
 */
export function ReportFloatingActionBar({
  backTo,
  zoom,
  onZoomChange,
  onDownload,
}: ReportFloatingActionBarProps) {
  const idx = ZOOM_LEVELS.indexOf(zoom)
  const canZoomOut = idx > 0
  const canZoomIn = idx < ZOOM_LEVELS.length - 1

  // Keyboard shortcuts: Ctrl/Cmd+P → print; +/- → zoom; 0 → reset.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === '+' || e.key === '=') {
        if (canZoomIn) onZoomChange(ZOOM_LEVELS[idx + 1])
      } else if (e.key === '-' || e.key === '_') {
        if (canZoomOut) onZoomChange(ZOOM_LEVELS[idx - 1])
      } else if (e.key === '0') {
        onZoomChange(1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [idx, canZoomIn, canZoomOut, onZoomChange])

  const print = () => (onDownload ? onDownload() : window.print())

  return (
    <div className="report-floating-bar" role="toolbar" aria-label="Report actions">
      <button
        type="button"
        onClick={() => (window.location.href = backTo)}
        title="Back to design"
        aria-label="Back to design"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Back</span>
      </button>
      <span className="report-floating-divider" aria-hidden />

      <button
        type="button"
        disabled={!canZoomOut}
        onClick={() => canZoomOut && onZoomChange(ZOOM_LEVELS[idx - 1])}
        title="Zoom out"
        aria-label="Zoom out"
        style={{ opacity: canZoomOut ? 1 : 0.4 }}
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <span className="report-floating-zoom" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        disabled={!canZoomIn}
        onClick={() => canZoomIn && onZoomChange(ZOOM_LEVELS[idx + 1])}
        title="Zoom in"
        aria-label="Zoom in"
        style={{ opacity: canZoomIn ? 1 : 0.4 }}
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onZoomChange(1)}
        title="Reset zoom"
        aria-label="Reset zoom"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>

      <span className="report-floating-divider" aria-hidden />
      <button type="button" onClick={print} title="Print / Save PDF" aria-label="Print or save as PDF">
        <Printer className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Print / PDF</span>
      </button>
    </div>
  )
}

export { ZOOM_LEVELS }
export type { Zoom }
