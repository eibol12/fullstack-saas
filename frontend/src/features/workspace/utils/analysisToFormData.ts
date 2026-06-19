import { AnalysisFormData, LiftingAnalysis, LiftingPointsQuantity } from '@/types'

/**
 * Convert a persisted `LiftingAnalysis` into the absolute visual datum
 * `AnalysisFormData` shape expected by `<AnalysisForm initialData>`.
 *
 * The frontend stores the absolute visual-datum coordinate inputs under
 * `configuration.datum_geometry_input`. If present, we re-hydrate the form
 * using these absolute values.
 *
 * For backward compatibility:
 * - If `datum_geometry_input` is missing but `geometry_input` is present
 *   (from the older corner-reference model), we use it as a fallback.
 * - Otherwise, values default to zero.
 */
export function analysisToFormData(
  analysis: LiftingAnalysis | undefined | null,
): Partial<AnalysisFormData> | undefined {
  if (!analysis) return undefined

  const cfg = analysis.configuration ?? {}
  const datum = cfg.datum_geometry_input || cfg.geometry_input
  const qty = (analysis.lifting_points_qty ?? cfg.lifting_points_qty ?? 2) as LiftingPointsQuantity

  // Pad/normalise to exactly 4 slots; the form always keeps a fixed array
  // so users can switch lifting-point counts without losing entered data.
  const points = [0, 1, 2, 3].map((i) => ({
    x: datum?.points?.[i]?.x ?? 0,
    y: datum?.points?.[i]?.y ?? 0,
    z: datum?.points?.[i]?.z ?? 0,
  }))

  return {
    name: analysis.name,
    maximum_gross_weight: analysis.maximum_gross_weight,
    location: analysis.location,
    lifting_points_qty: qty,
    h_max: cfg.h_max ?? 1,
    x_cog: datum?.cog?.x ?? 0,
    y_cog: datum?.cog?.y ?? 0,
    z_cog: datum?.cog?.z ?? 0,
    points,
    quadrant: cfg.quadrant,
    same_height: cfg.datum_geometry_input?.same_height ?? false,
  }
}
