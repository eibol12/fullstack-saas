# Grispen Rigging SaaS — In-Depth Backend & Domain Codebase Dictionary

This section provides a file-by-file and directory-by-directory breakdown of the `backend/` and `backend/domain/` layers. It describes the purpose, classes, functions, methods, parameters, and role of each component in the application workflow, as well as how they send, receive, and process data.

---

## 🗂️ Directory & File Index

### 1. Framework-Agnostic Domain Layer (`backend/domain/`)

The pure engineering calculations and business rule validation are isolated from any database drivers, HTTP protocols, or external frameworks.

#### 📁 `domain/saas/`
Manages the SaaS tier policies, limitations, and usage contexts.
*   **`constants.py`**:
    *   **Role**: Contains hardcoded pricing structures, tier features, limits, and pricing metadata.
    *   **Key Constants**:
        *   `TIER_LIMITS`: Nested dictionary mapping tier keys (`free`, `starter`, `pro`) to resource limits (e.g. `max_projects`, `max_analyses_per_project`, `max_designs_per_analysis`, `pdf_export_allowed`, `api_keys_allowed`).
        *   `TIER_PLANS`: Stripe product mappings, feature lists, and branding intervals.
*   **`types.py`**:
    *   **Role**: Defines data types and context blocks.
    *   **Classes**:
        *   `Tier` (Enum): Defines the allowed billing tiers: `FREE = "free"`, `STARTER = "starter"`, `PRO = "pro"`.
        *   `UserTierContext` (Dataclass): Data Transfer Object containing `user_id` (UUID/int), `tier` (Tier enum), `is_active` (bool), `active_project_count` (int), `max_analyses_in_any_project` (int), and `max_designs_in_any_analysis` (int). Used to pass usage contexts into validation policies.
*   **`tier_policy.py`**:
    *   **Role**: Enforces limits based on subscription statuses.
    *   **Classes**:
        *   `TierPolicy`: Contains static methods checking capability thresholds.
            *   `_get_tier_limits(tier: str) -> Dict`: Resolves limits, defaulting to the `FREE` tier if unspecified.
            *   `can_create_project(context: UserTierContext) -> Tuple[bool, int, Optional[int], str]`: Checks if the user's project count is within bounds. Returns `(allowed, current_count, limit, message)`.
            *   `can_create_analysis(context: UserTierContext, current_project_analysis_count: int) -> Tuple[bool, int, Optional[int], str]`: Checks if the analysis count inside a project stays below the tier limit.
            *   `can_create_design(context: UserTierContext, current_analysis_design_count: int) -> Tuple[bool, int, Optional[int], str]`: Checks if the design count for an analysis stays below the tier limit.
            *   `can_export_pdf(context: UserTierContext) -> Tuple[bool, str]`: Checks if the user is allowed to export PDFs (disabled for Free tier).
            *   `can_use_api(context: UserTierContext) -> Tuple[bool, str]`: Checks if the user is allowed external API access (Pro tier only).
            *   `get_user_limits(context: UserTierContext) -> Dict`: Returns a dictionary mapping all limitations for user dashboard queries.
            *   `check_limit(context: UserTierContext, resource_type: str, **kwargs) -> Tuple[bool, Dict]`: Unified limit checking method that routes to specific resource verification functions.
*   **`usage_tracker.py`**:
    *   **Role**: Placeholder file for tracking resource usage patterns.

#### 📁 `domain/standards/`
Houses international standard calculations and compliance equations.
*   **`dnv.py`**:
    *   **Role**: Performs marine lifting calculations based on DNV codes (such as DNV-ST-0378).
    *   **Classes**:
        *   `DNVLiftingOperations` (inherits from `StructureObserver`): Implements the observer pattern to compute structural forces and safety factors.
            *   `__init__(maximum_gross_weight, location, configuration)`: Initializes the lifting system. Receives coordinates and establishes crane hook coordinates at origin `(0, 0, 0)`.
            *   `update(structure, event_data)`: Resets calculations if structural elements are modified.
            *   `analyze() -> Dict`: Computes weights, Dynamic Amplification Factors (DAF), skew load factors, assemblies load distribution, and runs finite element stiffness solver through `LiftingCalculator`. Returns static/dynamic sling load distributions.
            *   `_initialize_daf_map()`: Maps DNV DAF values based on gross weight classes and operational environments (inshore/offshore/subsea).
            *   `_get_hook_load_class(shl: float) -> int`: Determines the DNV Hook Load Class (1 to 5) based on Hook Load.
            *   `_build_lifting_configuration()`: Sets up the nodes and element wires inside `LiftingCalculator`.
            *   `to_dict() -> Dict`: Returns the factors and calculations in a serialized structure.

#### 📁 `domain/geometry/`
Manages coordinate geometry, vectors, and nodes.
*   **`node.py`**:
    *   **Role**: Defines a structural coordinate point in 3D space.
    *   **Classes**:
        *   `Node3D`: Models the Cartesian coordinate points `(x, y, z)`.
            *   `__init__(x, y, z)`: Validates that inputs are real numbers.
            *   `distance_to(other: Node3D) -> float`: Calculates Euclidean distance.
            *   `dot_product(other: Node3D) -> float`: Computes dot product.
            *   `cross_product(other: Node3D) -> Node3D`: Computes cross product vector.
            *   `magnitude() -> float`: Returns length from origin.
            *   `normalize() -> Node3D`: Returns unit vector. Raises `ValueError` for zero-magnitude vectors.
            *   `to_dict() / from_dict(data)`: Serializes/deserializes coordinates.
            *   `__add__ / __sub__`: Operator overrides for vector arithmetic.
*   **`element.py`**:
    *   **Role**: Models structural segments (such as wire rope lines) connecting two nodes.
    *   **Classes**:
        *   `Element3D`: Connects an initial and end `Node3D` with mechanical properties.
            *   `__init__(initial_node, end_node, elastic_modulus, cross_sectional_area)`: Validates that inputs are positive numbers.
            *   `length() -> float`: Computes Euclidean distance between nodes.
            *   `local_stiffness_matrix() -> np.ndarray`: Assembles element stiffness.
            *   `transformation_matrix() -> np.ndarray`: Converts local forces to global coordinate vectors.
            *   `set_global_displacement_vector(vector, dofs)`: Assigns displacements.
            *   `internal_force() -> float`: Calculates tensile/compressive internal forces.
*   **`collections.py`**:
    *   **Role**: Custom order-preserving dictionaries with spatial index queries.
    *   **Classes**:
        *   `IndexedDict`: Custom dictionary preserving insertion order and generating unique IDs.
        *   `Node3DDict` (inherits from `IndexedDict`): Specialized map for nodes.
            *   `find_closest_node(x, y, z) -> Tuple[str, Node3D, float]`: Finds node closest to input coordinate coordinates.
            *   `nodes_within_radius(x, y, z, radius) -> List[Tuple[str, Node3D]]`: Returns nodes in radial zone.
            *   `get_bounding_box() -> Tuple[Node3D, Node3D]`: Computes min/max boundary box.
        *   `Element3DDict` (inherits from `IndexedDict`): Specialized map for elements.
            *   `find_by_nodes(initial_node, end_node) -> Tuple[str, Element3D]`: Matches elements connecting two nodes.
            *   `get_elements_with_node(node) -> List[Tuple[str, Element3D]]`: Finds elements connected to a node.
*   **`corner_to_cog.py`**:
    *   **Role**: Converts skid measurements relative to a physical corner into COG-relative offsets.
    *   **Functions**:
        *   `convert_corner_coords_to_cog_config(geometry_input: Dict) -> Dict`: Receives dimensions relative to a physical corner and returns COG-relative dimensions configuration ($L_i$, $B_i$, $h_i$) for the solver.

