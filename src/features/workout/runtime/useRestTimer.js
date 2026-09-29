import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  cancelRestEndNotification,
  hasRestNotificationPermission,
  playRestDoneAlert,
  sendRestEndNotification,
} from '../../../shared/time/restAlerts';
import { countdownTimes, RestCountdown } from '../../../shared/time/restCountdown';

// Rest timer engine (RN-SPEC-time §7.2) plus [O4] background notifications and
// the [O13] lock-screen countdown. Wall-clock and self-correcting: a 500ms
// interval recomputes the remaining time from Date.now(), so throttling while
// backgrounded can't drift it.
export function useRestTimer({ onRestComplete, sessionId } = {}) {
  const [restTimer, setRestTimer] = useState(null);
  const [minimized, setMinimized] = useState(true);
  // §22.2: the dragged position lives here, so it survives later rests in the
  // same visit. ⚠W23 — it is never persisted, and the session ending resets it.
  const [timerPosition, setTimerPosition] = useState(null);

  const startRef = useRef({ setId: null, startMs: 0, total: 0 });
  const alertedRef = useRef(null);
  const expandedRef = useRef(null);
  const finalStretchRef = useRef(null);
  const backgroundedAtRef = useRef(null);
  const timerRef = useRef(restTimer);
  timerRef.current = restTimer;

  // [O4] rule 6. Bumped by every cancel, so a send that was already in flight
  // knows it has been superseded and removes itself. It removes only its OWN
  // token: every rest notification shares one identifier, and a blanket cancel
  // here could land after a newer send in the queue and kill it.
  const scheduleGenRef = useRef(0);

  // [O13] Whether this rest's lock-screen countdown was started, so every start
  // is paired with exactly one end. The countdown is bound to the REST: no
  // AppState transition starts or ends it (O13.3).
  const countdownRef = useRef(false);

  const endCountdown = useCallback(() => {
    if (countdownRef.current) {
      countdownRef.current = false;
      RestCountdown.end();
    }
  }, []);

  const cancelScheduled = useCallback(() => {
    scheduleGenRef.current += 1;
    cancelRestEndNotification();
  }, []);

  // [O4] rules 1, 1b, 2: (re)send for the current end instant. Rule 10's
  // remove-then-send inside sendRestEndNotification replaces whatever exists.
  const rescheduleNotification = useCallback(async (setId, endMs) => {
    scheduleGenRef.current += 1;
    const generation = scheduleGenRef.current;
    const sent = await sendRestEndNotification({ endMs, setId, source: 'scheduled' });
    if (sent && generation !== scheduleGenRef.current) {
      cancelRestEndNotification({ token: sent.token });
    }
  }, []);

  // The end instant the engine is currently counting down to.
  const currentEndMs = useCallback(() => startRef.current.startMs + startRef.current.total * 1000, []);

  const clearRestTimer = useCallback(() => {
    cancelScheduled();
    endCountdown();
    startRef.current = { setId: null, startMs: 0, total: 0 };
    setRestTimer(null);
  }, [cancelScheduled, endCountdown]);

  const startRestTimer = useCallback(
    ({ setId, restSeconds, nextSetKey }) => {
      cancelScheduled();
      // The widget opens minimized for a new rest; the effect below expands it once.
      setMinimized(true);
      alertedRef.current = null;
      expandedRef.current = null;
      finalStretchRef.current = null;
      setRestTimer({ setId, secondsLeft: restSeconds, totalSeconds: restSeconds, nextSetKey: nextSetKey || '' });
    },
    [cancelScheduled]
  );

  const adjustRestTimer = useCallback((delta) => {
    setRestTimer((current) => {
      if (!current) {
        return current;
      }
      const secondsLeft = delta < 0 ? Math.max(0, current.secondsLeft + delta) : current.secondsLeft + delta;
      return {
        ...current,
        secondsLeft,
        totalSeconds: Math.max(current.totalSeconds, secondsLeft),
      };
    });
  }, []);

  // Skip: highlight the next set, clear the timer, no alert (⚠T10).
  const skipRestTimer = useCallback(() => {
    const nextSetKey = timerRef.current?.nextSetKey;
    clearRestTimer();
    if (nextSetKey && onRestComplete) {
      onRestComplete(nextSetKey, { skipped: true });
    }
  }, [clearRestTimer, onRestComplete]);

  // The engine: rebase on a new set or an out-of-band change, then tick.
  useEffect(() => {
    if (!restTimer) {
      return undefined;
    }
    const now = Date.now();
    if (startRef.current.setId !== restTimer.setId) {
      startRef.current = { setId: restTimer.setId, startMs: now, total: restTimer.secondsLeft };
      const endMs = now + restTimer.secondsLeft * 1000;
      // [O13] Queued before the O4 send: A1 rule 13's order (countdown, then alert).
      countdownRef.current = true;
      RestCountdown.start({ ...countdownTimes({ endMs, totalSeconds: restTimer.totalSeconds }), setId: restTimer.setId });
      rescheduleNotification(restTimer.setId, endMs);
    } else {
      const elapsed = Math.floor((now - startRef.current.startMs) / 1000);
      if (Math.abs(restTimer.secondsLeft - (startRef.current.total - elapsed)) > 1) {
        // The ±5s buttons land here.
        startRef.current.total = restTimer.secondsLeft + elapsed;
        const endMs = startRef.current.startMs + startRef.current.total * 1000;
        // [O13] −5s to zero is not an update: it is the silent end, below.
        if (countdownRef.current && restTimer.secondsLeft > 0) {
          RestCountdown.update(countdownTimes({ endMs, totalSeconds: restTimer.totalSeconds }));
        }
        rescheduleNotification(restTimer.setId, endMs);
      }
    }

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        startRef.current.total - Math.floor((Date.now() - startRef.current.startMs) / 1000)
      );
      setRestTimer((current) => (current ? { ...current, secondsLeft: remaining } : current));
    }, 500);
    return () => clearInterval(interval);
  }, [restTimer, rescheduleNotification]);

  // End of rest.
  useEffect(() => {
    if (!restTimer || restTimer.secondsLeft > 0) {
      return;
    }
    const { setId, nextSetKey } = restTimer;
    const endMs = startRef.current.startMs + startRef.current.total * 1000;
    // Manual end: -5s took it to zero → silent, no onRestComplete (⚠T10).
    const naturalEnd = startRef.current.total > 0 && Date.now() >= endMs - 1000;

    if (alertedRef.current !== setId) {
      alertedRef.current = setId;
      if (naturalEnd) {
        // [O13.3] The foreground-zero order: the countdown ends BEFORE the parity
        // alert, so correctness never depends on the alert replacing it.
        endCountdown();
        // [O4] §5: if the background notification already alerted while we were
        // away, skip the foreground alert but keep the rest of the parity path.
        const alertedInBackground =
          backgroundedAtRef.current !== null && backgroundedAtRef.current < endMs && endMs <= Date.now();
        if (alertedInBackground) {
          hasRestNotificationPermission().then((granted) => {
            if (!granted) {
              playRestDoneAlert();
            }
          });
        } else {
          playRestDoneAlert();
        }
      }
    }
    clearRestTimer();
    if (naturalEnd && nextSetKey && onRestComplete) {
      onRestComplete(nextSetKey);
    }
  }, [restTimer, clearRestTimer, endCountdown, onRestComplete]);

  // Expand once per rest, and again for the final 10 seconds.
  useEffect(() => {
    if (!restTimer) {
      return;
    }
    if (expandedRef.current !== restTimer.setId) {
      expandedRef.current = restTimer.setId;
      setMinimized(false);
    }
    if (restTimer.secondsLeft <= 10 && finalStretchRef.current !== restTimer.setId) {
      finalStretchRef.current = restTimer.setId;
      setMinimized(false);
    }
  }, [restTimer]);

  // [O4] §3/§5: cancel on resume, and remember when we left the foreground.
  //
  // Leaving the foreground RE-ARMS the notification for the rest's current end
  // instant. O4 as written only schedules at rest start (§1) and on a ±5s rebase
  // (§2) but cancels on *every* resume (§3), which left a hole: once the app had
  // come back to the foreground even momentarily, the rest ran to its end with
  // nothing pending, so backgrounding again produced no alert. On iOS a mere
  // Control Centre pull or permission prompt is enough — it reports
  // inactive → active without the app ever really being backgrounded. Re-arming
  // here keeps every O4 invariant (at most one pending, never in the foreground)
  // and makes "backgrounded at any point during a rest" reliable.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        cancelScheduled();
        return;
      }
      backgroundedAtRef.current = Date.now();
      const running = timerRef.current;
      if (running && running.secondsLeft > 0 && startRef.current.setId === running.setId) {
        rescheduleNotification(running.setId, currentEndMs());
      }
    });
    return () => subscription.remove();
  }, [cancelScheduled, rescheduleNotification, currentEndMs]);

  // Unmounting the screen destroys the rest (⚠W17), its notification and its
  // countdown. A tab switch is not an unmount (§26.1): the rest survives it.
  useEffect(
    () => () => {
      cancelScheduled();
      endCountdown();
    },
    [cancelScheduled, endCountdown]
  );

  // §22.2: back to the centred default when the session ends or changes. The
  // page itself does not unmount on that switch, so this stands in for the
  // web's "the hub re-renders and the widget is gone".
  const sessionRef = useRef(sessionId);
  useEffect(() => {
    if (sessionRef.current !== sessionId) {
      sessionRef.current = sessionId;
      setTimerPosition(null);
    }
  }, [sessionId]);

  return {
    restTimer,
    minimized,
    setMinimized,
    startRestTimer,
    clearRestTimer,
    adjustRestTimer,
    skipRestTimer,
    timerPosition,
    setTimerPosition,
  };
}
