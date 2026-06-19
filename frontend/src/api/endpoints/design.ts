import api from '../axios'
import {
    RiggingDesignSummary,
    CreateDesignRequest,
    UpdateDesignRequest,
    RiggingDesign,
    ComponentOptions
} from '@/types'
import { sanitizeUserPreferences } from '@/lib/sanitize'
import { DesignReportPayload } from '@/types/report'

/**
 * RIGGING DESIGN API ENDPOINTS
 *
 * CRUD operations for rigging designs
 *
 * ENDPOINTS:
 * - GET    /api/v1/design/             List all user designs (optional filtering by analysis_id or project_id)
 * - POST   /api/v1/design/             Create a new design from existing analysis
 * - GET    /api/v1/design/:id/          Retrieve a specific design by ID
 * - PATCH    /api/v1/design/:id/          Update a specific design name by ID
 * - DELETE /api/v1/design/:id/          Delete a specific design by ID
 */

export const riggingDesignApi = {
    /**
     * LIST DESIGNS
     *
     * GET /api/v1/design/
     * Optional query param: analysis_id, project_id
     *
     * Returns all designs for the authenticated user
     * Can be filtered by project_id or analysis_id
     */
    getAll: async (projectId?: string, analysisId?: string): Promise<RiggingDesignSummary[]> => {
        const params: Record<string, string> = {}
        if (projectId) {
            params.project_id = projectId
        }
        if (analysisId) {
            params.analysis_id = analysisId
        }
        const {data} = await api.get('/design/', {params})
        return data
    },
    /**
   * GET DESIGN DETAIL
   *
   * GET /api/v1/design/:id/
   *
   * Returns rigging design
   */
    getById: async (id: string): Promise<RiggingDesign> => {
        const {data} = await api.get(`/design/${id}/`)
        return data
    },

    getReport: async (id: string, selectedKey?: string): Promise<DesignReportPayload> => {
        const params = selectedKey ? { selected_key: selectedKey } : undefined
        const { data } = await api.get(`/design/${id}/report/`, { params })
        return data
    },
    /**
     * CREATE RIGGING DESIGN
     *
     * POST /api/v1/design/
     *
     * Create a new rigging design for a specific analysis
     * Returns a rigging design from specific analysis results
     *
     * NOTE: Sanitizes user_preferences to remove empty strings before submission
     */

    create: async (design: CreateDesignRequest): Promise<RiggingDesign> => {
        // Sanitize user preferences to remove empty strings, null, and undefined values
        // This prevents validation errors on backend for optional fields like capacity (FloatField)
        const sanitizedDesign = {
            ...design,
            user_preferences: sanitizeUserPreferences(design.user_preferences)
        }

        const {data} = await api.post('/design/', sanitizedDesign)
        return data
    },

    /**
     * UPDATE DESIGN NAME
     *
     * PATCH /api/v1/design/:id/
     *
     * Update a specific design name by ID
     */
    update: async (id: string, design: UpdateDesignRequest): Promise<RiggingDesign> => {
        // Strip empty/null prefs so optional knobs (e.g. capacity FloatField)
        // don't fail backend validation; presence of `user_preferences` on the
        // payload triggers an in-place recompute on the same row.
        const payload = design.user_preferences
            ? { ...design, user_preferences: sanitizeUserPreferences(design.user_preferences) }
            : design
        const {data} = await api.patch(`/design/${id}/`, payload)
        return data
    },

    /**
     * DELETE DESIGN
     *
     * DELETE /api/v1/design/:id
     *
     * Permanently deletes a design
     */
    delete: async (id:string): Promise<void> => {
        await api.delete(`/design/${id}/`)
    },

    getComponentOptions: async (): Promise<ComponentOptions> => {
    const {data} = await api.get('/design/component-options/')
    return data
    }
}
