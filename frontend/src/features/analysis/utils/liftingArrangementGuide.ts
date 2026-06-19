import { getApiUrl } from '@/lib/utils'

export type LiftingPointsQuantity = 1 | 2 | 3 | 4

export interface LiftingArrangementGuide {
  title: string
  imageUrl: string
  alt: string
}

// Mirrors the backend report preview mapping in
// backend/apps/main/services/rigging_report_preview.py so the form stays
// aligned with the existing arrangement sketches.
const LIFTING_ARRANGEMENT_SKETCH_PATHS: Record<LiftingPointsQuantity, string> = {
  1: 'images/lifting_arrangements/one_point_lifting_sketch.jpg',
  2: 'images/lifting_arrangements/two_point_lifting_sketch.jpg',
  3: 'images/lifting_arrangements/three_point_lifting_sketch.jpg',
  4: 'images/lifting_arrangements/four_point_lifting_sketch.jpg',
}

function buildStaticAssetUrl(path: string): string {
  const apiUrl = getApiUrl()
  const normalizedBaseUrl = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`

  return new URL(`/static/${path}`, normalizedBaseUrl).toString()
}

export function getLiftingArrangementGuide(
  liftingPointsQty?: number | null,
): LiftingArrangementGuide | null {
  const sketchPath = LIFTING_ARRANGEMENT_SKETCH_PATHS[liftingPointsQty as LiftingPointsQuantity]

  if (!sketchPath) {
    return null
  }

  return {
    title: `${liftingPointsQty}-point lifting arrangement`,
    imageUrl: buildStaticAssetUrl(sketchPath),
    alt: `${liftingPointsQty}-point lifting arrangement reference sketch`,
  }
}
