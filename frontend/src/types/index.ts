// ============================================
// USER & AUTHENTICATION TYPES
// ============================================

/**
 * User model - matches Django User from backend
 * dj-rest-auth returns 'username' instead of separate first/last names
 */
export interface User {
  id: string
  username: string
  email: string
  first_name?: string
  last_name?: string
  profile?: UserProfile
}

export interface UserProfile {
  company: string
  company_logo?: string | null
  company_logo_url?: string | null
  report_prepared_by?: string
}

/**
 * Login API response - returned from POST /api/v1/auth/login/
 * dj-rest-auth format with JWT_AUTH_HTTPONLY=True
 *
 * With JWT_AUTH_HTTPONLY=True the backend intentionally suppresses the refresh
 * token from the JSON body (returns "" or omits it) and instead delivers it as
 * an HttpOnly cookie. The frontend must NOT read or store `refresh` — it is
 * inaccessible to JavaScript by design.
 */
export interface LoginResponse {
  access: string    // JWT access token — stored in localStorage, used as Bearer header
  refresh?: string  // Always "" from backend (HttpOnly cookie); not used by frontend
  user: User        // User profile data
}

/**
 * Register API request body - sent to POST /api/v1/auth/registration/
 * dj-rest-auth expects username, email, password1, password2
 */
export interface RegisterRequest {
  username: string     // dj-rest-auth requires username (can be same as email)
  email: string
  password1: string    // dj-rest-auth uses password1/password2
  password2: string
}

/**
 * Register API response - dj-rest-auth format
 */
export interface RegisterResponse {
  detail?: string
  access?: string
  refresh?: string
  user?: User
}

/**
 * Email verification response
 */
export interface VerifyEmailResponse {
  detail: string
}

/**
 * Email verification request
 */
export interface VerifyEmailRequest {
  key: string
}

/**
 * Resend email verification request
 */
export interface ResendEmailRequest {
  email: string
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string
}

/**
 * Password reset response
 */
export interface PasswordResetResponse {
  detail: string
}

/**
 * Password reset confirm request
 */
export interface PasswordResetConfirmRequest {
  new_password1: string
  new_password2: string
  uid: string
  token: string
}

/**
 * Password change request (for authenticated users)
 */
export interface PasswordChangeRequest {
  old_password: string
  new_password1: string
  new_password2: string
}

/**
 * Password change response
 */
export interface PasswordChangeResponse {
  detail: string
}

// ============================================
// FORM TYPES
// ============================================

/**
 * Login form data (used by react-hook-form)
 */
export interface LoginFormData {
  email: string
  password: string
}

/**
 * Register form data (used by react-hook-form)
 */
export interface RegisterFormData {
  email: string
  password: string
  password_confirm: string  // For frontend validation only
}

/**
 * Forgot password form data
 */
export interface ForgotPasswordFormData {
  email: string
}

/**
 * Reset password form data
 */
export interface ResetPasswordFormData {
  password: string
  password_confirm: string
}

/**
 * Change password form data
 */
export interface ChangePasswordFormData {
  old_password: string
  new_password: string
  new_password_confirm: string
}

// ============================================
// API ERROR TYPES
// ============================================

/**
 * Standard API error response structure
 */
export interface ApiError {
  error?: string
  detail?: string
  non_field_errors?: string[]
  email?: string[]
  password?: string[]
  username?: string[]
  old_password?: string[]
  new_password1?: string[]
  new_password2?: string[]
}

// ============================================
// PROJECT & ANALYSIS TYPES
// ============================================

/**
 * Analysis summary - returned in project details
 */
export interface AnalysisSummary {
  id: string
  name: string
  project_name: string
  maximum_gross_weight: number
  location: string
  lifting_points_qty: number
  created_at: string
  updated_at: string
}

/**
 * Project model - matches backend Project
 */
