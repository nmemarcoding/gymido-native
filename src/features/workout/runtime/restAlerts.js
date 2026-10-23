import { Platform, Vibration } from 'react-native';

import { restCountdown } from '../../../shared/time/restCountdown';

// Rest-end alerts: the §7.2 parity alert plus Owner override O4, amendments
// A1 (remove-then-send) and A2 (exact alarms, offered once), and the O13 live
// countdown, which shares A1's serial queue (O13.5 A). RN-SPEC-time.
// Everything platform-specific goes through `platform` (restAlertPlatform.js),
// so this module stays plain and testable.

// A1 rule 9.
export const REST_NOTIFICATION_ID = 'gymido.rest';
export const REST_END_KIND = 'rest-end';
export const REST_CHANNEL_ID = 'rest-timer';
// Q4 (frontend, 23 Oct 2026): Android's foreground banner posts on its own
// HIGH channel with no sound or vibration, so it heads up silently.
export const REST_BANNER_CHANNEL_ID = 'rest-timer-banner';
export const EXACT_ALARM_OFFERED_KEY = 'gymido.exactAlarmOffered';
// §7.2 asked-once guard: the same key as the 28 Sep build, so a device that
// already answered there is not asked again.
export const NOTIFICATION_PERMISSION_ASKED_KEY = 'gymido.notificationPermissionAsked';
export const REST_TITLE = 'Rest complete';
export const REST_BODY = 'Time for your next set.';

// Until expo-notifications and expo-audio are installed: no permission, so
// O4 does nothing and only the Android vibration remains (§7.2 step 2).
export const NO_PLATFORM = {
  getPermission: async () => 'denied',
  requestPermission: async () => 'denied',
  getScheduled: async () => [],
  getPresented: async () => [],
  cancelScheduled: async () => {},
  dismiss: async () => {},
  schedule: async () => {},
  playBeep: () => {},
  canScheduleExactAlarms: async () => null,
  openExactAlarmSettings: () => {},
  readOffered: async () => true,
  markOffered: async () => {},
};

