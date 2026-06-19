import { type UseFormRegister } from 'react-hook-form'
import { AnalysisFormData } from '@/types'
import { cn } from '@/lib/utils'

/**
 * Common Tailwind classes — mirror the styling used by AnalysisForm so the
 * inputs look consistent regardless of which page hosts them.
 */
const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'text-foreground placeholder:text-muted-foreground ' +
  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent ' +
  'disabled:bg-muted/50 disabled:text-muted-foreground disabled:cursor-not-allowed'

const labelClass = 'block text-sm font-medium text-foreground mb-1'
const subLabelClass = 'block text-xs font-medium text-muted-foreground mb-1'
const errorClass = 'mt-1 text-xs text-destructive'

interface CornerGeometryFieldsetProps {
  register: UseFormRegister<AnalysisFormData>
  liftingPoints: 1 | 2 | 3 | 4
  sameHeight?: boolean
}

/**
 * CornerGeometryFieldset
 *
 * Renders the corner-reference geometry inputs (skid bounding box, COG
 * coordinates, and per-lifting-point coordinates) as a reusable block so
 * it can be embedded both inside the standalone `AnalysisForm` and the
 * upcoming `ProjectWorkspacePage`. The fieldset is purely presentational —
 * it expects the parent's `useForm()` `register`/`errors` and renders the
 * inputs registered against the shared `AnalysisFormData` schema.
 *
 * All distances are entered in metres, measured from the same physical
 * corner of the skid (e.g. bottom-left front corner). The backend converter
 * (`domain/geometry/corner_to_cog.py`) derives the engine's `L_i/h_i/B_i`
 * from these inputs.
 */
export function CornerGeometryFieldset({
  register,
  liftingPoints,
  sameHeight,
}: CornerGeometryFieldsetProps) {
  return (
    <div className="space-y-5">
      {/* ---------------- Hidden COG coordinates ---------------- */}
      <input type="hidden" {...register('x_cog', { valueAsNumber: true })} />
      <input type="hidden" {...register('y_cog', { valueAsNumber: true })} />
      <input type="hidden" {...register('z_cog', { valueAsNumber: true })} />

      {/* ---------------- Per-point coordinates ---------------- */}
      <fieldset className="rounded-lg border border-border bg-card/60 p-4">
        <legend className="px-2 text-sm font-semibold text-primary tracking-wide">
          Lifting Points (from CoG)
        </legend>
        <p className="text-xs text-muted-foreground mb-3">
          For each lifting point, enter its absolute X/Y/Z position relative to the Centre of Gravity (CoG). Z is the elevation; when “equal heights” is enabled below, the Z fields are disabled and aligned with the COG plane (Z=0).
        </p>
        <div className="space-y-3">
          {Array.from({ length: liftingPoints }, (_, idx) => (
            <div
              key={idx}
              className="rounded-md border border-border/70 bg-background/40 p-3"
            >
              <h4 className={cn(labelClass, 'mb-2')}>
                Lifting Point {idx + 1}
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <NumberCell
                  label={`X${idx + 1} (m)`}
                  {...register(`points.${idx}.x` as const, { valueAsNumber: true })}
                />
                <NumberCell
                  label={`Y${idx + 1} (m)`}
                  {...register(`points.${idx}.y` as const, { valueAsNumber: true })}
                />
                <NumberCell
                  label={`Z${idx + 1} (m)`}
                  disabled={sameHeight}
                  {...register(`points.${idx}.z` as const, { valueAsNumber: true })}
                />
              </div>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

interface NumberCellProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/**
 * Numeric input with a small label and our standard token-driven styling.
 * Forwards every other prop to the underlying `<input>` so it can be used
 * directly with `register(...)`.
 */
const NumberCell = function NumberCellImpl({
  label,
  className,
  error,
  ...props
}: NumberCellProps) {
  return (
    <div>
      <label className={subLabelClass}>{label}</label>
      <input
        type="number"
        step="0.01"
        className={cn(inputClass, 'font-mono tabular-nums', className)}
        {...props}
      />
      {error && <p className={errorClass}>{error}</p>}
    </div>
  )
}