#### 📁 `domain/lifting/`
*   **`validation.py`**:
    *   **Role**: Form-level configuration validations.
    *   **Functions**:
        *   `validate_lifting_shape_inputs(maximum_gross_weight, location, configuration) -> List[str]`: Checks required properties, types, and allowed ranges for inputs.
        *   `validate_lifting_engineering_rules(configuration) -> List[str]`: Ensures coordinates are geometrically sound (e.g. lifting points form a polygon around the COG).
        *   `validate_lifting_inputs(...)`: Invokes both shape and engineering validations.

#### 📁 `domain/rigging/`
Coordinates candidate selection, arrangement layouts, and utilization ratios.
*   **`types.py`**:
    *   **Role**: Data Transfer Objects (DTOs) for rigging inputs and results.
    *   **Classes**:
        *   `ComponentRefDTO`: Models references containing `component_type` and `component_id`.
        *   `UserPreferenceDTO`: Models user choices, mapping index positions to specific components.
        *   `RiggingAnalysisInput`: Models lifting calculations inputs.
        *   `RiggingDesignInput`: Models rigging selection options.
*   **`errors.py`**:
    *   **Role**: Core domain exceptions.
    *   **Classes**:
        *   `RiggingDesignError`: Base domain exception.
        *   `RiggingDesignInputError`: Raised on malformed inputs.
        *   `InvalidUserPreferenceError`: Raised on invalid user selections.
        *   `ComponentNotFoundError`: Raised when a selected component is missing.
*   **`validation.py`**:
    *   **Role**: Structural sequence validation.
    *   **Functions**:
        *   `validate_rigging_arrangement(arrangement: List[str], lifting_points_qty: int)`: Ensures the rigging sequence is correct (e.g., Masterlink -> WireRope -> Shackle) and has the correct number of components.
*   **`arrangement.py`**:
    *   **Role**: Determines the rigging sequence.
    *   **Classes**:
        *   `RiggingArrangement`: Manages component arrangements.
            *   `determine_arrangement() -> List[str]`: Resolves default or custom arrangement.
            *   `validate_user_arrangement(arrangement)`: Validates the arrangement sequence.
*   **`ports.py`**:
    *   **Role**: Interfaces isolating database models from the domain.
    *   **Classes**:
        *   `RiggingRepository` (Interface): Declares query methods (`list_shackles`, `list_masterlinks`, `get_component`) that must be implemented by database adapters.
*   **`resolve.py`**:
    *   **Role**: Resolves preference IDs to domain objects.
    *   **Functions**:
        *   `resolve_user_preferences(user_preferences, repository) -> Dict`: Fetches full domain objects for user selections.
*   **`selector.py`**:
    *   **Role**: Queries inventory candidates.
    *   **Classes**:
        *   `RiggingComponentSelector` (Base): Defines components query interface.
        *   `ShackleSelector` / `MasterlinkSelector` / `MasterlinkAssemblySelector` / `WireRopeSelector`: Subclasses that filter catalog components based on WLL requirements.
        *   `RiggingSelector`: Coordinates selection queries across all positions in the rigging arrangement.
*   **`geometric_compatibility.py`**:
    *   **Role**: Validates physical connections between components.
    *   **Classes**:
        *   `RiggingGeometryChecker`: Performs dimensional checks.
            *   `check_compatibility(components_data) -> Dict`: Checks connections between adjacent components (e.g., pin diameter vs eye diameter).
*   **`utilization.py`**:
    *   **Role**: Calculates utilization ratios (UR).
    *   **Classes**:
        *   `RiggingUtilizationCalculator`: Performs component and wire rope utilization math.
            *   `calculate_component_utilization(component_type, component) -> float`: Calculates UR based on load and capacity.
            *   `calculate_wire_rope_utilization(wire_rope_dict, adjacent_components) -> float`: Calculates wire rope UR, applying configuration efficiency factors and $D/d$ bending factor reductions based on adjacent components.
            *   `_calculate_eye_bending_factor(wire_diameter, eye_type, bend_diameter) -> float`: Computes eye bending reductions.
*   **`geometry.py`**:
    *   **Role**: Computes sling geometry.
    *   **Functions**:
        *   `compute_sling_lengths(configuration, lifting_points_qty) -> List[float]`: Computes length of wire rope slings from hook to padeyes.
*   **`mappers.py`**:
    *   **Role**: Maps catalog data.
    *   **Functions**:
        *   `enrich_rigging_results(results, repository, rope_lengths) -> Dict`: Resolves component references to database details.
*   **`presentation.py`**:
    *   **Role**: Formats output display.
    *   **Functions**:
        *   `apply_item_display_fields(items, rope_lengths) -> List[Dict]`: Generates display-friendly strings for the frontend.
*   **`design.py`**:
    *   **Role**: Coordinates the entire rigging design process.
    *   **Classes**:
        *   `RiggingDesigner`: Coordinates selection, compatibility, and scoring.
            *   `design_rigging() -> Dict`: Solves for optimal designs. Generates combinations, filters by compatibility, and ranks them.
            *   `_score_combinations(combinations, target_utilization, weights) -> List`: Scores combinations based on proximity to target utilization.
            *   `to_dict() / JSON_serializible_to_dict()`: Serializes state and results.
            *   `update_user_preference(index, component, capacity)`: Updates preferences and recomputes the design.
*   **`engine.py`**:
    *   **Role**: Main entrypoint for rigging design.
    *   **Functions**:
        *   `design(input_data: RiggingDesignInput, repository: RiggingRepository) -> Dict`: Instantiates `RiggingDesigner` and returns calculations.

#### 📁 `domain/structure/`
Assembles nodes and elements to solve structural forces.
*   **`structure.py`**:
    *   **Role**: Manages nodes and elements in a 3D structural model.
    *   **Classes**:
        *   `StructureEvent` (Enum) / `StructureEventData`: Defines change events (node added, force updated).
        *   `StructureObserver` (Interface): Interface for observers that respond to structural changes.
        *   `Structure3D`: Manages structural nodes and elements and notifies observers of changes.
            *   `add_node(node, is_support)`: Adds node and sets support state.
            *   `add_element(element)`: Connects two nodes with a structural element.
            *   `set_node_force(node_id, direction, force)`: Applies forces to nodes.
*   **`calculator.py`**:
    *   **Role**: Solves 3D FEA equations.
    *   **Classes**:
        *   `LiftingCalculator` (inherits from `StructureObserver`): Performs structural analysis calculations.
            *   `update(structure, event_data)`: Resets calculations if structure changes.
            *   `primary_stiffness_matrix() -> np.ndarray`: Assembles global stiffness matrix.
            *   `reduced_stiffness_matrix() -> np.ndarray`: Applies boundary conditions.
            *   `analyze()`: Solves for displacements ($U = K^{-1} F$) and reactions. Updates elements with displacements for internal force calculations.
            *   `get_analysis_summary() -> Dict`: Returns a summary of forces and displacements.

#### 📁 `domain/utils/`
*   **`exceptions.py`**: Defines `DomainValidationError` and arrangement exceptions.
*   **`math_utils.py`**: Computes offset coordinates for positioning 3D labels: `get_perpendicular_point`.
*   **`serialization.py`**: Provides `json_safe` to convert Decimals, UUIDs, datetimes, and numpy arrays to JSON-compatible primitives.
*   **`validation.py`**: Core validations for numbers, integers, and strings.

---

### 2. The Application Services & Persistence Layers (`backend/apps/` & `infrastructure/`)

Integrates the domain logic with database models, Stripe billing, and REST views.

#### 📁 `apps/main/`
Manages core database models and transactional services.
*   **`models.py`**:
    *   **Role**: Declares Django ORM mapping tables.
    *   **Key Models**:
        *   `Shackle` / `Masterlink` / `MasterlinkAssembly` / `WireRope` / `Thimble`: Models for catalog hardware.
        *   `Project`: Stores project information and owners.
        *   `LiftingAnalysis`: Stores coordinates and DNV calculation inputs/outputs.
        *   `RiggingDesign`: Stores design results, active arrangements, and version history.
        *   `UserProfile`: Stores company details and logos for report branding.