// O4 rule 4, corrected by A1: keyed on `source`, not `kind` alone.
export function restNotificationBehavior(data, appState) {
  if (data?.kind === REST_END_KIND && data.source === 'foreground') {
    return { shouldShowBanner: true, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
  }
  if (data?.kind === REST_END_KIND && data.source === 'scheduled' && appState === 'active') {
    return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
  }
  return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
}

// O4 rule 5: the background notification already alerted for this end, i.e.
// the app left the foreground before endMs and was still away at endMs.
export function deliveredWhileAway(away, endMs) {
  return Boolean(away?.granted) && away.backgroundedAtMs != null && away.backgroundedAtMs < endMs && endMs <= away.resumedAtMs;
}

// Rule 5 must not depend on whether the first rest tick after a resume runs
// before or after the AppState 'active' event. Still away (that event hasn't
// arrived) → the current excursion is open and "resumed" is now; back → the
// recorded excursion. (Adapted from the 28 Sep build, which used
// backgroundedAt < endMs <= now but then also skipped a rest that ended in
// the foreground after an earlier, already finished excursion.)
export function awayAtEnd({ state, away, backgroundedAtMs, lastGranted, nowMs }) {
  if (state === 'active') {
    return away;
  }
  return { backgroundedAtMs, resumedAtMs: nowMs, granted: lastGranted };
}

// A2 rule 2. `canExact` is null when it can't be read, which never offers.
export function shouldOfferExactAlarm({ os, apiLevel, canExact, granted, requestedNow, offered }) {
  return os === 'android' && apiLevel >= 31 && canExact === false && granted && !requestedNow && !offered;
}

export function restNotificationRequest({ source, setId, endMs, token }, os = Platform.OS) {
  const data = { kind: REST_END_KIND, source, setId, token };
  if (source === 'foreground') {
    // §7.2 step 3: immediate, and no `sound` (decision 28 Sep 2026). iOS
    // keeps trigger null; Android names the banner channel (Q4).
    const trigger = os === 'android' ? { channelId: REST_BANNER_CHANNEL_ID } : null;
    return { identifier: REST_NOTIFICATION_ID, content: { title: REST_TITLE, body: REST_BODY, data }, trigger };
  }
  return {
    identifier: REST_NOTIFICATION_ID,
    content: { title: REST_TITLE, body: REST_BODY, sound: 'default', data },
    trigger: { type: 'date', date: endMs, channelId: REST_CHANNEL_ID },
  };
}

// A1 rules 10, 12 and 14. Every operation runs through one serial queue,
// each awaiting the previous; a failure never blocks the next one.
export function createRestNotifier(platform, makeToken) {
  let queue = Promise.resolve();
  const enqueue = (op) => {
    const run = queue.then(op);
    queue = run.catch(() => {});
    return run;
  };

  // Snapshot first, then remove every match, awaited (rule 10 steps 1–2).
  async function removeWhere(match) {
    const pending = (await platform.getScheduled()).filter((item) => match(item?.content?.data));
    const delivered = (await platform.getPresented()).filter((item) => match(item?.request?.content?.data));
    await Promise.all([
      ...pending.map((item) => platform.cancelScheduled(item.identifier)),
      ...delivered.map((item) => platform.dismiss(item.request.identifier)),
    ]);
  }

  const isRestEnd = (data) => data?.kind === REST_END_KIND;

  return {
    // Rule 10. Resolves to the send's token once it has been scheduled.
    send({ source, setId, endMs }) {
      const token = makeToken();
      return enqueue(async () => {
        await removeWhere(isRestEnd);
        await platform.schedule(restNotificationRequest({ source, setId, endMs, token }));
        return token;
      });
    },
    // Rule 3: no rest-end notification survives.
    cancelAll() {
      return enqueue(() => removeWhere(isRestEnd));
    },
    // Rule 14: only this send's own notification.
    cancelToken(token) {
      return enqueue(() => removeWhere((data) => isRestEnd(data) && data.token === token));
    },
    // Any other rest-notification operation (the O13 countdown).
    run(op) {
      return enqueue(op);
    },
  };
}

// The O4 lifecycle. useRestTimer reports the rest's events, useRestAlerts
// reports AppState; this decides what to schedule, cancel and play.
export function createRestAlertController({
  platform,
  now = () => Date.now(),
  os = Platform.OS,
  apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0,
  vibrate = (pattern) => Vibration.vibrate(pattern),
  onOfferExactAlarm = () => {},
  appState = 'active',
  countdown = restCountdown,
}) {
  let tokens = 0;
  const makeToken = () => `rest-${Date.now()}-${(tokens += 1)}`;
  const notifier = createRestNotifier(platform, makeToken);
  let rest = null;
  let state = appState;
  let away = null;
  let backgroundedAtMs = null;
  // The newest permission answer, kept only so rule 5 can decide
  // synchronously on resume; every send re-reads it.
  let lastGranted = false;
  let disposed = false;

  const readPermission = async () => {
    const status = await platform.getPermission().catch(() => 'denied');
    lastGranted = status === 'granted';
    return status;
  };
  const granted = async () => (await readPermission()) === 'granted';

  // Rule 6 with rule 14: a send that resolves after its state went stale
  // cancels only itself. It is stale once its rest has moved on, or when it
  // was sent away from the foreground and the app is back.
  function scheduleRest() {
    const snapshot = rest;
    const sentAway = state !== 'active';
    notifier
      .send({ source: 'scheduled', setId: snapshot.setId, endMs: snapshot.endMs })
      .then((token) => {
        if (rest !== snapshot || (sentAway && state === 'active')) {
          notifier.cancelToken(token);
        }
      })
      .catch(() => {});
  }

  // O13: never touched by AppState. barStartMs = endMs − totalSeconds, so
  // the bar matches the in-app ring.
  const countdownOptions = (current) => ({
    barStartMs: current.endMs - current.totalSeconds * 1000,
    endMs: current.endMs,
    setId: String(current.setId),
    token: makeToken(),
  });
  const endCountdown = () => notifier.run(() => countdown.end()).catch(() => {});

  // O13.3 start, A1 rule 13's order: the previous rest's countdown goes
  // first, awaited; the alert is sent after. Skipped if the rest moved on.
  function startCountdown(setId) {
    notifier
      .run(async () => {
        await countdown.end();
        // M1: never post a countdown whose end has already passed (a start
        // queued behind a slow permission prompt); it would never clear.
        if (rest?.setId === setId && rest.endMs > now()) {
          await countdown.start(countdownOptions(rest));
        }
      })
      .catch(() => {});
  }

  return {
    // O4 rule 1, with the §7.2 permission request at the same moment, then
    // A2's one-time offer after the rest has started.
    // O13's countdown follows the permission answer (Android needs it) but
    // doesn't depend on it (iOS Live Activities don't).
    async restStarted(setId, endMs, totalSeconds) {
      rest = { setId, endMs, totalSeconds };
      const mine = rest;
      let status = await readPermission();
      let requestedNow = false;
      if (status === 'undetermined') {
        requestedNow = true;
        status = await platform.requestPermission().catch(() => 'denied');
        lastGranted = status === 'granted';
      }
      if (rest !== mine || disposed) {
        return;
      }
      startCountdown(setId);
      if (status !== 'granted') {
        return;
      }
      scheduleRest();
      if (os !== 'android' || apiLevel < 31) {
        return;
      }
      const offered = await platform.readOffered().catch(() => true);
      const canExact = await platform.canScheduleExactAlarms().catch(() => null);
      // Same rest (a ±5 s adjust replaces the object, not the rest).
      if (rest?.setId === setId && !disposed && shouldOfferExactAlarm({ os, apiLevel, canExact, granted: true, requestedNow, offered })) {
        // A2 rule 4: recorded the moment it is shown.
        platform.markOffered().catch(() => {});
        onOfferExactAlarm();
      }
    },

    // O4 rule 2, and O13.3's ±5s update (iOS swaps, Android re-posts;
    // neither if the user dismissed it).
    async endMoved(endMs, totalSeconds) {
      if (!rest || (rest.endMs === endMs && rest.totalSeconds === totalSeconds)) {
        return;
      }
      rest = { ...rest, endMs, totalSeconds };
      const mine = rest;
      if (endMs <= now()) {
        endCountdown();
        notifier.cancelAll();
        return;
      }
      notifier
        .run(async () => {
          if (rest === mine) {
            await countdown.update(countdownOptions(mine));
          }
        })
        .catch(() => {});
      if ((await granted()) && rest === mine) {
        scheduleRest();
      }
    },

    // O4 rule 3: every clear except the natural end.
    restCleared() {
      if (!rest) {
        return;
      }
      rest = null;
      endCountdown();
      notifier.cancelAll();
    },

    // §7.2 natural end. Rule 3's cancel is the foreground send's own removal
    // step; a separate cancel would dismiss the parity banner it just posted.
    // O13.3 foreground zero: the countdown ends before the alert, always.
    async restEnded(setId, endMs) {
      rest = null;
      endCountdown();
      if (deliveredWhileAway(awayAtEnd({ state, away, backgroundedAtMs, lastGranted, nowMs: now() }), endMs)) {
        notifier.cancelAll();
        return;
      }
      platform.playBeep();
      if (os === 'android') {
        vibrate([0, 200, 100, 200]);
      }
      if (await granted()) {
        // Never stale: it is the alert for a rest that has already ended.
        notifier.send({ source: 'foreground', setId, endMs }).catch(() => {});
      } else {
        notifier.cancelAll();
      }
    },

    // O4 rules 1b, 3 and 5. 1b and the resume cancel are a pair.
    async appStateChanged(next) {
      const previous = state;
      state = next;
      if (previous === 'active' && next !== 'active') {
        backgroundedAtMs = now();
        const mine = rest;
        if (mine && (await granted()) && rest === mine && state !== 'active') {
          scheduleRest();
        }
      } else if (previous !== 'active' && next === 'active') {
        away = { backgroundedAtMs, resumedAtMs: now(), granted: lastGranted };
        notifier.cancelAll();
      }
    },

    // Paired with dispose(): an effect that re-runs on the same controller
    // (a dev Fast Refresh) must bring it back, or every later rest is ignored.
    activate() {
      disposed = false;
    },

    dispose() {
      disposed = true;
      this.restCleared();
    },
  };
}
