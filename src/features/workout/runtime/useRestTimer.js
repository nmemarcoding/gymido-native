import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { adjustTimer, rebasedTotal, remainingSeconds } from './restEngine';

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
export default function useRestTimer({ onRestComplete, alerts }) {
  const [timer, setTimer] = useState(null);
  const [minimized, setMinimized] = useState(true);
  // §22.2: kept across rests within the session, never persisted.
  const [position, setPosition] = useState(null);
  const startMs = useRef(0);
  const total = useRef(0);
  const currentSetId = useRef(null);
  const alerted = useRef(new Set());
  const expandedFinal = useRef(false);
  const endedNaturally = useRef(false);
  const callbacks = useRef({ onRestComplete, alerts });
  callbacks.current = { onRestComplete, alerts };
  const endMs = () => startMs.current + total.current * 1000;

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

  // Pairing D: a genuine unmount is the only native teardown.
  useEffect(
    () => () => {
      if (currentSetId.current !== null) {
        callbacks.current.alerts?.restCleared();
      }
    },
    []
  );

  return { timer, start, clear, adjust, minimized, setMinimized, position, setPosition };
}