*   **`selectors.py`**:
    *   **Role**: Optimizes database queries.
    *   **Classes**:
        *   `ProjectSelector`:
            *   `get_dashboard_rows(user) -> QuerySet`: Prefetches projects, analyses, and designs to prevent N+1 query issues.
*   **`services/projects.py`**:
    *   **Role**: Project CRUD transactional manager.
    *   **Classes**:
        *   `ProjectService`: Creates, updates, and deletes project records.
*   **`services/lifting.py`**:
    *   **Role**: Integrates DNV calculations with database models.
    *   **Classes**:
        *   `LiftingAnalysisService`: Runs DNV calculations and handles persistence and updates.
            *   `analyze_lifting(maximum_gross_weight, location, configuration) -> Dict`: Runs `DNVLiftingOperations` calculations.
            *   `save_analysis_results(analysis_data, project, user) -> LiftingAnalysis`: Saves analysis results to the database.
            *   `update_analysis(analysis_id, updates, user) -> LiftingAnalysis`: Updates analysis inputs and re-runs DNV calculations.
*   **`services/rigging.py`**:
    *   **Role**: Integrates the rigging design engine with database models.
    *   **Classes**:
        *   `RiggingDesignService`: Runs design calculations and handles persistence and updates.
            *   `run_design_for_analysis(analysis_id, user_preferences, name, set_active, user) -> RiggingDesign`: Runs the design engine for an analysis and saves the results.
            *   `recompute_design(design, user_preferences, name, status) -> RiggingDesign`: Updates an existing design in-place.
*   **`services/rigging_report_preview.py`**:
    *   **Role**: Compiles calculations, preferences, and LaTeX equations for reports.
    *   **Classes**:
        *   `RiggingDesignReportPreviewService`: Builds the report payload.
            *   `build_payload(design, request, selected_key) -> Dict`: Compiles the report payload.
*   **`services/report_reference_catalog.py`** & **`report_trace_specs.py`**:
    *   **Role**: Formats LaTeX math checks and matches citations for reports.

#### 📁 `apps/billing/`
Manages subscriptions and Stripe integrations.
*   **`models.py`**:
    *   **Role**: Declares billing and subscription models.
    *   **Key Models**:
        *   `Customer`: Links user profiles to Stripe customer IDs.
        *   `Subscription`: Stores subscription status, periods, and price mappings.
        *   `StripeWebhookEvent`: Tracks webhook events to ensure idempotent processing.
*   **`selectors.py`**:
    *   **Role**: Builds user capability contexts.
    *   **Classes**:
        *   `SaaSSelector`:
            *   `get_user_tier_context(user) -> UserTierContext`: Builds the domain context for checking tier limits.
*   **`handlers.py`**:
    *   **Role**: Event handlers for Stripe webhooks.
    *   **Classes**:
        *   `WebhookHandler` (Base): Processes webhook events under database transactions with idempotency checks.
        *   `SubscriptionCreatedHandler` / `SubscriptionUpdatedHandler` / `SubscriptionDeletedHandler`: Syncs subscription changes to the database and updates cached customer tiers.
        *   `InvoicePaidHandler` / `InvoicePaymentFailedHandler`: Handles payment success and failure events.
*   **`services/customers.py`** & **`stripe.py`** & **`subscriptions.py`**:
    *   **Role**: Stripe SDK abstraction wrappers for managing customers and subscriptions.
*   **`permissions.py`**:
    *   **Role**: DRF permissions checks based on tier policies.
    *   **Classes**:
        *   `CanCreateProject` / `CanCreateAnalysis` / `CanCreateDesign`: Checks limits before allowing resource creation.
        *   `CanExportPDF` / `CanUseAPI`: Checks feature permissions.
*   **`exceptions.py`**: Defines exceptions for tier limits (`TierLimitExceeded`) and subscription requirements (`SubscriptionRequiredException`).

#### 📁 `apps/stripe_webhooks/`
*   **`views.py`**: Endpoint view that receives webhook payloads, verifies Stripe signatures, and calls `process_webhook_event`.

#### 📁 `infrastructure/rigging/`
*   **`repositories.py`**:
    *   **Role**: Implements the `RiggingRepository` port using the Django ORM.
    *   **Classes**:
        *   `DjangoRiggingRepository`: Maps database queries to domain entities.
            *   `list_shackles(manufacturer, model) -> List[DomainShackle]`: Queries and maps shackles.
            *   `get_component(ref: ComponentRef) -> DomainComponent`: Retrieves components by reference.

#### 📁 `web_rigging_program/`
*   **`settings.py`**: Root Django configuration settings (installed apps, middleware, databases, DRF configs, JWT settings).
*   **`urls.py`**: Root URL routing.
*   **`test_runner.py`**:
    *   **Classes**:
        *   `NeonTestRunner`: Custom test runner that terminates PostgreSQL connections before dropping the database, resolving connection pooling issues during testing.

---

# Grispen Rigging SaaS — Complete Codebase Handover Documentation

This documentation serves as the comprehensive technical handover guide for **Grispen Rigging SaaS**. It covers both the frontend (React/TypeScript) and backend (Django/DRF) architectures, detailed component files, API endpoints, testing suites, database schemas, and custom Django command details.

---

## 🏢 Backend & Domain Walkthrough (Class & Method Dictionary)

This section provides an in-depth breakdown of every key class, method, function, and database mapping in the backend service and pure Python engineering domain layers.

### 1. Framework-Agnostic Domain Layer (`backend/domain/`)

The pure engineering calculations and standard checks are isolated from the web framework, database, or billing dependencies.

#### 🔲 `domain/saas/tier_policy.py`
Enforces pricing tier access rules and limits.

*   **`TierPolicy` (Class):**
    *   **Role:** Verifies tier-based limits and permissions for various actions (create project, analysis, design, PDF export, API use).
    *   `_get_tier_limits(tier: str) -> Dict[str, Any]`
        *   **Inputs:** `tier` (string).
        *   **Outputs:** Limits dictionary from `TIER_LIMITS`.
        *   **Role:** Inner helper to return the limits configuration of a specific subscription tier.
    *   `can_create_project(context: UserTierContext) -> Tuple[bool, int, Optional[int], str]`
        *   **Inputs:** `UserTierContext` DTO (user ID, current tier, active project count).
        *   **Outputs:** `(allowed, current_count, max_limit, status_message)`.
        *   **Role:** Verifies project counts against the tier max projects constraint.
    *   `can_create_analysis(context: UserTierContext, current_project_analysis_count: int) -> Tuple[bool, int, Optional[int], str]`
        *   **Inputs:** `UserTierContext`, current analyses count in target project.
        *   **Outputs:** `(allowed, current_count, max_limit, status_message)`.
        *   **Role:** Restricts analyses counts per project depending on the tier.
    *   `can_create_design(context: UserTierContext, current_analysis_design_count: int) -> Tuple[bool, int, Optional[int], str]`
        *   **Inputs:** `UserTierContext`, current designs count in target analysis.
        *   **Outputs:** `(allowed, current_count, max_limit, status_message)`.
        *   **Role:** Limits designs count per analysis depending on the tier.
    *   `can_export_pdf(context: UserTierContext) -> Tuple[bool, str]`
        *   **Inputs:** `UserTierContext`.
        *   **Outputs:** `(allowed, status_message)`.
        *   **Role:** Restricts PDF export availability (requires Starter/Pro).
    *   `can_use_api(context: UserTierContext) -> Tuple[bool, str]`
        *   **Inputs:** `UserTierContext`.
        *   **Outputs:** `(allowed, status_message)`.
        *   **Role:** Restricts external API access keys availability (requires Pro).
    *   `get_user_limits(context: UserTierContext) -> Dict[str, Any]`
        *   **Inputs:** `UserTierContext`.
        *   **Outputs:** Complete limits dict with tier and active status.
        *   **Role:** Convenience selector for the client capabilities endpoint.
    *   `check_limit(context: UserTierContext, resource_type: str, **kwargs) -> Tuple[bool, Dict[str, Any]]`
        *   **Inputs:** `context`, `resource_type` (string key), additional context arguments.
        *   **Outputs:** `(allowed, limits_payload)`.
        *   **Role:** Unified router function for the backend permissions middleware.

