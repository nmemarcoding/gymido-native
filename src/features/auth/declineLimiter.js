const WINDOW_MS = 60_000;
const SILENT_LIMIT = 3;

// Counts cancelled/declined sign-ins. Fewer than 3 within 60 seconds are
// recovered silently; the 3rd and later show the Sign-in failed card.
// In memory for the app process, replacing web's sessionStorage counter.
export function createDeclineLimiter({ windowMs = WINDOW_MS, limit = SILENT_LIMIT } = {}) {
  let timestamps = [];

  return {
    record(now = Date.now()) {
      timestamps = timestamps.filter((timestamp) => now - timestamp < windowMs);
      timestamps.push(now);
      return timestamps.length < limit ? 'silent' : 'fail';
    },
  };
}

export const declineLimiter = createDeclineLimiter();
