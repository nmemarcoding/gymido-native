import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { AuthStatus, useAuthStore } from '../../auth/authStore';
import { getCurrentWorkout } from '../api/workoutApi';

// T-59 follow-up (PM + reviewer, 27 Oct 2026): the live workout session's
// runtime state outlives ANY remount of the Workout screen (a font-scale
// remount, a tablet rotation, a navigation remount, leaving and coming
// back): the rest (set, start, total → its END time), the rest timer's
// minimized / position, the unlogged set drafts and the rest-alert
// controller holding the one scheduled alert and lock-screen countdown.
// One session at a time. It ends (the controller disposed) when the
// session ends (finish, abandon incl. a 409, ended elsewhere), on sign-out,
// and when another session's screen mounts.
let entry = null;

function newEntry(sessionId) {
  return {
    sessionId,
    controller: null,
    unsubscribe: null,
    // The mount that currently owns the controller's dialog callbacks.
    listeners: {},
    rest: null,
    restUi: { minimized: true, position: null },
    values: {},
    // One server re-check before a rest ends while the screen is away.
    checkTimer: null,
  };
}

// The session's entry, created for a new session (ending any other one).
export function sessionEntry(sessionId) {
  if (entry && entry.sessionId !== sessionId) {
    endSessionState();
  }
  if (!entry) {
    entry = newEntry(sessionId);
  }
  return entry;
}

// The session's entry if it is the live one; never creates one (writes after
// the session ended must not bring it back).
export function peekSession(sessionId) {
  return entry && entry.sessionId === sessionId ? entry : null;
}

export function endSessionState() {
  const ended = entry;
  entry = null;
  clearTimeout(ended?.checkTimer);
  ended?.unsubscribe?.();
  ended?.controller?.dispose();
}

// Reviewer (T-59): the server's view wins. A load that finds no active
// session, or another one, ends the stored one, so its scheduled rest alert
// (ended on web or another device, auto-ended) never fires late.
export function reconcileSessionState(activeSessionId) {
  if (entry && String(entry.sessionId) !== String(activeSessionId ?? '')) {
    endSessionState();
  }
}

// PM (realistic case): after the session ends elsewhere the user often stays
// on Today or leaves the app, so the Workout loader never runs. These ask the
// server themselves, only while a session is stored; a failed request keeps
// it (no proof it ended). A rest whose end passes while the app stays in the
// background the whole time is beyond app code: the OS shows its notification.
export async function verifySessionState({ fetchCurrent = getCurrentWorkout } = {}) {
  const checked = entry;
  if (!checked) {
    return;
  }
  let current;
  try {
    current = await fetchCurrent();
  } catch {
    return;
  }
  if (entry === checked) {
    reconcileSessionState(current?.id ?? null);
  }
}

// Coming back to the foreground re-checks.
export function handleAppStateChange(next, options) {
  return next === 'active' ? verifySessionState(options) : Promise.resolve();
}

// The Workout screen left with a rest running: one re-check 5 s before its
// end (a remount, or the session's end, cancels it).
export function restScreenUnmounted(sessionId, options) {
  const current = peekSession(sessionId);
  if (!current?.rest) {
    return;
  }
  clearTimeout(current.checkTimer);
  const endMs = current.rest.startMs + current.rest.total * 1000;
  current.checkTimer = setTimeout(() => verifySessionState(options), Math.max(0, endMs - 5000 - Date.now()));
}

export function restScreenMounted(sessionId) {
  const current = peekSession(sessionId);
  if (current) {
    clearTimeout(current.checkTimer);
    current.checkTimer = null;
  }
}

// useState whose value lives in the session entry (e.g. the set drafts).
export function useSessionValue(sessionId, key, initial) {
  const [value, setLocal] = useState(() => {
    const current = sessionEntry(sessionId);
    return key in current.values ? current.values[key] : initial;
  });
  const setValue = useCallback(
    (next) =>
      setLocal((previous) => {
        const resolved = typeof next === 'function' ? next(previous) : next;
        const current = peekSession(sessionId);
        if (current) {
          current.values[key] = resolved;
        }
        return resolved;
      }),
    [sessionId, key]
  );
  return [value, setValue];
}

AppState.addEventListener('change', (next) => {
  handleAppStateChange(next);
});

useAuthStore.subscribe((state) => {
  if (state.status === AuthStatus.signedOut && entry) {
    endSessionState();
  }
});