#### 🔲 `domain/standards/dnv.py`
Applies offshore lifting engineering checks based on marine code standards.

*   **`DNVLiftingOperations` (Class) inherits from `StructureObserver`:**
    *   **Role:** Validates geometry and solves 3D lifting structure equations using DNV Marine/Offshore standards.
    *   `__init__(maximum_gross_weight, location, configuration)`
        *   **Inputs:** Gross weight (float), location (string), configuration parameters (dict).
        *   **Role:** Constructor that builds a crane hook node at `(0, 0, 0)`, configures default safety contingencies (yaw, weight, skew load), and registers as structural observer.
    *   `update(structure, event_data)`
        *   **Inputs:** Observed `Structure3D`, `StructureEventData`.
        *   **Role:** Resets calculations on structural additions/removals.
    *   `maximum_gross_weight` (Property Getter/Setter)
        *   **Role:** Manages the gross weight with verification filters.
    *   `location` (Property Getter/Setter)
        *   **Role:** Validates location strings (`offshore`, `onshore`, etc.).
    *   `configuration` (Property Getter/Setter)
        *   **Role:** Manages the coordinate mapping configuration.
    *   `_reset_calculations()`
        *   **Role:** Resets solved results to force lazy computations.
    *   `_initialize_daf_map()`
        *   **Role:** Maps DNV DAF values based on gross weight classes and operational environments.
    *   `_get_hook_load_class(shl: float) -> int`
        *   **Inputs:** Static Hook Load (float).
        *   **Outputs:** Load class integer (1 to 5).
        *   **Role:** Classifies hook loads to determine the appropriate dynamic amplification factor (DAF).
    *   `_build_lifting_configuration()`
        *   **Role:** Maps coordinates of padeyes and defines elastic components inside `LiftingCalculator`.
    *   `analyze() -> Dict[str, Any]`
        *   **Outputs:** Serialized results map.
        *   **Role:** Computes DAF, applies safety contingency factors (weight factor, yaw factor, COG factor, skew load factor), solves the FEA stiffness equations, and determines static/dynamic sling load distributions.
    *   `to_dict() -> Dict[str, Any]`
        *   **Role:** Returns calculated results in a serialized structure.

#### 🔲 `domain/geometry/corner_to_cog.py`
Converts physical skid measurements into coordinate offsets relative to the Center of Gravity (COG).

*   `_coerce_float(value, field)`
    *   **Role:** Coerces inputs to floats, raising validation errors on invalid values.
*   `_coerce_xyz(payload, field)`
    *   **Role:** Decodes coordinate maps (`x`, `y`, `z`).
*   `convert_corner_coords_to_cog_config(geometry_input: Dict[str, Any]) -> Dict[str, Any]`
    *   **Inputs:** Coordinate dictionary relative to the skid corner.
    *   **Outputs:** COG-relative dimensions configuration dict.
    *   **Role:** Translates absolute corner coordinates to the engine's center-of-gravity offsets: $L_i = |x_i - x_{cog}|$, $B_i = |y_i - y_{cog}|$, and $h_i = z_i - z_{cog}$.

#### 🔲 `domain/geometry/node.py` & `element.py` & `collections.py`
Defines 3D coordinate frames and structural segments for Finite Element Analysis (FEA).

*   **`Node3D` (Class):** Represents a connection node at coordinate `(x, y, z)` with boundary constraints.
*   **`Element3D` (Class):** Represents a structural segment connecting two nodes. Calculates direction cosines, stiffness matrices, and element forces.
*   **`IndexedDict` (Class):** Preserves insertion order for nodes/elements.
*   **`Node3DDict` & `Element3DDict` (Classes):** Specialized maps for nodes and elements.

#### 🔲 `domain/rigging/design.py`
Orchestrates candidates lookup, layout selection, and safety checks.

*   **`RiggingDesigner` (Class):**
    *   **Role:** Orchestrates the rigging design selection, compatibility checking, and utilization calculation.
    *   `__init__(analysis_data, user_preferences, repository)`
        *   **Inputs:** `RiggingAnalysisInput`, `UserPreferencesDTO`, `RiggingRepository`.
        *   **Role:** Constructor that sets up data inputs, resolves preferences, calculates sling lengths, and initializes selection components.
    *   `design_rigging() -> Dict[str, Any]`
        *   **Outputs:** Complete design combinations and recommendations.
        *   **Role:** Generates combinations, runs geometric compatibility checks, and computes utilized loads.
    *   `_generate_component_combinations()`
        *   **Role:** Generates cartesian combinations of shackles, masterlinks, and slings.
    *   `_first_pass_evaluation(all_combinations)`
        *   **Role:** Filters out combinations violating hardware capacities or geometric clearances.
    *   `_second_pass_evaluation()`
        *   **Role:** Evaluates wire rope sling capacities and calculates bending factors based on adjacent components.
    *   `_get_adjacent_components(combination, wire_rope_index)`
        *   **Role:** Finds adjacent shackles or masterlinks in the arrangement stack.
    *   `_select_optimal_combination()`
        *   **Role:** Selects the conservative (safest) and minimum viable rigging options.
    *   `_score_combinations(combinations, target_utilization, weights)`
        *   **Role:** Penalizes deviations from target utilization limits to score combinations.
    *   `get_formatted_optimal_combinations()`
        *   **Role:** Formats combinations for serialization.
    *   `validate_inputs(...)`
        *   **Role:** Helper for checking configuration integrity.
    *   `to_dict()` & `JSON_serializible_to_dict()`
        *   **Role:** Serializers.
    *   `update_user_preference(index, component, capacity)`
        *   **Role:** Modifies design preferences.
    *   `recompute()`
        *   **Role:** Triggers calculations using updated preferences.

#### 🔲 `domain/rigging/selector.py`
Queries inventory candidates that match WLL and material criteria.

*   **`RiggingComponentSelector` (Base Class):** Abstract selector.
*   **`MasterlinkSelector` & `MasterlinkAssemblySelector` & `ShackleSelector` (Classes):** Filter components from the database that meet Working Load Limits (WLL).
*   **`WireRopeSelector` (Class):** Filters wire ropes by MBL and maps compatible thimbles.
*   **`RiggingSelector` (Class):** Coordinates selection across all positions in the arrangement.

#### 🔲 `domain/rigging/utilization.py`
Performs utilization ratio math, factoring in wire rope bending diameters.

*   **`RiggingUtilizationCalculator` (Class):**
    *   **Role:** Calculates utilization ratios for shackles, masterlinks, and wire ropes.
    *   `calculate_component_utilization(component_type, component) -> float`
        *   **Role:** Calculates utilization ratios based on load and capacity.
    *   `calculate_wire_rope_utilization(wire_rope_dict, adjacent_components) -> float`
        *   **Role:** Calculates wire rope utilization, applying $D/d$ bending factors based on adjacent components.
    *   `_get_minimum_bending_diameter(adjacent_components)`
        *   **Role:** Calculates the minimum bending diameter from adjacent pins or thimbles.
    *   `_calculate_shackle_ur(component)` / `_calculate_masterlink_ur(component)` / `_calculate_masterlink_assembly_ur(component)`
        *   **Role:** Class-specific utilization calculators.
    *   `_calculate_wire_rope_ur(wire_rope, sling_configuration, thimble, minimum_bending_diameter)`
        *   **Role:** Calculates wire rope utilization using configuration efficiencies, eye types, and bending factors.

#### 🔲 `domain/rigging/geometric_compatibility.py`
Enforces mechanical boundaries between shackles, masterlinks, and slings.