export interface Project {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

/**
 * Project detail - includes analyses
 */
export interface ProjectDetail extends Project {
  analyses_count: number
  analyses: AnalysisSummary[]
}

/**
 * Compact design row used inside the dashboard overview payload
 * returned by `GET /api/v1/projects/overview/`.
 */
export interface OverviewDesign {
  id: string
  name: string
  version: number
  status: string
  is_active: boolean
  has_report: boolean
  updated_at: string
}

/**
 * Compact analysis row (with its designs) for the dashboard overview.
 */
export interface OverviewAnalysis {
  id: string
  name: string
  location: string
  maximum_gross_weight: number
  lifting_points_qty: number
  updated_at: string
  designs: OverviewDesign[]
}

/**
 * Single row in the centralized projects table on `/dashboard`.
 *
 * Note: `maximum_gross_weight` here is the project's "dry weight"
 * surrogate — the max MGW across the project's analyses, as decided
 * during the engineer-UX refactor (no separate schema field).
 */
export interface ProjectOverview {
  id: string
  name: string
  description: string
  maximum_gross_weight: number | null
  analyses_count: number
  designs_count: number
  created_at: string
  updated_at: string
  analyses: OverviewAnalysis[]
}

/**
 * Project form data (create/update)
 */
export interface ProjectFormData {
  name: string
  description?: string
}

/**
 * Project create request
 */
export interface CreateProjectRequest {
  name: string
  description?: string
}

/**
 * Project update request
 */
export interface UpdateProjectRequest {
  name?: string
  description?: string
}

// ============================================
// LIFTING ANALYSIS TYPES
// ============================================

/**
 * Allowed lifting points quantity (1, 2, 3, or 4)
 */

export type LiftingPointsQuantity = 1 | 2 | 3 | 4


/**
 * Configuration for lifting analysis
 * Based on lifting points quantity (1, 2, 3, or 4)
 */
/**
 * Corner-reference geometry payload sent to the backend's
 * `LiftingAnalysisSerializer.geometry_input` field. The backend converts
 * it into the legacy L/h/B `configuration` shape used by the DNV engine
 * and round-trips the raw payload back under `configuration.geometry_input`
 * so the form can be re-hydrated on edit.
 */
export interface GeometryInput {
  skid: { length: number; width: number; height: number }
  cog: { x: number; y: number; z: number }
  points: Array<{ x: number; y: number; z: number }>
}

export interface DatumGeometryInput {
  cog: { x: number; y: number; z: number }
  points: Array<{ x: number; y: number; z: number }>
  same_height?: boolean
}

export interface LiftingConfiguration {
  h_max: number
  lifting_points_qty?: number
  // Lengths (L1-L4) based on lifting points
  L1?: number
  L2?: number
  L3?: number
  L4?: number
  //Heights (h1-h4) based on lifting points
  h1?: number
  h2?: number
  h3?: number
  h4?: number
  //Widths (B1-B4) based on lifting points
  B1?: number
  B2?: number
  B3?: number
  B4?: number
  //Quadrant for 3-point lifting
  quadrant?: 'center' | 'left' | 'right'
  /**
   * Raw corner-reference payload, round-tripped by the backend so the UI
   * can prefill the form on edit. Present on analyses created/edited
   * through the corner-reference flow.
   */
  geometry_input?: GeometryInput
  /**
   * Raw visual-datum payload, round-tripped by the backend inside the configuration
   * object. Contains absolute coordinates relative to the Visual Datum.
   */
  datum_geometry_input?: DatumGeometryInput
}

/**
 * DNV Calculation Factors
 */
export interface DNVFactors {
  weight_factor: number
  rigging_weight_factor: number
  cog_factor: number
  yaw_factor: number
  skew_load_factor: number
  dynamic_amplification_factor: number
}

/**
 * Static Calculation Results
 */
export interface StaticResults{
  hook_load: number
  static_sling_loads: number[]
  controlling_sling_load?: number
}

/**
 * Dynamic Calculation Results
 */
export interface DynamicResults{
  hook_load: number
  dynamic_sling_loads: number[]
  controlling_sling_load?: number
}

export interface Vector3D {
  x: number
  y: number
  z: number
}

/**
 * Node coordinates for 3D visualization
 */
export interface Node extends Vector3D {}

/**
 * Force componentes
 */
export interface Force extends Vector3D {}

/**
 * Element connecting nodes
 */
export interface Element {
  length: number
  initial_node: Node
  end_node: Node
  internal_force: number
  elastic_modulus: number
  cross_sectional_area: number
}

/**
 * Geometry Structure for Visualization
 */
export interface GeometryStructure{
  nodes: Record<number, Node>
  forces: Record<number, Force>
  elements: Record<number, Element>
  constraints: Record<number, boolean>
}

/**
 * Geometry section of results
 */
export interface Geometry {
  structure: GeometryStructure
}

/**
 * Full analysis results from DNV calculations
 */
export interface AnalysisResults{
  factors: DNVFactors
  static_results: StaticResults
  dynamic_results: DynamicResults
  geometry: Geometry
}

/**
 * Lifting analysis model (full detail)
 */
export interface LiftingAnalysis {
  id: string
  name: string
  project: string
  maximum_gross_weight: number
  location: 'onshore' | 'offshore' | 'inshore' | 'subsea'
  lifting_points_qty: LiftingPointsQuantity
  configuration: LiftingConfiguration
  results: AnalysisResults | null
  created_at: string
  updated_at: string
}

/**
 * Create analysis request
 */
export interface CreateAnalysisRequest {
  name: string
  project_id: string
  maximum_gross_weight: number
  location: 'onshore' | 'offshore' | 'inshore' | 'subsea'
  lifting_points_qty?: LiftingPointsQuantity
  /**
   * Engineering knobs the corner-reference payload doesn't carry (e.g.
   * `h_max`, `quadrant`). The backend derives `L_i/h_i/B_i` from
   * `geometry_input`, merging these knobs in.
   */
  configuration?: Partial<LiftingConfiguration>
  /** Corner-reference geometry payload (preferred). */
  geometry_input?: GeometryInput
}

/**
 * Update analysis request
 */
export interface UpdateAnalysisRequest {
  name?: string
  maximum_gross_weight?: number
  location?: 'onshore' | 'offshore' | 'inshore' | 'subsea'
  lifting_points_qty?: LiftingPointsQuantity
  configuration?: Partial<LiftingConfiguration>
  geometry_input?: GeometryInput
}

/**
 * Analysis form data — corner-reference geometry model.
 *
 * Engineers enter skid dimensions, COG and lifting-point positions as
 * absolute coordinates from a single corner of the skid (the only data
 * they reliably have without CAD). The form derives `L_i/h_i/B_i`
 * locally for the live preview, but the submitted payload is the raw
 * `geometry_input` block.
 */
export interface AnalysisFormData {
  name: string
  maximum_gross_weight: number
  location: 'onshore' | 'offshore' | 'inshore' | 'subsea'
  lifting_points_qty: LiftingPointsQuantity
  /** Maximum crane height above the lowest lifting point (m). */
  h_max: number
  /** COG coordinates measured from the visual datum reference origin (m). */
  x_cog: number
  y_cog: number
  z_cog: number
  /**
   * Per-lifting-point coordinates from the visual datum reference origin (m). Always 4
   * slots — only the first `lifting_points_qty` are read on submit so
   * users can switch counts without losing data.
   */
  points: Array<{ x: number; y: number; z: number }>
  /** Quadrant for 3-point lifting (engine knob). */
  quadrant?: 'center' | 'left' | 'right'
  /** Equal heights toggle — forces every point z to match the COG plane. */
  same_height?: boolean
}

//////////////////////////////////////////////////
// RIGGING DESIGN TYPES
//////////////////////////////////////////////////

export type SlingLengths = number[]
export type SlingLoads = number[]

/**
 * Counts for Rigging Design Summary
 */
export interface RiggingDesignSummaryCounts {
  compliant: number
  compatible: number
  compliant_no_wire: number
}

/**
 * Targets for Rigging Design Summary
 */
export interface RiggingDesignSummaryTargets {
  user: number
  minimum: number
  conservative: number
}

/**
 * Rigging design summary
 */
export interface DesignResultsSummary {
  counts: RiggingDesignSummaryCounts
  targets: RiggingDesignSummaryTargets
  lifting_points_qty: LiftingPointsQuantity
}

/**
 * Rigging Design Components
 */
export type RiggingComponentType =
    |'Masterlink'
    |'MasterlinkAssembly'
    |'WireRope'
    |'Shackle'

/**
 * Arrangement for Rigging Design
 */
export type RiggingArrangement = RiggingComponentType[]

/**
 * Wire Rope Types
 */
export type WireRopeEyeType =
  | 'hard'
  | 'soft'
export type WireRopeTermination =
  | 'ferrule'
  | 'socket'
  | 'mechanical'
export type WireRopeConfiguration =
  | 'vertical'
  | 'basket'
  | 'choke'

/**
 * User Preference for a given component
 */
export interface UserPreference {
  component_type?: RiggingComponentType

