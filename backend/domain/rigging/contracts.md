# Rigging User Preferences DTO

This contract defines the JSON-native payload accepted at the domain boundary.

Notes:
- JSON object keys are strings; the Django parser converts them to integer indices.
- Only one of `component_ref` or `component_type` is allowed per entry.
- Indices represent positions in the rigging arrangement (0-based). Missing indices are allowed.

## Allowed component types

`component_ref.type` and `component_type` must be one of:
- `Masterlink`
- `MasterlinkAssembly`
- `WireRope`
- `Shackle`

## Field semantics (important)

- `component_ref` means: **use this exact component** (by `{type, id}`), resolved via the `RiggingRepository`.
- `component_type` means: **type hint** for arrangement/selection (the engine may still choose the specific component).
- `capacity` means: **capacity override** for filtering/scoring rules where applicable.
- `manufacturer`, `model`, `configuration`, `termination`, `eye_type` are **selection hints** (best-effort).

## Engine input boundary

The standalone rigging engine accepts:
- `RiggingDesignInput` (analysis DTO + user preferences DTO)
- a `RiggingRepository` implementation

The engine does **not** accept Django model instances.

## Engine output guarantee (what Django can rely on)

The rigging engine returns a JSON-serializable payload that includes:
- `arrangement` (list of component type strings)
- `optimal_combinations` (with per-item `component_type` and `component_id`)
- `sling_lengths` (list of sling lengths; always present for newly computed designs)

If `sling_lengths` is missing from persisted designs, it indicates an older record created before this field was stored.

Example request payload:
```json
{
  "user_preferences": {
    "0": {
      "component_ref": {"type": "Shackle", "id": "1b23c4d5-6789-4a1b-2c3d-4e5f67890123"},
      "capacity": 12.0,
      "manufacturer": "Crosby",
      "model": "G-2130"
    },
    "1": {
      "component_type": "WireRope",
      "configuration": "vertical",
      "termination": "ferrule",
      "eye_type": "hard"
    }
  }
}
```