*   **`RiggingGeometryChecker` (Class):**
    *   `check_compatibility(components_data) -> Dict[str, Any]`
        *   **Role:** Iterates through components and verifies clearance dimensions.
    *   `_check_pair_compatibility(first, second)`
        *   **Role:** Resolves type-specific checking methods.
    *   `_check_masterlink_to_wire_rope(...)` / `_check_wire_rope_to_shackle(...)` / `_check_shackle_to_shackle(...)`
        *   **Role:** Dimension checks to verify physical clearance (e.g. pin diameter vs eye diameter).

#### 🔲 `domain/rigging/arrangement.py`
Validates the structural sequence of the rigging arrangement.

*   **`RiggingArrangement` (Class):**
    *   `determine_arrangement() -> List[str]`
        *   **Role:** Determines the order of rigging components (e.g. Masterlink -> WireRope -> Shackle).

#### 🔲 `domain/rigging/resolve.py`
Resolves DTO payloads into validated domain structures.

*   `resolve_user_preferences(user_preferences, repository) -> Dict[int, Dict[str, Any]]`
    *   **Role:** Queries the database repository to resolve component types and IDs into actual domain entities.

---

### 2. The Application Services Layer (`backend/apps/main/`)

Manages database persistence, transactional business rules, and report previews.

#### 🔲 `apps/main/services/projects.py`
Handles transactional operations for project records.

*   **`ProjectService` (Class):**
    *   `create_project(owner, name, description) -> Project`
    *   `update_project(project, **data) -> Project`
    *   `delete_project(project) -> None`
    *   **Role:** Handles transactional CRUD operations for project records.

#### 🔲 `apps/main/services/lifting.py`
Orchestrates DNV structural calculations and database synchronization.

*   **`LiftingAnalysisService` (Class):**
    *   `analyze_lifting(maximum_gross_weight, location, configuration) -> Dict`
        *   **Role:** Calls `DNVLiftingOperations` domain logic and returns calculation outputs.
    *   `save_analysis_results(analysis_data, project, user) -> LiftingAnalysis`
        *   **Role:** Validates inputs and saves calculations to the database under a transaction block.
    *   `update_analysis(analysis_id, updates, user) -> LiftingAnalysis`
        *   **Role:** Updates analysis parameters and re-runs DNV calculations if weights or locations change.

#### 🔲 `apps/main/services/rigging.py`
Enriches designs and manages in-place updates.

*   **`RiggingDesignService` (Class):**
    *   `run_design_for_analysis(analysis_id, user_preferences, name, set_active, user) -> RiggingDesign`
        *   **Role:** Executes the rigging selection engine and saves the generated configuration.
    *   `recompute_design(design, user_preferences, name, status) -> RiggingDesign`
        *   **Role:** Updates an existing design in-place to preserve downstream report relationships.
    *   `build_detail_results(design) -> Dict`
        *   **Role:** Enriches stored component results with catalog metrics before returning data to the API.

#### 🔲 `apps/main/services/rigging_report_preview.py`
Generates traceable math reports for engineers.

*   **`RiggingDesignReportPreviewService` (Class):**
    *   `build_payload(design, request, selected_key) -> Dict`
        *   **Role:** Compiles a payload of static DNV calculations, active preferences, and LaTeX-formatted math checks for generating report previews.

#### 🔲 `apps/main/selectors.py`
Provides pre-fetched queries to prevent database overhead.

*   **`ProjectSelector` (Class):**
    *   `get_dashboard_rows(user) -> QuerySet[Project]`
        *   **Role:** Uses query prefetching to retrieve projects, analyses, and designs in a single query plan, avoiding N+1 queries.

---

### 3. Subscriptions & Customer Services (`backend/apps/billing/`)

Links Stripe accounts, verifies capabilities, and processes webhook payments.

#### 🔲 `apps/billing/services/stripe.py`
Performs raw Stripe SDK requests.

*   **`StripeService` (Class):**
    *   `create_customer(customer) -> Customer`
        *   **Role:** Creates a customer in Stripe and saves the customer ID locally.
    *   `create_checkout_session(...) -> Session`
        *   **Role:** Generates Stripe Checkout URLs for subscription checkouts.
    *   `create_billing_portal_session(...) -> Session`
        *   **Role:** Generates self-service portal links for managing subscription plans.

#### 🔲 `apps/billing/services/subscriptions.py`
Manages billing cancel/reactivate actions.

*   **`SubscriptionService` (Class):**
    *   `cancel_subscription(subscription, cancel_at_period_end)`
        *   **Role:** Cancels subscription in Stripe and updates database active flags.
    *   `reactivate_subscription(subscription)`
        *   **Role:** Reactivates a subscription that was set to cancel at the end of the billing period.
    *   `update_subscription_plan(subscription, new_price_id)`
        *   **Role:** Modifies subscription plans in Stripe and updates the local price mapping.

#### 🔲 `apps/billing/handlers.py`
Synchronizes customer databases in response to Stripe webhooks.

*   **`WebhookHandler` (Base Class):** Validates webhooks and prevents duplicate event processing.
*   **`CustomerCreatedHandler` & `CustomerUpdatedHandler` & `SubscriptionCreatedHandler` & `SubscriptionUpdatedHandler` & `SubscriptionDeletedHandler` & `InvoicePaidHandler` & `InvoicePaymentFailedHandler` (Classes):**
    *   Process Stripe webhook events under atomic transactions and synchronize subscription states in the local database.

---

### 4. Persistence Repositories (`backend/infrastructure/`)

Provides database adapters to domain ports.

#### 🔲 `infrastructure/rigging/repositories.py`
*   **`DjangoRiggingRepository` (Class):**
    *   `to_domain(obj)`
        *   **Role:** Maps ORM models to domain dataclasses.
    *   `list_shackles(manufacturer, model) -> Sequence[DomainShackle]`
        *   **Role:** Queries the database and returns domain entities.
    *   `get_sling_configuration_for_wire_rope(...) -> DomainSlingConfiguration`
        *   **Role:** Fetches configurations for wire ropes.

---

## 🎯 Architecture & Technology Stack

The project is structured under **Clean Architecture** and **Domain-Driven Design (DDD)** principles to decouple core math models from database drivers, frameworks, and billing libraries.

```
                             [Client Browser]
                                    │
                             (Vercel SPA Page)
                                    │
                         React 19 / Vite / TS SPA
                                    │
                     ( TanStack Query / Axios API Client )
                                    │ (JSON over HTTPS)
                                    ▼
                          [Railway API Server]
                       Django 5.1 / Gunicorn / DRF
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
     [PostgreSQL Database]                     [Stripe API Client]
         Neon Cloud                               SaaS Payments
```

### Infrastructure Summary
*   **Vercel:** Hosts the React single-page frontend.
*   **Railway:** Deploys the Django backend, Gunicorn application runner, and manages automated migrations.
*   **Neon DB:** Cloud database server hosting the PostgreSQL database.
*   **Stripe:** B2B recurring subscription and billing engine.

---

## 💻 Frontend Client (`frontend/`)

The client is a Single Page Application (SPA) designed to enable engineering calculations, 3D visualization, and billing administration.

