# Domain layer — public stub

> ⚠️ **This is a stubbed, public version of the `domain/` package.**
> The proprietary lifting/rigging engineering logic has been removed and
> replaced with inert placeholders that return **fixed, generic, shape-valid**
> data. The numbers produced here are **NOT engineering-valid** and must never
> be used for a real lifting operation.

The rest of the application (backend API + frontend) is fully functional. When
you clone this repository the entire workflow — *lifting analysis → persist →
rigging design → enrich → report/PDF* — runs end to end against these stubs, so
you can develop, demo and integrate without the proprietary engine.

## What was replaced (the intellectual property)

| File | Real responsibility (removed) | Stub behaviour |
|------|------------------------------|----------------|
| `standards/dnv.py` | DNV hook-load classes, dynamic amplification, skew-load distribution, sling-load solving | Fixed placeholder factors and loads (shape-valid) |
| `structure/calculator.py` | Finite-element solver: global stiffness assembly, boundary conditions, displacement/reaction/force solve | Inert calculator returning empty matrices/vectors |
| `structure/structure.py` | DOF assignment, constraint/force bookkeeping for the solver | Lightweight node/element container + observer plumbing |
| `geometry/element.py` | Element local stiffness matrix, coordinate transformation, internal-force recovery | Geometry kept (length, direction cosines); FEA methods return zeros |
| `rigging/design.py` | Combination generation, two-pass evaluation, optimal-combination selection | Builds one fixed placeholder arrangement + result payload |
| `rigging/selector.py` | Catalogue filtering / candidate ranking per component type | Empty selections |
| `rigging/utilization.py` | Utilization / unity-check formulas | Returns 0.0 / `None` |
| `rigging/geometric_compatibility.py` | Pin/eye/bow fit-up compatibility rules | Reports everything compatible |
| `rigging/geometry.py` | Sling-length derivation from geometry | Fixed placeholder length per point |
| `rigging/arrangement.py` | Arrangement determination rules | Fixed `Masterlink + (Shackle, WireRope)×N` arrangement |

## What was kept (not IP — needed for the app to compile and run)

`rigging/{types,ports,errors,contracts.md,presentation,mappers,validation,resolve}.py`,
`utils/*`, `saas/*` (tier policy / limits), `lifting/validation.py`,
`geometry/{node,collections,corner_to_cog}.py`. These are DTOs, interfaces,
input validation, SaaS gating and commodity vector maths — no proprietary
calculations.

## Public contract preserved

The stubs keep the exact public surface and output shapes the application
relies on, so swapping the real engine back in is a drop-in replacement:

- `DNVLiftingOperations(maximum_gross_weight, location, configuration)` →
  `.analyze()` / `.to_dict()` returning `{factors, static_results, dynamic_results, geometry}`
- `domain.rigging.engine.design(RiggingDesignInput, RiggingRepository)` →
  `{summary, arrangement, optimal_combinations, factors, calculation_context, user_preferences, sling_lengths}`
- `convert_corner_coords_to_cog_config(...)`, `validate_lifting_inputs(...)`,
  `TierPolicy`, and the `RiggingRepository` port are unchanged.
