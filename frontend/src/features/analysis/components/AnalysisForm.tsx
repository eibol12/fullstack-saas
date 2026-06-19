import { useForm, useWatch, FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnalysisFormData } from '@/types'
import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ClipboardList, Move3D, Calculator, Compass } from 'lucide-react'
import { LiftingArrangementHelpPanel } from '@/features/analysis/components/LiftingArrangementHelpPanel'
import { getLiftingArrangementGuide } from '@/features/analysis/utils/liftingArrangementGuide'
import { ANALYSIS_DISPLAY_LABELS } from '@/lib/analysisDisplay'
import { GeometryVisualizer } from '@/components/visualizer/GeometryVisualizer'
import { CornerGeometryFieldset } from '@/features/workspace/components/CornerGeometryFieldset'
import { PDFCanvasCalibrator } from './PDFCanvasCalibrator'
import {
  AnalysisFormStepper,
  ANALYSIS_FORM_STEPS,
  type StepId,
} from './AnalysisFormStepper'
import { cn } from '@/lib/utils'

/**
 * Per-point coordinate schema. We keep a fixed 4-slot array under the
 * hood so users can switch lifting-point counts without losing data;
 * only the first `lifting_points_qty` entries are submitted.
 */
const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
})

const analysisSchema = z.object({
  name: z.string().min(1, 'Analysis name is required'),
  maximum_gross_weight: z.number().min(0.1, 'Maximum gross weight must be positive'),
  location: z.enum(['onshore', 'offshore', 'inshore', 'subsea']),
  lifting_points_qty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  h_max: z.number().min(1, 'Crane height must be at least 1m'),
  x_cog: z.number(),
  y_cog: z.number(),
  z_cog: z.number(),
  points: z.array(pointSchema).length(4),
  quadrant: z.enum(['center', 'left', 'right']).optional(),
  same_height: z.boolean().optional(),
})

interface AnalysisFormProps {
  initialData?: Partial<AnalysisFormData>
  onSubmit: (data: AnalysisFormData) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
}

/**
 * Common Tailwind classes used by every text/number/select control in this
 * form. Centralising them keeps the visual rhythm consistent and easy to
 * adjust under the Blueprint & Steel design tokens.
 */
const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'text-foreground placeholder:text-muted-foreground ' +
  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent ' +
  'disabled:bg-muted/50 disabled:text-muted-foreground disabled:cursor-not-allowed'

const labelClass = 'block text-sm font-medium text-foreground mb-1'
const errorClass = 'mt-1 text-xs text-destructive'

/**
 * Build the fixed 4-slot `points` array used internally by the form,
 * merging any caller-provided initial points without losing the slots
 * the user has not yet filled in (so changing `lifting_points_qty` keeps
 * previously entered data).
 */
function buildInitialPoints(
  source?: Partial<AnalysisFormData>,
): AnalysisFormData['points'] {
  const provided = source?.points ?? []
  return [0, 1, 2, 3].map((i) => ({
    x: provided[i]?.x ?? 0,
    y: provided[i]?.y ?? 0,
    z: provided[i]?.z ?? 0,
  }))
}

/**
 * AnalysisForm
 *
 * 3-step stepper (Basic Info → Geometry → Review) built around the
 * corner-reference geometry model: engineers enter skid dimensions, COG
 * and lifting-point coordinates measured from a single physical corner,
 * which matches what they can read directly off the rigging drawing
 * without CAD access. The live `GeometryVisualizer` keeps consuming the
 * legacy L/h/B inputs, so we derive them locally from the corner-reference
 * values (same formula as `domain/geometry/corner_to_cog.py`).
 */