### 1. Project Dependencies (`package.json`)
The client app utilizes modern React libraries to support 3D rendering, complex math display, forms state, and cache synchronization:
*   **`react` & `react-dom` (v19.2.0):** Drives rendering, state management, and lifecycle hooks.
*   **`typescript` (v5.9.3):** Enforces static type safety across forms, API responses, and 3D geometries.
*   **`vite` (v7.3.1):** Dev server and bundler. Builds production assets using `tsc && vite build`.
*   **`@react-three/fiber` (v9.0.0) & `@react-three/drei` (v10.0.0) & `three` (v0.170.0):** Renders interactive 3D rigging scenes inside HTML5 Canvas.
*   **`@tanstack/react-query` (v5.90.21):** Handles client-side caching, background fetches, and mutations.
*   **`react-router-dom` (v6.30.3):** Manages client-side routing, protected layouts, and URL parameters.
*   **`react-hook-form` (v7.71.1) & `@hookform/resolvers` (v5.2.2):** Validates and manages workspace form inputs.
*   **`zod` (v4.3.6):** Enforces runtime schema validation, ensuring input data matches API expectations.
*   **`zustand` (v5.0.11):** Lightweight state manager used for client-side authentication states.
*   **`axios` (v1.13.5):** HTTP client configured with request/response interceptors to attach JWT headers.
*   **`@stripe/stripe-js` (v8.7.0):** Loads Stripe.js elements to securely handle payment portals.
*   **`pdfjs-dist` (v5.7.284):** Local library used to load and display engineering drawing PDFs.

---

### 2. Client Architecture & Directories
The frontend codebase follows a **feature-based structure** to group components, hooks, routes, and utilities by functional domain:
*   `frontend/src/api/`: Centralized API Axios client configuration and endpoints interfaces.
*   `frontend/src/components/`: Reusable components (e.g., UI inputs, buttons, skeletons, and LaTeX math renderers).
*   `frontend/src/features/`: Core application feature modules:
    *   `auth/`: Registration, logins, verification redirects, and Zustand user stores.
    *   `dashboard/`: User dashboard displaying projects table and statistics.
    *   `projects/`: Project list and CRUD creation dialogs.
    *   `analysis/`: Geometry forms, FEA solvers, and static/dynamic loads tables.
    *   `design/`: Slings arrangement lists, component catalogs, and PDF preview configurations.
    *   `workspace/`: The unified workspace page that consolidates analyses and designs.
    *   `billing/` & `pricing/`: Billing details, price matrices, subscription checkouts, and customer portals.
*   `frontend/src/types/`: TypeScript definitions mirroring backend database models and DTO structures.

---

### 3. Routing System (`router.tsx`)
The routing system is configured using React Router's `createBrowserRouter` to handle public routes, protected views, and legacy URL redirects.

#### Key Redirect Hooks
*   **`AnalysisRedirect`:** 
    *   **Trigger:** Matches legacy routes `/analysis/:id`.
    *   **Workflow:** Fetches the analysis record via `useAnalysis(id)` to resolve the parent `project_id`, then redirects the browser to the consolidated workspace view: `/projects/:projectId/workspace?tab=analysis&analysis=:id`.
*   **`DesignRedirect`:** 
    *   **Trigger:** Matches legacy routes `/design/:id`.
    *   **Workflow:** Resolves the design record using `useDesign(id)` and redirects the user to `/projects/:projectId/workspace?tab=design&analysis=:analysisId&design=:id`.
*   **`AnalysisCreateRedirect`:** 
    *   **Trigger:** Matches `/analysis/new`.
    *   **Workflow:** Extracts `project_id` from URL query parameters and forwards the client to the project workspace tab: `/projects/:projectId/workspace?tab=analysis`.
*   **`ProjectDetailRedirect`:** 
    *   **Trigger:** Matches `/projects/:id`.
    *   **Workflow:** Redirects directly to `/projects/:id/workspace`.

#### Declared Routes Mapping
*   **`/login` & `/register` & `/verify-email` & `/reset-password`:** Public authentication forms.
*   **`/pricing`:** Interactive subscription tier pricing matrices.
*   **`/dashboard`:** Displays project summaries, usage metrics, and active calculations.
*   **`/projects/:id/workspace`:** Consolidated workspace tab navigation (`?tab=analysis`, `?tab=design`, `?tab=report`).
    > [!NOTE]
    > **Workspace Route Architecture Note:** The path `/projects/:id/workspace` is a purely client-side route managed by React Router and has no direct single-endpoint counterpart in the Django backend (e.g., `/api/v1/projects/:id/workspace` does not exist). Instead, the `ProjectWorkspacePage` orchestrates data retrieval and mutates state by fetching and updating the standard REST entities individually (Projects, Analysis, and Designs) through the existing REST API endpoints.
*   **`/design/:id/report`:** Clean layout page for viewing printable reports.
*   **`/billing`:** Customer portal showing active plan details and payment history.
*   **`/settings/company` & `/settings/password`:** Branding customization and account management.

---

### 4. Custom React Hooks Directory

#### 🔲 `features/auth/stores/authStore.ts`
*   `useAuthStore`: Coordinates auth states, login requests, local storage tokens, and profile syncs.
*   `useUser` & `useIsAuthenticated`: Utility selectors targeting user info.

#### 🔲 `features/projects/hooks/useProjects.ts`
*   `useProjects()`: Fetches projects owned by the user.
*   `useProject(id)`: Fetches details for a specific project.
*   `useCreateProject()`: Mutation that creates a project. Invalidates `['projects']` lists.
*   `useUpdateProject()` & `useDeleteProject()`: Mutations to edit or delete projects.

#### 🔲 `features/analysis/hooks/useAnalyses.ts`
*   `useAnalyses(projectId)`: Fetches analyses belonging to a specific project.
*   `useAnalysis(id)`: Fetches a single analysis using React Query cache key `['analyses', 'detail', id]`.
*   `useCreateAnalysis()`: Sends analysis inputs to the backend. On success, it invalidates project and analysis caches.
*   `useUpdateAnalysis()` & `useDeleteAnalysis()`: Mutations that update or delete analyses, updating list states and refreshing usage limits.

#### 🔲 `features/design/hooks/useDesigns.ts`
*   `useDesigns(projectId, analysisId)`: Fetches rigging designs.
*   `useDesign(id)`: Retrieves a specific design's results (`['analyses', 'detail']` and `['designs', 'detail']`).
*   `useCreateDesign()`: Mutation to trigger rigging calculation pipelines.
*   `useUpdateDesign()`: Mutation that updates metadata or recomputes a design in-place.
*   `useComponentOptions()`: Fetches available inventory hardware options (Shackles, Masterlinks, Wire Ropes).

#### 🔲 `features/billing/hooks/useCapabilities.ts`
*   `useCapabilities()`: Fetches limits for the user's subscription tier (`['capabilities', 'current']`).

---

### 5. Components & Interactive 3D Visualizers
*   **`CornerGeometryFieldset.tsx`:** Form interface for entry of skid dimensions, COG coordinates, and lifting points relative to a physical corner.
*   **`MathRenderer.tsx`:** Custom component that parses LaTeX strings and renders formatted equations for reports.
*   **`GeometryVisualizer3D.tsx`:** 
    *   **Props:** `skid: { length, width, height }`, `cog: { x, y, z }`, `points: Array<{ x, y, z }>`.
    *   **Workflow:** Renders a 3D bounding box for the skid, a red target marker at the COG, and yellow spheres atpadeye locations.
*   **`DesignVisualizer3D.tsx`:** 
    *   **Props:** `arrangement: Array<string>`, `slingLengths: Array<number>`.
    *   **Workflow:** Renders a crane hook at the origin, slings extending to padeye locations, and shackle geometries at connection points.
*   **`ResultsVisualizer3D.tsx`:** 
    *   **Props:** `results: RiggingDesignResults`.
    *   **Workflow:** Colors rigging elements (green, yellow, or red) based on their calculated utilization ratios.

---

### 6. Types Definitions (`types/`)
*   **`types/index.ts`:** Holds core definitions for `Project`, `LiftingAnalysis`, `RiggingDesign`, `Shackle`, `Masterlink`, `WireRope`, and validation schemas.
*   **`types/billing.ts`:** Maps Stripe billing plans, prices, customer configurations, and payment statuses.
*   **`types/report.ts`:** Defines serialization payload structures for generating printable reports.

---

## 🔌 Django API Integration (`backend/apps/api/`)

The API layer manages routing, schema serialization, request validation, and exception formatting.