  capacity?: number
  model?: string
  manufacturer?: string

  eye_type?: WireRopeEyeType
  termination?: WireRopeTermination
  configuration?: WireRopeConfiguration
}

/**
 * User Preferences for Rigging Design
 */
export type UserPreferences = UserPreference[] | null

/**
 * Model with manufacturer metadata
 * Backend returns models as objects with manufacturer for non-WireRope components
 * This enables filtering models by manufacturer and auto-filling manufacturer from model
 */
export interface ModelWithManufacturer {
  model: string
  manufacturer: string
}

export interface ComponentFieldOptions {
  manufacturers: string[]
  models: ModelWithManufacturer[] | string[]  // Objects for Shackle/Masterlink/MasterlinkAssembly, empty array for WireRope
  capacities: number[]
  eye_types: string[]
  terminations: string[]
  configurations: string[]
}

export interface ComponentOptions {
  Shackle: ComponentFieldOptions
   Masterlink: ComponentFieldOptions
   MasterlinkAssembly: ComponentFieldOptions
   WireRope: ComponentFieldOptions
}


/**
 *
 *
 * Units for Rigging Design
 */
export interface Units {
  load: string
  ratio: string
  factor: string
  diameter: string
  utilization: string
}

/**
 * Calculation context for Rigging Design
 */
export interface CalculationContext {
  units: Units
  static: StaticResults
  dynamic: DynamicResults
  arrangement: RiggingArrangement
  dnv_factors: DNVFactors
  trace_version: string
  min_safety_factor: number
}

export type CombinationKey = 'minimum' | 'conservative' | 'user_specified'

export interface CombinationItemBase {
  label: string | null
  position: number
  utilization: number
  component_id: string
  user_capacity: number | null
  component_type: RiggingComponentType
  // Enriched fields from mapper
  manufacturer?: string | null
  model?: string | null
  wll_or_mbl?: number | null
  sling_length?: number | null
}

export interface WireRopeCombinationItem extends CombinationItemBase {
  component_type: 'WireRope'
  thimble: string | null
  eye_type: WireRopeEyeType | string | null
  termination: WireRopeTermination | string | null
  configuration: WireRopeConfiguration | string | null
  diameter?: number | null
}

export type CombinationItem = CombinationItemBase | WireRopeCombinationItem

/**
 * Trace building blocks
 */
export interface TraceEntry<T = unknown> {
  eqn: string | null
  note: string | null
  unit: string | null
  value: T
  source: string | null
}

export interface ComponentTraceMeta {
  position: number
  component_id: string
  trace_version: string
  component_type: RiggingComponentType
}

export interface ComponentTrace {
  meta: ComponentTraceMeta

