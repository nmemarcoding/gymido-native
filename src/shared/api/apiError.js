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