### 1. Request Handling & Global Settings
*   **Authentications:** Uses `rest_framework_simplejwt.authentication.JWTAuthentication` on protected endpoints.
*   **Parsers:** Configures JSON, Form, and MultiPart parsers to support both standard payload formats and file/logo uploads.

---

### 2. Exceptions Handler (`exceptions.py`)
Unifies framework and domain errors into a standardized response format.

*   `custom_exception_handler(exc, context) -> Response`
    *   **Role:** Catches DRF and pure domain exceptions and formats them.
    *   **Outputs:** Standardized error payload:
        ```json
        {
          "error": {
            "code": "validation_error",
            "message": "Invalid input.",
            "details": { "field_name": ["This field is required."] },
            "request_id": "req_uuid_here"
          }
        }
        ```
    *   **Error Code Mapping:**
        *   `DomainValidationError` → `"domain_validation_error"`
        *   `InvalidArrangementLengthError` → `"invalid_arrangement_length"`
        *   `InvalidFirstComponentError` → `"invalid_first_component"`
        *   `InvalidLastComponentError` → `"invalid_last_component"`
        *   `MissingRequiredComponentError` → `"missing_required_component"`
        *   `WireRopeLastComponentError` → `"wire_rope_last_component"`
        *   `InvalidComponentTypeError` → `"invalid_component_type"`
        *   `ValidationError` (DRF) → `"validation_error"`
        *   `NotFound` → `"not_found"`
        *   `PermissionDenied` → `"permission_denied"`
        *   `NotAuthenticated` / `AuthenticationFailed` → `"authentication_error"`

---

### 3. Permissions Policy (`permissions.py`)
*   **`IsOwner` (Class):** Checks object ownership before executing retrieve, patch, or delete operations.
    *   `has_object_permission(request, view, obj) -> bool`
        *   **Role:** Compares the request user with the object owner field. Logs warnings with user, owner, and object details if authorization fails.

---

### 4. V1 API Endpoints Catalog

