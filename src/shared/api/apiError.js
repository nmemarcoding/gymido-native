// True when the request never got an HTTP response (offline, timeout, unreachable host).
export function isNetworkError(error) {
  return Boolean(error?.isAxiosError) && !error.response;
}

// API `message`, else `errors.<field>[0]`, else the fallback.
export function getApiErrorMessage(error, fallback, field) {
  const data = error?.response?.data;
  if (typeof data?.message === 'string' && data.message.length > 0) {
    return data.message;
  }
  const fieldErrors = field ? data?.errors?.[field] : undefined;
  if (Array.isArray(fieldErrors) && typeof fieldErrors[0] === 'string') {
    return fieldErrors[0];
  }
  return fallback;
}

const WEB_FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

// Exact port of the web app's getApiErrorMessage (shared/utils/apiError.js):
// API `message`, else the first entry of the first `errors` key, else the
// transport message, else a generic fallback. A 422 therefore reads
// "Validation failed" (RN-SPEC-plans ⚠3). Never returns an empty string.
export function getWebApiErrorMessage(error) {
  const data = error?.response?.data;
  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message;
  }
  if (data?.errors && typeof data.errors === 'object') {
    const firstField = Object.keys(data.errors)[0];
    const firstError = data.errors[firstField]?.[0];
    if (firstError) {
      return firstError;
    }
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return WEB_FALLBACK_MESSAGE;
}
