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

export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

// "The server message" of the trainer plans spec §A3.6: `message`, else the
// first message of the first `errors` key, else the transport error text
// (Axios: "Network Error", "Request failed with status code 500", ...).
export function getServerMessage(error) {
  const data = error?.response?.data;
  if (typeof data?.message === 'string' && data.message.trim().length > 0) {
    return data.message;
  }
  const firstKey = data?.errors && typeof data.errors === 'object' ? Object.keys(data.errors)[0] : undefined;
  const firstErrors = firstKey ? data.errors[firstKey] : undefined;
  const first = Array.isArray(firstErrors) ? firstErrors[0] : firstErrors;
  if (typeof first === 'string' && first.length > 0) {
    return first;
  }
  if (typeof error?.message === 'string' && error.message.length > 0) {
    return error.message;
  }
  return DEFAULT_ERROR_MESSAGE;
}

export function getStatus(error) {
  return error?.response?.status;
}

// Trainer plans spec §A3.7 (C4), for the plan builder's add/edit toasts:
// a 404 with a not-yours copy → that copy; a 422 with `errors` → the first
// non-empty value in key order (its first item when it's an array); else the
// server message, or `fallback`.
export function builderMessage(error, fallback = 'Please try again.', notYoursCopy) {
  const status = getStatus(error);
  if (status === 404 && notYoursCopy) {
    return notYoursCopy;
  }
  const errors = error?.response?.data?.errors;
  if (status === 422 && errors && typeof errors === 'object') {
    for (const key of Object.keys(errors)) {
      const value = Array.isArray(errors[key]) ? errors[key][0] : errors[key];
      if (value) {
        return value;
      }
    }
  }
  const message = getServerMessage(error);
  return message === DEFAULT_ERROR_MESSAGE ? fallback : message;
}