| Route Path | HTTP Method | View Controller | Auth & Permissions | Role & Workflow Description |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/auth/me/` | `GET`, `PATCH` | `me` | Authenticated | Retrieves or updates current user profile settings and branding logos. |
| `/api/v1/auth/login/` | `POST` | `LoginView` (dj-rest-auth) | Public | Verifies credentials and returns access/refresh tokens. |
| `/api/v1/auth/registration/` | `POST` | `RegisterView` | Public | Registers new accounts and sends confirmation emails. |
| `/api/v1/auth/registration/account-confirm-email/<key>/` | `GET` | `EmailConfirmationRedirectView` | Public | Redirects verification link clicks to the frontend application: `/verify-email?key=<key>`. |
| `/api/v1/projects/` | `GET`, `POST` | `projects` | Authenticated + `CanCreateProject` | Lists user projects or creates a new project. |
| `/api/v1/projects/overview/` | `GET` | `projects_overview` | Authenticated | Dashboard fetch that returns nested projects, analyses, and designs in a single query. |
| `/api/v1/projects/<id>/` | `GET`, `PATCH`, `DELETE` | `project_details` | Authenticated + `IsOwner` | Retrieve details, modify metadata, or delete a project. |
| `/api/v1/analysis/` | `GET`, `POST` | `analyses` | Authenticated + `CanCreateAnalysis` | Lists analyses or runs DNV calculations to save a new analysis. |
| `/api/v1/analysis/<id>/` | `GET`, `PATCH`, `DELETE` | `analysis_details` | Authenticated + `IsOwner` | Retrieves details, updates parameters, or deletes an analysis. |
| `/api/v1/design/` | `GET`, `POST` | `designs` | Authenticated + `CanCreateDesign` | Lists designs or runs candidate selections to save a new design. |
| `/api/v1/design/<id>/` | `GET`, `PATCH`, `DELETE` | `design_details` | Authenticated + `IsOwner` | Retrieves, deletes, or recomputes a design in-place. |
| `/api/v1/design/<id>/report/` | `GET` | `design_report` | Authenticated + `CanExportPDF` | Generates report payloads containing LaTeX equations and citations. |
| `/api/v1/design/component-options/` | `GET` | `component_options` | Authenticated | Returns lists of available shackles, masterlinks, and slings. |
| `/api/v1/billing/subscription/` | `GET` | `subscription` | Authenticated | Returns the user's active plan, price, and customer ID. |
| `/api/v1/billing/checkout/` | `POST` | `checkout_session` | Authenticated | Creates Stripe Checkout sessions for subscription upgrades. |
| `/api/v1/billing/portal/` | `POST` | `portal` | Authenticated | Generates access links to Stripe's self-service billing portal. |
| `/api/v1/billing/invoices/` | `GET` | `invoices` | Authenticated | Returns subscription invoice histories. |
| `/api/v1/billing/plans/` | `GET` | `plans` | Public | Returns lists of active subscription plans and pricing structures. |
| `/api/v1/billing/capabilities/` | `GET` | `capabilities` | Authenticated | Returns usage stats and tier limits. |
| `/api/v1/billing/webhook/` | `POST` | `stripe_webhook` | Public | Processes incoming Stripe webhook events. |

---

## 🧪 Testing Suites (`backend/apps/api/tests/v1/`)

Grispen Rigging SaaS uses **`pytest-django`** to validate API endpoints, business logic, permissions, and SaaS tier limits.

### 1. Project Endpoints Testing (`test_projects_endpoints.py`)
Verifies user scopes and database constraints for projects.
*   `test_projects_list_returns_only_owned_projects`: Verifies that users can only view projects they own.
*   `test_free_user_can_create_first_project`: Validates that new users can create their first project.
*   `test_free_user_cannot_create_second_project`: Asserts that Free tier limits prevent creating a second project.
*   `test_starter_user_can_create_fifth_project_but_not_sixth`: Verifies that Starter tier limits restrict project creation after the limit is reached.
*   `test_pro_user_can_create_beyond_starter_limit`: Confirms that Pro users can create unlimited projects.
*   `test_inactive_starter_user_is_treated_as_free_for_project_creation`: Verifies that Starter accounts with inactive subscriptions are restricted to Free tier limits.
*   `test_inactive_pro_user_is_treated_as_free_for_project_creation`: Verifies that Pro accounts with inactive subscriptions are restricted to Free tier limits.
*   `test_inactive_paid_user_can_still_list_existing_projects`: Confirms that inactive accounts can still read existing project records.
*   `test_owner_can_retrieve_own_project_detail`: Verifies details retrievals.
*   `test_project_detail_includes_analysis_updated_at`: Ensures project detail payloads contain correct sub-analysis timestamps.
*   `test_user_cannot_retrieve_someone_elses_project_detail`: Restricts read access to the project owner.

---

### 2. Analysis Endpoints Testing (`test_analysis_endpoints.py`)
Validates DNV calculation endpoints and project scopes.
*   `test_analyses_list_returns_only_owned_analyses`: Confirms users can only list their own calculations.
*   `test_analyses_list_can_filter_by_project_id`: Validates the `?project_id=` search filter.
*   `test_free_user_can_create_first_analysis_in_project`: Asserts that Free users can add one analysis to a project.
*   `test_free_user_cannot_create_second_analysis_in_same_project`: Enforces analysis creation limits on the Free tier.
*   `test_starter_user_can_create_up_to_three_analyses_in_project`: Verifies that Starter users can add up to three analyses.
*   `test_starter_user_cannot_create_fourth_analysis_in_same_project`: Enforces analysis creation limits on the Starter tier.
*   `test_pro_user_can_create_beyond_starter_limit`: Confirms that Pro users can add unlimited analyses to a project.
*   `test_inactive_starter_user_is_treated_as_free_for_analysis_creation`: Restricts analysis creation for inactive Starter accounts.
*   `test_inactive_pro_user_is_treated_as_free_for_analysis_creation`: Restricts analysis creation for inactive Pro accounts.
*   `test_inactive_paid_user_can_still_list_existing_analyses`: Confirms that inactive accounts can still read existing analysis records.
*   `test_user_cannot_create_analysis_in_another_users_project`: Prevents creating analyses in projects owned by other users.
*   `test_owner_can_retrieve_own_analysis_detail` & `test_user_cannot_retrieve_someone_elses_analysis_detail`: Verifies retrieve access scopes.
*   `test_user_cannot_delete_someone_elses_analysis`: Prevents unauthorized delete requests.
*   `test_free_user_limits_are_per_project`: Confirms that limits are scoped per-project, allowing Free users to have one analysis per project across multiple projects.

---

### 3. Design Endpoints Testing (`test_design_endpoints.py`)
Validates candidate selection, geometry verification, and utilization calculations.
*   `test_designs_list_returns_only_owned_designs` & `test_designs_list_can_filter_by_analysis_id`: Verifies design list retrieval and filtering.
*   `test_free_user_can_create_first_design_in_analysis` & `test_free_user_cannot_create_second_design_in_same_analysis`: Enforces design limits on the Free tier.
*   `test_starter_user_can_create_first_design_in_analysis` & `test_starter_user_cannot_create_second_design_in_same_analysis`: Enforces design limits on the Starter tier (Starter limit is 3, but the test configures this to verify the limit is applied correctly).
*   `test_pro_user_can_create_beyond_starter_limit` & `test_pro_user_can_create_many_designs`: Confirms Pro users have unlimited design capabilities.
*   `test_inactive_starter_user_is_treated_as_free_for_design_creation` & `test_inactive_pro_user_is_treated_as_free_for_design_creation`: Enforces limits on inactive accounts.
*   `test_user_cannot_create_design_for_another_users_analysis`: Prevents creating designs for other users' analyses.
*   `test_owner_can_retrieve_own_design_detail` & `test_user_cannot_retrieve_someone_elses_design_detail`: Verifies retrieve access scopes.
*   `test_user_cannot_delete_someone_elses_design`: Prevents unauthorized delete requests.
*   `test_owner_can_retrieve_design_report_preview`: Validates report data generation.
*   `test_owner_can_select_specific_non_null_report_combination`: Verifies selection resolution for report previews.
*   `test_design_report_preview_aligns_appendix_rows_from_list_payload`: Confirms that appendix items align correctly with component positions.
*   `test_design_report_preview_returns_all_four_sling_lengths`: Verifies that sling length lists match the number of lifting points.
*   `test_user_cannot_retrieve_other_users_design_report_preview`: Restricts report preview access to the owner.
*   **Calculation Validation Tests:**
    *   `test_create_design_returns_clear_error_for_short_custom_arrangement`: Catches `InvalidArrangementLengthError`.
    *   `test_create_design_returns_clear_error_for_invalid_first_component`: Catches `InvalidFirstComponentError` (e.g., placing a Wire Rope first).
    *   `test_create_design_returns_clear_error_for_wire_rope_last`: Catches `WireRopeLastComponentError` (e.g., placing a Wire Rope at the bottom).
    *   `test_create_design_returns_clear_error_for_missing_required_component`: Catches `MissingRequiredComponentError` (e.g., missing Shackles).

---

### 4. Billing Endpoints Testing (`test_billing_endpoints.py`)
Validates tier limits, subscription states, and usage counts.
*   `test_capabilities_returns_401_for_unauthenticated_request`: Confirms authentication is required.
*   `test_capabilities_returns_free_tier_limits_for_free_user`: Asserts Free limits (1 project, 1 analysis, 1 design, no PDFs, no APIs).
*   `test_capabilities_returns_starter_tier_limits_for_active_starter_user`: Asserts Starter limits (5 projects, 3 analyses, 3 designs, allows PDFs, no APIs).
*   `test_capabilities_returns_pro_tier_limits_for_active_pro_user`: Asserts Pro limits (unlimited projects/analyses/designs, allows PDFs, allows APIs).
*   `test_capabilities_treats_inactive_starter_user_as_free` & `test_capabilities_treats_inactive_pro_user_as_free`: Verifies that users with unpaid subscriptions default to Free limits.
*   `test_capabilities_includes_accurate_current_project_count`: Verifies usage tracking counts.
*   `test_capabilities_project_count_only_includes_own_projects`: Confirms usage tracking is scoped per-user.
*   `test_capabilities_for_user_without_customer_record_defaults_to_free`: Verifies fallback behaviors for users without customer records.

---

### 5. Profile Endpoints Testing (`test_auth_profile_endpoints.py`)
Verifies user profile update operations.
*   `test_me_returns_profile_payload`: Confirms the `/me/` endpoint returns the user profile.
*   `test_me_patch_updates_branding_and_logo`: Verifies updating company names and uploading logo files.

---

## 🛠️ Custom Django Commands Directory

Django management commands are run using the project virtual environment: `backend/.venv/Scripts/python backend/manage.py [command]`.

### 1. System Setup & Configuration Commands

#### 🔲 `setup_site`
*   **Location:** `backend/apps/api/management/commands/setup_site.py`
*   **What it does:** Updates the Django Sites framework (`Site` model) with the domain extracted from `settings.FRONTEND_URL`.
*   **When to run:** Run during initial database deployments or when the frontend URL changes.
*   **Command:**
    ```bash
    backend/.venv/Scripts/python backend/manage.py setup_site
    ```

#### 🔲 `create_stripe_products`
*   **Location:** `backend/apps/billing/management/commands/create_stripe_products.py`
*   **What it does:** Registers the Starter and Pro subscription tiers in Stripe. It creates the products and associated monthly/yearly price objects.
*   **When to run:** Run once during initial Stripe integration setup.
*   **Command:**
    ```bash
    backend/.venv/Scripts/python backend/manage.py create_stripe_products
    ```

#### 🔲 `populate_rigging_database`
*   **Location:** `backend/apps/main/management/commands/populate_rigging_database.py`
*   **What it does:** Imports standard rigging catalog CSV files (shackles, masterlinks, wire ropes, and thimbles data) into the database.
*   **When to run:** Run after applying database migrations on new environments.
*   **Command:**
    ```bash
    backend/.venv/Scripts/python backend/manage.py populate_rigging_database
    ```

---

### 2. Maintenance & Operations Commands

#### 🔲 `sync_stripe_data`
*   **Location:** `backend/apps/billing/management/commands/sync_stripe_data.py`
*   **What it does:** Syncs active subscriptions and customer statuses from Stripe into the local database.
*   **When to run:** Run to resolve database discrepancies or re-sync states after connection drops.
*   **Command:**
    ```bash
    backend/.venv/Scripts/python backend/manage.py sync_stripe_data
    ```

#### 🔲 `check_subscriptions`
*   **Location:** `backend/apps/billing/management/commands/check_subscriptions.py`
*   **What it does:** Scans the database for subscriptions that have expired or are past due, and updates their active flags.
*   **When to run:** Configure as a nightly cron job to maintain accurate customer tier statuses.
*   **Command:**
    ```bash
    backend/.venv/Scripts/python backend/manage.py check_subscriptions
    ```

#### 🔲 `retry_failed_webhooks`
*   **Location:** `backend/apps/stripe_webhooks/management/commands/retry_failed_webhooks.py`
*   **What it does:** Retries failed Stripe webhook events stored in the database.
*   **When to run:** Run manually or on a schedule to re-process webhook events that failed due to temporary network issues.
*   **Command:**
    ```bash
    backend/.venv/Scripts/python backend/manage.py retry_failed_webhooks --days 7 --max-retries 3
    ```

#### 🔲 `cleanup_test_db`
*   **Location:** `backend/apps/main/management/commands/cleanup_test_db.py`
*   **What it does:** Forcefully terminates active database connections and drops test databases (e.g., databases prefixed with `test_`).
*   **When to run:** Run when test suite executions are blocked because connection pooling is preventing the test database from being dropped.
*   **Command:**
    ```bash
    backend/.venv/Scripts/python backend/manage.py cleanup_test_db
    ```
