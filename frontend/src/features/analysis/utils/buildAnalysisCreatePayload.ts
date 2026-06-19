import {
  AnalysisFormData,
  CreateAnalysisRequest,
  LiftingConfiguration,
} from '@/types'

/**
 * Builds the backend-ready `CreateAnalysisRequest` from the absolute Visual Datum
 * `AnalysisFormData`.
 *
 * Responsibilities:
 * - Performs vector subtraction (Lug - CoG) in the horizontal and vertical directions.
 * - populates L_i, B_i, h_i in the `configuration` payload.
 * - Stores the absolute visual datum coordinate inputs under `configuration.datum_geometry_input`
 *   to allow perfect re-hydration on edit.
 * - Omit the outer `geometry_input` to bypass backend validators that require skid dimensions.
 */
export function buildAnalysisCreatePayload(
  formData: AnalysisFormData,
  projectId: string,
): CreateAnalysisRequest {
  const { name, maximum_gross_weight, location, lifting_points_qty } = formData

  const cogX = formData.x_cog
  const cogY = formData.y_cog
  const cogZ = formData.z_cog

  // Build the relative configurations for DNV engine
  const configuration: Record<string, any> = {
    h_max: formData.h_max,
    lifting_points_qty,
    datum_geometry_input: {
      cog: { x: cogX, y: cogY, z: cogZ },
      points: (formData.points ?? []).slice(0, lifting_points_qty).map((p) => ({
        x: p?.x ?? 0,
        y: p?.y ?? 0,
        z: formData.same_height ? cogZ : (p?.z ?? 0),
      })),
      same_height: formData.same_height,
    },
  }

  if (lifting_points_qty === 3 && formData.quadrant) {
    configuration.quadrant = formData.quadrant
  }

  // Populate relative L_i, B_i, h_i for DNV calculations
  for (let i = 0; i < lifting_points_qty; i++) {
    const p = formData.points[i]
    configuration[`L${i + 1}`] = Math.abs((p?.x ?? 0) - cogX)
    configuration[`B${i + 1}`] = Math.abs((p?.y ?? 0) - cogY)
    configuration[`h${i + 1}`] = formData.same_height ? 0 : ((p?.z ?? 0) - cogZ)
  }

  return {
    name,
    project_id: projectId,
    maximum_gross_weight,
    location,
    lifting_points_qty,
    configuration: configuration as LiftingConfiguration,
  }
}