  //UR1/UR2/UR3 etc. Keys are dynamic
  checks: Record<string, TraceEntry<number>>

  //Keys are dyanmic; values can be string/number/etc.
  inputs: Record<string, TraceEntry<unknown>>
  factors: Record<string, TraceEntry<unknown>>

  results: {
    utilization: TraceEntry<number>
    controlling_check?: string
  }

  intermediates: Record<string, TraceEntry>
  references: unknown[]
}

export interface ComponentFactorBase {
  component_type: RiggingComponentType
  utilization_ratio: number
  minimum_breaking_load: number
}

export interface RatedHardwareFactor extends ComponentFactorBase {
  component_type: Exclude<RiggingComponentType, "WireRope">
  proof_load: number
  working_load_limit: number
  safety_working_load: number

  utilization_ratio_1: number
  utilization_ratio_2: number
  utilization_ratio_3: number

  minimum_safety_factor: number
  manufacturer_safety_factor: number
  dynamic_amplification_factor: number
}

export interface WireRopeFactor extends ComponentFactorBase {
  component_type: 'WireRope'

  eye_type: WireRopeEyeType
  termination: WireRopeTermination
  configuration: WireRopeConfiguration

  wear_factor: number
  config_factor: number
  bending_factor: number
  termination_factor: number
  material_factor: number
  lifting_factor: number
  consequence_factor: number

