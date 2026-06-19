import { buildAnalysisCreatePayload } from '../buildAnalysisCreatePayload'
import { analysisToFormData } from '../../../workspace/utils/analysisToFormData'
import { AnalysisFormData, LiftingAnalysis } from '@/types'

// Mocking Vite environment for tests if run directly
describe('Rigging Geometry Translation Math', () => {
  const mockFormData: AnalysisFormData = {
    name: 'Test Manifold Lift',
    maximum_gross_weight: 12000,
    location: 'offshore',
    lifting_points_qty: 4,
    h_max: 8.0,
    x_cog: 3.5,
    y_cog: 1.5,
    z_cog: 0.5,
    points: [
      { x: 1.0, y: 0.5, z: 0.5 },
      { x: 6.0, y: 0.5, z: 0.5 },
      { x: 6.0, y: 2.5, z: 0.5 },
      { x: 1.0, y: 2.5, z: 0.5 },
    ],
    quadrant: 'left',
    same_height: true,
  }

  test('buildAnalysisCreatePayload correctly transforms absolute coordinates to relative offsets', () => {
    const payload = buildAnalysisCreatePayload(mockFormData, 'test-project-uuid')

    expect(payload.name).toBe('Test Manifold Lift')
    expect(payload.project_id).toBe('test-project-uuid')
    expect(payload.maximum_gross_weight).toBe(12000)
    
    const cfg = payload.configuration!
    expect(cfg.h_max).toBe(8.0)
    expect(cfg.lifting_points_qty).toBe(4)
    
    // Check vector subtractions: L_i = |x_i - x_cog|, B_i = |y_i - y_cog|
    // Point 1: L1 = |1.0 - 3.5| = 2.5, B1 = |0.5 - 1.5| = 1.0, h1 = 0 (same_height true)
    expect(cfg.L1).toBe(2.5)
    expect(cfg.B1).toBe(1.0)
    expect(cfg.h1).toBe(0)

    // Point 2: L2 = |6.0 - 3.5| = 2.5, B2 = |0.5 - 1.5| = 1.0, h2 = 0
    expect(cfg.L2).toBe(2.5)
    expect(cfg.B2).toBe(1.0)

    // Verify absolute visual datum coordinates are stored in the configuration payload
    expect(cfg.datum_geometry_input).toBeDefined()
    expect(cfg.datum_geometry_input?.cog).toEqual({ x: 3.5, y: 1.5, z: 0.5 })
    expect(cfg.datum_geometry_input?.points[0]).toEqual({ x: 1.0, y: 0.5, z: 0.5 })
  })

  test('analysisToFormData re-hydrates form accurately from configuration.datum_geometry_input', () => {
    const mockAnalysis: LiftingAnalysis = {
      id: 'analysis-uuid',
      name: 'Test Manifold Lift',
      project: 'test-project-uuid',
      maximum_gross_weight: 12000,
      location: 'offshore',
      lifting_points_qty: 4,
      configuration: {
        h_max: 8.0,
        lifting_points_qty: 4,
        L1: 2.5, B1: 1.0, h1: 0,
        L2: 2.5, B2: 1.0, h2: 0,
        L3: 2.5, B3: 1.0, h3: 0,
        L4: 2.5, B4: 1.0, h4: 0,
        datum_geometry_input: {
          cog: { x: 3.5, y: 1.5, z: 0.5 },
          points: [
            { x: 1.0, y: 0.5, z: 0.5 },
            { x: 6.0, y: 0.5, z: 0.5 },
            { x: 6.0, y: 2.5, z: 0.5 },
            { x: 1.0, y: 2.5, z: 0.5 },
          ],
          same_height: true,
        }
      },
      results: null,
      created_at: '2026-05-25T10:00:00Z',
      updated_at: '2026-05-25T10:00:00Z',
    }

    const formData = analysisToFormData(mockAnalysis)
    
    expect(formData).toBeDefined()
    expect(formData?.name).toBe('Test Manifold Lift')
    expect(formData?.x_cog).toBe(3.5)
    expect(formData?.y_cog).toBe(1.5)
    expect(formData?.z_cog).toBe(0.5)
    expect(formData?.same_height).toBe(true)
    expect(formData?.points).toHaveLength(4)
    expect(formData?.points![0]).toEqual({ x: 1.0, y: 0.5, z: 0.5 })
    expect(formData?.points![2]).toEqual({ x: 6.0, y: 2.5, z: 0.5 })
  })

  test('analysisToFormData falls back to geometry_input for legacy corner-reference cases', () => {
    const legacyAnalysis: LiftingAnalysis = {
      id: 'analysis-uuid',
      name: 'Legacy Lift',
      project: 'test-project',
      maximum_gross_weight: 8000,
      location: 'onshore',
      lifting_points_qty: 2,
      configuration: {
        h_max: 6.0,
        lifting_points_qty: 2,
        L1: 2.0, B1: 0, h1: 0,
        L2: 2.0, B2: 0, h2: 0,
        geometry_input: {
          skid: { length: 5.0, width: 2.0, height: 1.5 },
          cog: { x: 2.5, y: 1.0, z: 0.0 },
          points: [
            { x: 0.5, y: 1.0, z: 0.0 },
            { x: 4.5, y: 1.0, z: 0.0 },
          ],
        }
      },
      results: null,
      created_at: '2026-05-25T10:00:00Z',
      updated_at: '2026-05-25T10:00:00Z',
    }

    const formData = analysisToFormData(legacyAnalysis)

    expect(formData).toBeDefined()
    expect(formData?.name).toBe('Legacy Lift')
    expect(formData?.x_cog).toBe(2.5)
    expect(formData?.y_cog).toBe(1.0)
    expect(formData?.z_cog).toBe(0.0)
    expect(formData?.points![0]).toEqual({ x: 0.5, y: 1.0, z: 0.0 })
    expect(formData?.points![1]).toEqual({ x: 4.5, y: 1.0, z: 0.0 })
  })
})

// Helper mock functions to satisfy Jest types globally
declare var describe: any
declare var test: any
declare var expect: any
