import { AxiosError } from 'axios'
import { normalizeApiError } from '@/lib/normalizeApiError'

/**
 * API Error Response Types
 *
 * These match the various error formats returned by Django REST Framework
 */
interface DRFValidationError {
  [field: string]: string[] | string
}

interface DRFDetailError {
  detail: string
}

interface DRFGenericError {
  error?: string
  message?: string
  non_field_errors?: string[]
}

type ApiErrorResponse = DRFValidationError | DRFDetailError | DRFGenericError

/**
 * Parse API error into user-friendly message
 *
 * Handles various DRF error response formats:
 * - { detail: "message" }
 * - { error: "message" }
 * - { field: ["error1", "error2"] }
 * - { non_field_errors: ["error"] }
 *
 * @param error - Axios error object
 * @returns User-friendly error message
 */
export function parseApiError(error: unknown): string {
  const normalized = normalizeApiError(error)
  
  if (normalized.generalErrors.length > 0) {
    // If we have a generic message like "Invalid input." but also more specific general errors,
    // we might want to prioritize the specific ones.
    return normalized.generalErrors.join(' ')
  }

  if (Object.keys(normalized.fieldErrors).length > 0) {
    const fieldMessages = Object.entries(normalized.fieldErrors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ')
    return fieldMessages
  }

  return normalized.message
}

/**
 * Check if error is an AxiosError
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  )
}

/**
 * Check if the error is a tier/permission error (403)
 *
 * Use this to determine if you should show upgrade messaging
 */
export function isTierError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false
  }

  return error.response?.status === 403
}

/**
 * Check if the error is a validation error (400)
 */
export function isValidationError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false
  }

  return error.response?.status === 400
}

/**
 * Check if the error is auth error (401)
 */
export function isAuthError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false
  }

  return error.response?.status === 401
}

/**
 * Get upgrade message for tier errors
 *
 * Provides user-friendly upgrade guidance based on error
 */
export function getUpgradeMessage(error: unknown): string {
  if (!isTierError(error)) {
    return ''
  }

  const errorMessage = parseApiError(error).toLowerCase()

  // Check for specific tier mentions
  if (errorMessage.includes('starter')) {
    return 'Upgrade to Starter or Pro to unlock this feature.'
  }

  if (errorMessage.includes('pro')) {
    return 'Upgrade to Pro to unlock this feature.'
  }

  // Generic upgrade message
  return 'Upgrade your plan to access this feature.'
}

/**
 * Extract field-specific validation errors
 *
 * Returns a map of field names to error messages
 * Useful for mapping errors back to form fields
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!isAxiosError(error)) {
    return {}
  }

  const data = error.response?.data as ApiErrorResponse | undefined
  if (!data) {
    return {}
  }

  const fieldErrors: Record<string, string> = {}

  for (const [field, value] of Object.entries(data)) {
    // Skip known non-field keys
    if (field === 'detail' || field === 'error' || field === 'message') {
      continue
    }

    if (Array.isArray(value)) {
      fieldErrors[field] = value.join(', ')
    } else if (typeof value === 'string') {
      fieldErrors[field] = value
    }
  }

  return fieldErrors
}