  effective_mbl: number
  wire_diameter: number

  before_component_id: number
  before_component_type: RiggingComponentType
  after_component_id: number
  after_component_type: RiggingComponentType

  nominal_safety_factor: number

  minimum_bending_diameter: number
  eye_bending_reduction_factor: number
  configuration_bending_reduction_factor: number
}

export type ComponentFactors = RatedHardwareFactor | WireRopeFactor

export type CompatibilityRefType = "Thimble" | "SlingConfiguration"

export interface CompatibilityRef<T extends CompatibilityRefType = CompatibilityRefType> {
  id: string
  type: T
}

export interface CompatibilityComponentDictBase {
  utilization: number
  component_id: string
  component_type: RiggingComponentType
}

export interface CompatibilityWireRopeDict extends CompatibilityComponentDictBase {
  component_type: 'WireRope'
  thimble?: CompatibilityRef<"Thimble"> | null
  configuration?: CompatibilityRef<"SlingConfiguration"> | null
}

export type CompatibilityComponentDict =
  | CompatibilityWireRopeDict
  | (CompatibilityComponentDictBase & { component_type: Exclude<RiggingComponentType, "WireRope"> })

export interface CompatibilityDetail {
  reason: string | null
  compatible: boolean
  first_component_dict: CompatibilityComponentDict
  second_component_dict: CompatibilityComponentDict
}

/**
 * Optimal Combinations for Rigging Design
 */
export interface OptimalCombination {
  id: string[]
  items: CombinationItem[]
  warning_message: string | null
  component_traces: ComponentTrace[]
  component_factors: ComponentFactors[]
  geometric_warning: string | null
  overall_compatible: boolean
  compatibility_details: CompatibilityDetail[]
}

export interface OptimalCombinations {
  minimum: OptimalCombination | null
  conservative: OptimalCombination | null
  user_specified: OptimalCombination | null
}

/**
 * Results for Rigging Design
 */
export interface RiggingDesignResults {
  factors: DNVFactors
  summary: DesignResultsSummary
  arrangement: RiggingArrangement
  sling_lengths: SlingLengths
  user_preferences: UserPreferences
  calculation_context: CalculationContext
  optimal_combinations: OptimalCombinations
}

/**
 * Rigging Design
 */

export interface RiggingDesign {
  id: string
  name: string
  analysis: { id: string; name: string } | null
  project: { id: string; name: string } | null
  created_at: string
  updated_at: string
  status: string
  version: number
  is_active: boolean
  arrangement: RiggingArrangement
  results: RiggingDesignResults | null
}

/**
 * Create Design Request
 */
export interface CreateDesignRequest {
  name: string
  set_active: boolean
  analysis_id: string
  user_preferences?: UserPreferences
}

/**
 * PATCH payload for `/api/v1/design/:id/`.
 *
 * - Sending only metadata fields (`name`, `status`, `is_active`) keeps the
 *   row's `arrangement`/`results` untouched.
 * - Sending `user_preferences` triggers an in-place recompute on the
 *   same row (`RiggingDesignService.recompute_design`), preserving `id`,
 *   `version`, and the FK to the parent analysis.
 */
export interface UpdateDesignRequest {
  name?: string
  status?: string
  is_active?: boolean
  user_preferences?: UserPreferences
}

export interface DesignFormData {
  name: string
  set_active: boolean
  user_preferences?: UserPreferences
}

export type UUID = string
export type DesignStatus =
  | 'draft'
  | 'final'
  | string

export interface RiggingDesignSummary {
  id: UUID
  analysis_id: UUID | null
  analysis_name: string | null
  project_id: UUID

  name: string
  version: number
  status: DesignStatus
  is_active: boolean

  created_at: string
  updated_at: string
}
