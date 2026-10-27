import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { adjustTimer, rebasedTotal, remainingSeconds } from './restEngine';
import { peekSession, restScreenMounted, restScreenUnmounted, sessionEntry } from './workoutSessionStore';

const TICK_MS = 500;

// Design system v1 #13: the screen-reader announcement, with the true number.
export function restAnnouncement(seconds) {
  return seconds === 1 ? '1 second left' : `${seconds} seconds left`;
}

// useRestTimer (RN-SPEC-time §7.2, RN-SPEC-workout §22).
// Lifecycle pairing D: the rest is cleared ONLY by a natural end, −5 s to
// zero, skip, un-completing the set, completing or discarding the workout, a
// new rest replacing it, and a genuine unmount. Never on blur or background.
// `alerts` (restAlerts.js) is told about every start, end move and clear, and
// plays the rest-done alert at a natural end (O4, A1).
// T-59 follow-up (27 Oct 2026, PM + reviewer): with a `sessionId` the rest
// lives in the session store (workoutSessionStore), so ANY remount of the
// screen — a font-scale remount, a rotation, leaving and coming back —
// resumes the same END time, and the alerts keep their one scheduled alert
// (nothing cleared or re-armed). Pairing D's "genuine unmount" clear then
// becomes the session's end (finish, abandon, sign-out, another session).
export default function useRestTimer({ onRestComplete, alerts, sessionId }) {
  const [stored] = useState(() => (sessionId ? sessionEntry(sessionId) : null));
  // Read once, at mount: the rest this screen resumes (or ends, if it ran out meanwhile).
  const [resumed] = useState(() => {
    const saved = stored?.rest;
    if (!saved) {
      return null;
    }
    const secondsLeft = remainingSeconds(saved.total, saved.startMs, Date.now());
    return { ...saved, secondsLeft, expired: secondsLeft <= 0 };
  });
  const live = resumed && !resumed.expired ? resumed : null;
  const [timer, setTimer] = useState(() =>
    live ? { setId: live.setId, secondsLeft: live.secondsLeft, totalSeconds: live.totalSeconds, nextSetKey: live.nextSetKey } : null
  );
  const [minimized, setMinimizedState] = useState(() => stored?.restUi.minimized ?? true);
  // §22.2: kept across rests within the session, never persisted.
  const [position, setPositionState] = useState(() => stored?.restUi.position ?? null);
  const startMs = useRef(resumed?.startMs ?? 0);
  const total = useRef(resumed?.total ?? 0);
  const currentSetId = useRef(live ? live.setId : null);
  const alerted = useRef(new Set(resumed?.alerted ?? []));
  const expandedFinal = useRef(live?.expandedFinal ?? false);
  const endedNaturally = useRef(false);
  const callbacks = useRef({ onRestComplete, alerts });
  callbacks.current = { onRestComplete, alerts };
  const endMs = () => startMs.current + total.current * 1000;

  const keepUi = useCallback(
    (key, setLocal) => (value) =>
      setLocal((previous) => {
        const next = typeof value === 'function' ? value(previous) : value;
        const entry = sessionId ? peekSession(sessionId) : null;
        if (entry) {
          entry.restUi[key] = next;
        }
        return next;
      }),
    [sessionId]
  );
  const [setMinimized] = useState(() => keepUi('minimized', setMinimizedState));
  const [setPosition] = useState(() => keepUi('position', setPositionState));

  const start = useCallback((setId, seconds, nextSetKey) => {
    setMinimized(true);
    setTimer({ setId, secondsLeft: seconds, totalSeconds: seconds, nextSetKey });
  }, []);

  const clear = useCallback(() => setTimer(null), []);

  const adjust = useCallback((delta) => setTimer((current) => (current ? adjustTimer(current, delta) : current)), []);

  // Every state change: a new set restarts the clock; otherwise a jump of
  // more than 1 s (±5) rebases it. −5 s to zero ends silently (⚠T10).
  useEffect(() => {
    if (!timer) {
      if (currentSetId.current !== null && !endedNaturally.current) {
        callbacks.current.alerts?.restCleared();
      }
      currentSetId.current = null;
      endedNaturally.current = false;
      return undefined;
    }
    const now = Date.now();
    if (timer.setId !== currentSetId.current) {
      currentSetId.current = timer.setId;
      // A new rest for a set that already alerted (done → undo → done)
      // alerts again: `alerted` only stops a double alert for one rest.
      alerted.current.delete(timer.setId);
      startMs.current = now;
      total.current = timer.secondsLeft;
      expandedFinal.current = false;
      // Opens minimized, then expands once per rest.
      setMinimized(false);
      callbacks.current.alerts?.restStarted(timer.setId, endMs(), timer.totalSeconds);
    } else {
      if (timer.secondsLeft <= 0) {
        setTimer(null);
        return undefined;
      }
      total.current = rebasedTotal(timer.secondsLeft, total.current, startMs.current, now);
      callbacks.current.alerts?.endMoved(endMs(), timer.totalSeconds);
    }
    // Once per rest, at the first moment ≤ 10 s however it gets there (a
    // natural tick, a short rest, −5 s); never again in that rest (not after
    // +5 s back above 10). A new rest resets it.
    if (timer.secondsLeft <= 10 && !expandedFinal.current) {
      expandedFinal.current = true;
      setMinimized(false);
      try {
        AccessibilityInfo.announceForAccessibility(restAnnouncement(timer.secondsLeft));
      } catch {
        // Best effort.
      }
    }
    const interval = setInterval(() => {
      const remaining = remainingSeconds(total.current, startMs.current, Date.now());
      if (remaining <= 0) {
        clearInterval(interval);
        if (!alerted.current.has(timer.setId)) {
          alerted.current.add(timer.setId);
          endedNaturally.current = true;
          callbacks.current.alerts?.restEnded(timer.setId, endMs());
        }
        if (timer.nextSetKey) {
          callbacks.current.onRestComplete?.(timer.nextSetKey);
        }
        setTimer(null);
        return;
      }
      setTimer((current) => (current && current.setId === timer.setId && current.secondsLeft !== remaining ? { ...current, secondsLeft: remaining } : current));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [timer]);

  // The session store follows every change (after the effect above set the clock).
  useEffect(() => {
    const entry = sessionId ? peekSession(sessionId) : null;
    if (!entry) {
      return;
    }
    entry.rest = timer
      ? {
          setId: timer.setId,
          startMs: startMs.current,
          total: total.current,
          totalSeconds: timer.totalSeconds,
          nextSetKey: timer.nextSetKey,
          expandedFinal: expandedFinal.current,
          alerted: [...alerted.current],
        }
      : null;
  }, [timer, sessionId]);

  // A rest that ran out while the screen was away ends naturally, once.
  useEffect(() => {
    if (!resumed?.expired) {
      return;
    }
    if (!alerted.current.has(resumed.setId)) {
      alerted.current.add(resumed.setId);
      callbacks.current.alerts?.restEnded(resumed.setId, resumed.startMs + resumed.total * 1000);
    }
    if (resumed.nextSetKey) {
      callbacks.current.onRestComplete?.(resumed.nextSetKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pairing D: a genuine unmount is the only native teardown. With a session
  // the rest outlives the screen; the session's end tears it down.
  useEffect(() => {
    if (stored) {
      restScreenMounted(sessionId);
    }
    return () => {
      if (stored) {
        // Away with a rest running: one server re-check before its end.
        restScreenUnmounted(sessionId);
      } else if (currentSetId.current !== null) {
        callbacks.current.alerts?.restCleared();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { timer, start, clear, adjust, minimized, setMinimized, position, setPosition };
}
