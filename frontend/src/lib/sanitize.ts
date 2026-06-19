import { UserPreference, ComponentOptions, ModelWithManufacturer } from '@/types'

/**
 * Sanitizes user preferences by removing empty/null/undefined values
 * before sending to backend API.
 *
 * Problem:
 * - react-hook-form with <select> returns "" for unselected options
 * - Backend serializer expects missing keys OR valid values
 * - FloatField(required=False) does NOT accept "" (only null or missing)
 *
 * Solution:
 * - Remove keys with empty string, null, or undefined values
 * - Only send meaningful filter criteria to backend
 *
 * Example:
 * Input:  { component_type: "WireRope", capacity: "", eye_type: "", termination: "ferrule" }
 * Output: { component_type: "WireRope", termination: "ferrule" }
 *
 * @param preferences - Raw user preferences from form (may contain empty strings)
 * @returns Sanitized preferences with only meaningful values, or undefined if empty
 */
export function sanitizeUserPreferences(
  preferences: UserPreference[] | undefined | null
): UserPreference[] | undefined {
  // Return undefined if no preferences provided
  if (!preferences || preferences.length === 0) {
    return undefined
  }

  // Map each preference, removing empty values
  const sanitized = preferences
    .map((pref) => {
      const cleaned: Record<string, any> = {}

      // Iterate over each key-value pair
      Object.entries(pref).forEach(([key, value]) => {
        // Only include if value is truthy and not empty string
        // This removes: "", null, undefined
        // Keeps: numbers (including 0), non-empty strings, booleans
        if (value !== "" && value !== null && value !== undefined) {
          cleaned[key] = value
        }
      })

      // Only return preference if it has at least one meaningful field
      return Object.keys(cleaned).length > 0 ? (cleaned as UserPreference) : null
    })
    .filter((pref): pref is UserPreference => pref !== null)

  // Return undefined if all preferences were empty
  return sanitized.length > 0 ? sanitized : undefined
}

/**
 * Validates and fixes manufacturer/model consistency before submission.
 *
 * Business Rules:
 * 1. User may select manufacturer without model ✅
 * 2. User may NOT select model without manufacturer ❌ (auto-fix)
 * 3. Model must belong to selected manufacturer ❌ (clear invalid model)
 *
 * This function provides defense-in-depth validation in case the frontend
 * useEffect hooks don't catch all edge cases.
 *
 * @param preferences - Sanitized user preferences (already cleaned of empty strings)
 * @param componentOptions - Component options with model-manufacturer metadata
 * @returns Validated preferences with consistent manufacturer/model pairs
 */
export function validateManufacturerModelPairs(
  preferences: UserPreference[] | undefined,
  componentOptions: ComponentOptions | undefined
): UserPreference[] | undefined {
  if (!preferences || !componentOptions) return preferences

  return preferences.map(pref => {
    const { component_type, model, manufacturer } = pref

    // Skip WireRope (no manufacturer/model)
    if (component_type === 'WireRope') return pref

    // Skip if no model selected (manufacturer-only filter is valid)
    if (!model) return pref

    const options = component_type ? componentOptions[component_type] : null
    if (!options || !options.models || options.models.length === 0) return pref

    // Handle legacy string[] format (shouldn't happen)
    if (typeof options.models[0] === 'string') return pref

    // Find model's manufacturer
    const modelsWithMfr = options.models as ModelWithManufacturer[]
    const modelData = modelsWithMfr.find(m => m.model === model)

    if (!modelData) {
      // Model not found in options, remove it (invalid)
      const { model: _, ...prefWithoutModel } = pref
      return prefWithoutModel as UserPreference
    }

    // Rule 2: If manufacturer missing, auto-fill from model
    if (!manufacturer) {
      return {
        ...pref,
        manufacturer: modelData.manufacturer
      }
    }

    // Rule 3: If manufacturer doesn't match model, clear model (invalid pair)
    if (manufacturer !== modelData.manufacturer) {
      const { model: _, ...prefWithoutModel } = pref
      return prefWithoutModel as UserPreference
    }

    return pref
  })
}
