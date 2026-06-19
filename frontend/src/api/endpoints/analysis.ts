import api from '../axios'
import {
  LiftingAnalysis,
  AnalysisSummary,
  CreateAnalysisRequest,
  UpdateAnalysisRequest
} from '@/types'

/**
 * ANALYSIS API ENDPOINTS
 * 
 * CRUD operations for lifting analyses
 * 
 * ENDPOINTS:
 * - GET    /api/v1/analysis/                List all user analyses (optional ?project_id filter)
 * - POST   /api/v1/analysis/                Create new analysis (runs DNV calculations)
 * - GET    /api/v1/analysis/:id/            Get analysis details with results
 * - PATCH  /api/v1/analysis/:id/            Update analysis (re-runs calculations if needed)
 * - DELETE /api/v1/analysis/:id/            Delete analysis
 */

export const analysisApi = {
  /**
   * LIST ANALYSES
   * 
   * GET /api/v1/analysis/
   * Optional query param: ?project_id=xxx
   * 
   * Returns all analyses for the authenticated user
   * Can be filtered by project_id
   */
  getAll: async (projectId?: string): Promise<AnalysisSummary[]> => {
    const params = projectId ? { project_id: projectId } : {}
    const { data } = await api.get('/analysis/', { params })
    return data
  },

  /**
   * GET ANALYSIS DETAIL
   * 
   * GET /api/v1/analysis/:id/
   * 
   * Returns analysis with full configuration and calculation results
   */
  getById: async (id: string): Promise<LiftingAnalysis> => {
    const { data } = await api.get(`/analysis/${id}/`)
    return data
  },

  /**
   * CREATE ANALYSIS
   * 
   * POST /api/v1/analysis/
   * 
   * Creates a new analysis and runs DNV lifting calculations
   * Returns analysis with calculated results
   */
  create: async (analysis: CreateAnalysisRequest): Promise<LiftingAnalysis> => {
    const { data } = await api.post('/analysis/', analysis)
    return data
  },

  /**
   * UPDATE ANALYSIS
   * 
   * PATCH /api/v1/analysis/:id/
   * 
   * Updates analysis and re-runs calculations if weight/config changed
   */
  update: async (id: string, analysis: UpdateAnalysisRequest): Promise<LiftingAnalysis> => {
    const { data } = await api.patch(`/analysis/${id}/`, analysis)
    return data
  },

  /**
   * DELETE ANALYSIS
   * 
   * DELETE /api/v1/analysis/:id/
   * 
   * Permanently deletes an analysis
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/analysis/${id}/`)
  },
}
