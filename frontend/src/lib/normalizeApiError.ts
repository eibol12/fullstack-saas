import axios from 'axios';

export type ApiFormErrors = Record<string, string[]>;

export interface NormalizedApiError {
  code?: string;
  message: string;
  fieldErrors: ApiFormErrors;
  generalErrors: string[];
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Normalizes API errors from Axios or fetch into a consistent structure.
 * Prevents React crashes by ensuring no raw objects are returned for rendering.
 */
export function normalizeApiError(err: any): NormalizedApiError {
  const result: NormalizedApiError = {
    message: FALLBACK_MESSAGE,
    fieldErrors: {},
    generalErrors: [],
  };

  if (!err) {
    return result;
  }

  if (axios.isAxiosError(err)) {
    const { response, request } = err;

    if (response) {
      const data = response.data;

      // Handle 500+ errors
      if (response.status >= 500) {
        result.message = 'Server error. Please try again later.';
        result.generalErrors = [result.message];
        return result;
      }

      if (data && typeof data === 'object') {
        // Handle "error" wrapper if present
        const errorContent = data.error && typeof data.error === 'object' ? data.error : data;

        if (errorContent.code) result.code = String(errorContent.code);
        if (errorContent.message) result.message = String(errorContent.message);

        // Map details or fallback to the error content itself
        const details = errorContent.details || errorContent;
        
        if (details && typeof details === 'object') {
          Object.keys(details).forEach((key) => {
            const value = details[key];
            if (key === 'non_field_errors' || key === 'detail') {
              if (Array.isArray(value)) {
                result.generalErrors.push(...value.map((v) => String(v)));
              } else {
                result.generalErrors.push(String(value));
              }
            } else if (key !== 'code' && key !== 'message' && key !== 'details') {
              if (Array.isArray(value)) {
                result.fieldErrors[key] = value.map((v) => String(v));
              } else {
                result.fieldErrors[key] = [String(value)];
              }
            }
          });
        }
      } else if (typeof data === 'string') {
        result.message = data;
        result.generalErrors = [data];
      }
    } else if (request) {
      // Network error
      result.message = 'Network error. Please check your connection.';
      result.generalErrors = [result.message];
    } else {
      result.message = err.message || FALLBACK_MESSAGE;
    }
  } else if (err instanceof Error) {
    result.message = err.message;
  } else if (typeof err === 'string') {
    result.message = err;
  }

  // Ensure message is added to generalErrors if it was not already caught and generalErrors is empty
  // but only if it's not the generic fallback or "Invalid input." if we have field errors.
  if (result.generalErrors.length === 0 && result.message && result.message !== FALLBACK_MESSAGE) {
     // If it's a generic "Invalid input." and we have field errors, maybe don't add to generalErrors
     // to avoid clutter. But for safety, we can add it.
     if (result.message !== 'Invalid input.' || Object.keys(result.fieldErrors).length === 0) {
       result.generalErrors.push(result.message);
     }
  }

  return result;
}