export function AnalysisForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Create Analysis',
}: AnalysisFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<AnalysisFormData>({
    resolver: zodResolver(analysisSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      maximum_gross_weight: initialData?.maximum_gross_weight ?? 0,
      location: initialData?.location ?? 'offshore',
      lifting_points_qty: (initialData?.lifting_points_qty ?? 2) as 1 | 2 | 3 | 4,
      h_max: initialData?.h_max ?? 1,
      x_cog: initialData?.x_cog ?? 0,
      y_cog: initialData?.y_cog ?? 0,
      z_cog: initialData?.z_cog ?? 0,
      points: buildInitialPoints(initialData),
      quadrant: initialData?.quadrant,
      same_height: initialData?.same_height ?? false,
    },
  })

  // Watched values — used both to render the visualizer and to drive the
  // conditional geometry inputs (3-point quadrant, equal heights, etc.).
  const watched = useWatch({ control })
  const liftingPoints = (watched.lifting_points_qty ?? 2) as 1 | 2 | 3 | 4
  const sameHeight = watched.same_height
  const points = (watched.points ?? []).map((p) => ({
    x: p?.x ?? 0,
    y: p?.y ?? 0,
    z: p?.z ?? 0,
  }))
  const zCog = watched.z_cog ?? 0

  const [isLiftingArrangementHelpOpen, setIsLiftingArrangementHelpOpen] = useState(false)
  const [isCalibratorOpen, setIsCalibratorOpen] = useState(false)
  const liftingArrangementPanelId = useId()
  const liftingArrangementTitleId = useId()
  const liftingArrangementGuide = getLiftingArrangementGuide(liftingPoints)

  // Stepper state — purely client-side, persists across re-renders.
  const [step, setStep] = useState<StepId>('basic')
  const [visitedSteps, setVisitedSteps] = useState<Set<StepId>>(
    () => new Set<StepId>(['basic']),
  )

  // Auto-align lifting-point Z with COG plane when "same height" is on.
  useEffect(() => {
    if (sameHeight) {
      for (let i = 0; i < 4; i++) {
        setValue(`points.${i}.z` as const, zCog ?? 0)
      }
    }
  }, [sameHeight, zCog, setValue])

  /**
   * Coordinates relative to CoG reference origin.
   */

  // Per-step field lists used by the Next button to validate only the
  // current step before advancing.
  const stepFields: Record<StepId, FieldPath<AnalysisFormData>[]> = useMemo(() => {
    const pointFields = Array.from({ length: liftingPoints }, (_, i) => [
      `points.${i}.x` as FieldPath<AnalysisFormData>,
      `points.${i}.y` as FieldPath<AnalysisFormData>,
      `points.${i}.z` as FieldPath<AnalysisFormData>,
    ]).flat()
     return {
      basic: ['name', 'maximum_gross_weight', 'location', 'lifting_points_qty'],
      geometry: [
        'h_max',
        'x_cog',
        'y_cog',
        'z_cog',
        ...pointFields,
        ...(liftingPoints === 3 ? (['quadrant'] as FieldPath<AnalysisFormData>[]) : []),
      ],
      review: [],
    }
  }, [liftingPoints])

  const goToStep = (next: StepId) => {
    setStep(next)
    setVisitedSteps((prev) => new Set(prev).add(next))
  }

  const handleNext = async () => {
    const ok = await trigger(stepFields[step], { shouldFocus: true })
    if (!ok) return
    if (step === 'basic') goToStep('geometry')
    else if (step === 'geometry') goToStep('review')
  }

  const handleBack = () => {
    if (step === 'review') goToStep('geometry')
    else if (step === 'geometry') goToStep('basic')
  }

  const handleFormSubmit = async (data: AnalysisFormData) => {
    await onSubmit(data)
  }

  // ------- Section icon for each card header -------
  const StepIcon =
    step === 'basic' ? ClipboardList : step === 'geometry' ? Move3D : Calculator

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Stepper */}
      <AnalysisFormStepper
        currentStep={step}
        visitedSteps={visitedSteps}
        onStepChange={(next) => {
          // Going backwards is always free.
          if (visitedSteps.has(next)) setStep(next)
        }}
      />

      {/* ============================================
       *  STEP 1 — Basic Info
       * ============================================ */}
      {step === 'basic' && (
        <section className="card-glass p-6">
          <header className="mb-5 flex items-center gap-2">
            <StepIcon className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Analysis Information
            </h3>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Analysis Name *</label>
              <input {...register('name')} type="text" className={inputClass} />
              {errors.name && <p className={errorClass}>{errors.name.message}</p>}
            </div>

            <div>
              <label className={labelClass}>
                {ANALYSIS_DISPLAY_LABELS.dryWeight} (kg) *
              </label>
              <input
                {...register('maximum_gross_weight', { valueAsNumber: true })}
                type="number"
                step="0.01"
                className={cn(inputClass, 'font-mono tabular-nums')}
              />
              {errors.maximum_gross_weight && (
                <p className={errorClass}>{errors.maximum_gross_weight.message}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                {ANALYSIS_DISPLAY_LABELS.scenario} *
              </label>
              <select {...register('location')} className={inputClass}>
                <option value="offshore">Offshore</option>
                <option value="onshore">Onshore</option>
                <option value="inshore">Inshore</option>
                <option value="subsea">Subsea</option>
              </select>
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <label htmlFor="lifting_points_qty" className={labelClass}>
                  Lifting Points Quantity *
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setIsLiftingArrangementHelpOpen((isOpen) => !isOpen)
                  }
                  aria-expanded={isLiftingArrangementHelpOpen}
                  aria-controls={liftingArrangementPanelId}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full
                             border border-primary/30 bg-primary/5 px-3 py-1 text-xs
                             font-medium text-primary transition-colors
                             hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.25 9a3.75 3.75 0 117.5 0c0 1.82-1.23 2.74-2.19 3.46-.91.68-1.56 1.23-1.56 2.29M12 17.25h.008v.008H12v-.008z"
                    />
                  </svg>
                  Need help?
                </button>
              </div>
              <select
                id="lifting_points_qty"
                {...register('lifting_points_qty', { valueAsNumber: true })}
                className={inputClass}
              >
                <option value={1}>1 Point</option>
                <option value={2}>2 Point</option>
                <option value={3}>3 Point</option>
                <option value={4}>4 Point</option>
              </select>
            </div>
          </div>

          <LiftingArrangementHelpPanel
            guide={liftingArrangementGuide}
            isOpen={isLiftingArrangementHelpOpen}
            panelId={liftingArrangementPanelId}
            titleId={liftingArrangementTitleId}
          />
        </section>
      )}

      {/* ============================================
       *  STEP 2 — Geometry (corner-reference) + Live Visualizer
       * ============================================ */}
      {step === 'geometry' && (
        <section className="card-glass p-6">
          <header className="mb-5 flex items-center gap-2">
            <div className="flex items-center gap-2">
              <StepIcon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                Geometry Configuration
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsCalibratorOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition duration-200"
            >
              <Compass className="h-3.5 w-3.5" />
              Calibrate from PDF
            </button>
          </header>

          <p className="mb-4 text-xs text-muted-foreground">
            Define the Centre of Gravity (CoG) on your drawing and
            enter all lifting point coordinates relative to it. The system
            calculates the relative distances automatically — no AutoCAD required.
          </p>

          {/* Side-by-side: inputs (left) + live visualizer (right, sticky on lg+) */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(280px,420px)] gap-6">
            {/* ---------------- Inputs column ---------------- */}
            <div className="space-y-5">
              {/* Maximum Crane Height */}
              <div>
                <label className={labelClass}>Hook Height (m) *</label>
                <input
                  {...register('h_max', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  className={cn(inputClass, 'font-mono tabular-nums')}
                />
                {errors.h_max && <p className={errorClass}>{errors.h_max.message}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  Vertical distance from the lowest lifting point up to the
                  hook in metres.
                </p>
              </div>

              <CornerGeometryFieldset
                register={register}
                liftingPoints={liftingPoints}
                sameHeight={sameHeight}
              />

              {/* Equal Heights Toggle */}
              {liftingPoints >= 2 && (
                <label
                  className="flex items-start gap-3 rounded-lg border border-border
                             bg-secondary/40 p-4 cursor-pointer hover:bg-secondary/60
                             transition-colors"
                >
                  <input
                    type="checkbox"
                    {...register('same_height')}
                    className="mt-0.5 h-4 w-4 rounded border-input text-primary
                               focus:ring-2 focus:ring-ring"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      Equal Lifting Point Heights
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      When enabled, every lifting point's Z is locked to the
                      COG plane for a perfectly level lift.
                    </span>
                  </span>
                </label>
              )}

              {/* Quadrant selector for 3-point */}
              {liftingPoints === 3 && (
                <div>
                  <label className={labelClass}>Width Quadrant *</label>
                  <select {...register('quadrant')} className={inputClass}>
                    <option value="">Select Quadrant</option>
                    <option value="center">Center</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Visualisation hint for the third point — does not change
                    the corner coordinates you entered above.
                  </p>
                </div>
              )}
            </div>

            {/* ---------------- Visualizer column ---------------- */}
            <aside className="lg:sticky lg:top-20 self-start space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Live geometry preview
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {liftingPoints} pt
                </span>
              </div>
              <GeometryVisualizer
                cog={{ x: watched.x_cog ?? 0, y: watched.y_cog ?? 0, z: watched.z_cog ?? 0 }}
                points={points}
                h_max={watched.h_max}
                lifting_points_qty={watched.lifting_points_qty}
                load_label={watched.name || 'Structure'}
                height={320}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Live preview that updates as you edit the inputs. Drag to orbit,
                scroll to zoom, right-click to pan. Toggle 2D for the classic
                orthographic sketch.
              </p>

              {/* Derived DNV inputs — preview of what the backend will receive */}
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Derived DNV inputs (preview)
                </p>
                <table className="w-full text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="pb-1 text-left">Pt</th>
                      <th className="pb-1 text-right">L (m)</th>
                      <th className="pb-1 text-right">B (m)</th>
                      <th className="pb-1 text-right">h (m)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {Array.from({ length: liftingPoints }, (_, i) => {
                      const p = points[i] ?? { x: 0, y: 0, z: 0 }
                      const cogX = watched.x_cog ?? 0
                      const cogY = watched.y_cog ?? 0
                      const cogZ = watched.z_cog ?? 0
                      const L = Math.abs(p.x - cogX)
                      const B = Math.abs(p.y - cogY)
                      const h = sameHeight ? 0 : p.z - cogZ
                      return (
                        <tr key={i}>
                          <td className="py-0.5 text-left text-muted-foreground">{i + 1}</td>
                          <td className="py-0.5 text-right">{L.toFixed(3)}</td>
                          <td className="py-0.5 text-right">{B.toFixed(3)}</td>
                          <td className="py-0.5 text-right">{h.toFixed(3)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  L/B = horizontal offsets from CoG · h = vertical offset from CoG
                </p>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* ============================================
       *  STEP 3 — Review & Submit
       * ============================================ */}
      {step === 'review' && (
        <section className="card-glass p-6">
          <header className="mb-5 flex items-center gap-2">
            <StepIcon className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Review &amp; Calculate
            </h3>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <dl className="space-y-3">
              <ReviewRow label="Analysis Name" value={watched.name} />
              <ReviewRow
                label={`${ANALYSIS_DISPLAY_LABELS.dryWeight} (kg)`}
                value={watched.maximum_gross_weight}
                mono
              />
              <ReviewRow label="Scenario" value={watched.location} />
              <ReviewRow
                label="Lifting Points"
                value={watched.lifting_points_qty}
                mono
              />
              <ReviewRow label="Crane Height (m)" value={watched.h_max} mono />
              {liftingPoints === 3 && (
                <ReviewRow label="Width Quadrant" value={watched.quadrant ?? '-'} />
              )}
              <ReviewRow
                label="Equal Heights"
                value={watched.same_height ? 'Yes' : 'No'}
              />

              {/* Derived DNV inputs confirm table */}
              <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  DNV geometry inputs
                </p>
                <table className="w-full text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="pb-1 text-left">Pt</th>
                      <th className="pb-1 text-right">L (m)</th>
                      <th className="pb-1 text-right">B (m)</th>
                      <th className="pb-1 text-right">h (m)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {Array.from({ length: liftingPoints }, (_, i) => {
                      const p = points[i] ?? { x: 0, y: 0, z: 0 }
                      const cogX = watched.x_cog ?? 0
                      const cogY = watched.y_cog ?? 0
                      const cogZ = watched.z_cog ?? 0
                      const L = Math.abs(p.x - cogX)
                      const B = Math.abs(p.y - cogY)
                      const h = sameHeight ? 0 : p.z - cogZ
                      return (
                        <tr key={i}>
                          <td className="py-0.5 text-left text-muted-foreground">{i + 1}</td>
                          <td className="py-0.5 text-right">{L.toFixed(3)}</td>
                          <td className="py-0.5 text-right">{B.toFixed(3)}</td>
                          <td className="py-0.5 text-right">{h.toFixed(3)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  L/B = horizontal offsets from CoG · h = vertical offset from CoG
                </p>
              </div>
            </dl>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Final geometry
              </p>
              <GeometryVisualizer
                cog={{ x: watched.x_cog ?? 0, y: watched.y_cog ?? 0, z: watched.z_cog ?? 0 }}
                points={points}
                h_max={watched.h_max}
                lifting_points_qty={watched.lifting_points_qty}
                load_label={watched.name || 'Structure'}
                height={280}
              />
            </div>
          </div>
        </section>
      )}

      {/* ============================================
       *  Footer actions — Back / Cancel / Next / Submit
       * ============================================ */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
        <div>
          {step !== 'basic' && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-md border border-input
                         bg-card px-4 py-2 text-sm font-medium text-foreground
                         hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-input bg-card px-4 py-2 text-sm
                         font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          )}

          {step !== 'review' ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2
                         text-sm font-medium text-primary-foreground
                         hover:bg-primary/90 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Next: {ANALYSIS_FORM_STEPS[ANALYSIS_FORM_STEPS.findIndex((s) => s.id === step) + 1].label}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2
                         text-sm font-semibold text-primary-foreground
                         hover:bg-primary/90 disabled:opacity-50
                         focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {isSubmitting ? 'Calculating…' : submitLabel}
            </button>
          )}
        </div>
      </div>
    </form>

    <PDFCanvasCalibrator
      isOpen={isCalibratorOpen}
      onClose={() => setIsCalibratorOpen(false)}
      onApplyCoordinates={(coords) => {
        setValue('x_cog', coords.x_cog)
        setValue('y_cog', coords.y_cog)
        setValue('z_cog', coords.z_cog)
        coords.points.forEach((p, idx) => {
          setValue(`points.${idx}.x` as const, p.x)
          setValue(`points.${idx}.y` as const, p.y)
          setValue(`points.${idx}.z` as const, p.z)
        })
      }}
      liftingPointsQty={liftingPoints}
      sameHeight={sameHeight}
      initialCoords={{
        x_cog: watched.x_cog ?? 0,
        y_cog: watched.y_cog ?? 0,
        z_cog: watched.z_cog ?? 0,
        points: points,
      }}
    />
  </>
)
}

/* ----------------------------------------------------------------
 *  Small presentational helpers — kept in-file because they're
 *  exclusive to AnalysisForm and benefit from sharing token classes.
 * ---------------------------------------------------------------- */

function ReviewRow({
  label,
  value,
  mono,
}: {
  label: string
  value: unknown
  mono?: boolean
}) {
  const display =
    value === undefined || value === null || value === ''
      ? '—'
      : typeof value === 'boolean'
        ? value
          ? 'Yes'
          : 'No'
        : String(value)
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'text-sm font-medium text-foreground text-right',
          mono && 'font-mono tabular-nums',
        )}
      >
        {display}
      </dd>
    </div>
  )
}

