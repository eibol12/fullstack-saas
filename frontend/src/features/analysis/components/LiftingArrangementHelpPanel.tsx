import type { LiftingArrangementGuide } from '@/features/analysis/utils/liftingArrangementGuide'

interface LiftingArrangementHelpPanelProps {
  guide: LiftingArrangementGuide | null
  isOpen: boolean
  panelId: string
  titleId: string
}

export function LiftingArrangementHelpPanel({
  guide,
  isOpen,
  panelId,
  titleId,
}: LiftingArrangementHelpPanelProps) {
  if (!isOpen || !guide) {
    return null
  }

  return (
    <section
      id={panelId}
      aria-labelledby={titleId}
      className="mt-5 overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-slate-50 via-white to-blue-50/70 shadow-sm"
    >
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)] md:items-center md:gap-6 md:p-5">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <img
            src={guide.imageUrl}
            alt={guide.alt}
            loading="lazy"
            decoding="async"
            className="max-h-72 w-full object-contain"
          />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Arrangement Guide
            </p>
            <h4 id={titleId} className="mt-1 text-base font-semibold text-slate-900">
              {guide.title}
            </h4>
          </div>

          <p className="text-sm leading-6 text-slate-600">
            Reference sketch only. Confirm the arrangement matches the lifting-points
            configuration selected in the form.
          </p>
        </div>
      </div>
    </section>
  )
}
