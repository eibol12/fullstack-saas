import api from '../axios'
import {
  Project,
  ProjectDetail,
  ProjectOverview,
  CreateProjectRequest,
  UpdateProjectRequest
} from '@/types'

/**
 * PROJECTS API ENDPOINTS
 * 
 * CRUD operations for projects
 * 
 * ENDPOINTS:
 * - GET    /api/v1/projects/           List all user projects
 * - POST   /api/v1/projects/           Create new project
 * - GET    /api/v1/projects/:id/       Get project details with analyses
 * - PATCH  /api/v1/projects/:id/       Update project
 * - DELETE /api/v1/projects/:id/       Delete project
 */

export const projectsApi = {
  /**
   * LIST PROJECTS
   * 
   * GET /api/v1/projects/
   * 
   * Returns all projects for the authenticated user
   * Ordered by created_at (newest first)
   */
  getAll: async (): Promise<Project[]> => {
    const { data } = await api.get('/projects/')
    return data
  },

  /**
   * GET PROJECT DETAIL
   * 
   * GET /api/v1/projects/:id/
   * 
   * Returns project with analyses count and list
   */
  getById: async (id: string): Promise<ProjectDetail> => {
    const { data } = await api.get(`/projects/${id}/`)
    return data
  },

  /**
   * CREATE PROJECT
   * 
   * POST /api/v1/projects/
   * 
   * Creates a new project for the authenticated user
   */
  create: async (project: CreateProjectRequest): Promise<Project> => {
    const { data } = await api.post('/projects/', project)
    return data
  },

  /**
   * UPDATE PROJECT
   * 
   * PATCH /api/v1/projects/:id/
   * 
   * Partially updates a project
   */
  update: async (id: string, project: UpdateProjectRequest): Promise<Project> => {
    const { data } = await api.patch(`/projects/${id}/`, project)
    return data
  },

  /**
   * DELETE PROJECT
   * 
   * DELETE /api/v1/projects/:id/
   * 
   * Permanently deletes a project
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}/`)
  },

  /**
   * GET PROJECTS OVERVIEW
   *
   * GET /api/v1/projects/overview/
   *
   * Hierarchical payload powering the centralized dashboard table:
   * every project with its analyses and per-analysis rigging designs
   * already nested in the response.
   */
  getOverview: async (): Promise<ProjectOverview[]> => {
    const { data } = await api.get('/projects/overview/')
    return data
  },
}
