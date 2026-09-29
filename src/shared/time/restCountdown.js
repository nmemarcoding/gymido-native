import nativeModule from '../../../modules/rest-countdown';
import { enqueueRestOperation, removeRestNotifications } from './restAlerts';

// O13 (RN-SPEC-time): the live rest countdown on the lock screen.
//   iOS      a self-ending Live Activity, Lock Screen only, gone at zero;
//   Android  an ongoing count-down chronometer notification in the rest slot.
//
// Bound to the REST, never to foreground state: useRestTimer calls start when a
// rest starts, update on ±5s, and end on every event that clears the rest. No
// AppState transition touches it (unlike O4's alert).
//
// Every operation runs through A1's single rest-notification queue (O13.5 A),
// so rest events apply in order across the countdown and the alert. Best
// effort, like every rest alert: a failure here never breaks the timer, and an
// absent module (Jest, or an older build) means "not enabled".

let native = nativeModule;
let tokenCounter = 0;

// A fresh token per post, as in A1 rule 14 (Android extras; never rendered).
function nextToken() {
  tokenCounter += 1;
  return `countdown-${tokenCounter}`;
}

async function call(operation) {
  if (!native) {
    return null;
  }
  try {
    return await operation(native);
  } catch {
    return null;
  }
}

// O13.4: iOS areActivitiesEnabled; Android notifications permitted. Never
// requests anything.
async function isEnabled() {
  return Boolean(await call((module) => module.isEnabled()));
}

export const RestCountdown = {
  isEnabled,

  // A new rest, in A1 rule 13's order: remove the previous rest's rest-end
  // notification (by kind) and countdown, then post this one. The caller
  // sends the rest-end alert next, through the same queue.
  start({ barStartMs, endMs, setId }) {
    return enqueueRestOperation(async () => {
      await removeRestNotifications();
      await call((module) => module.end());
      if (await isEnabled()) {
        await call((module) => module.start(barStartMs, endMs, String(setId ?? ''), nextToken()));
      }
    });
  },

  // ±5s. iOS replaces its ended card; Android re-posts in place. Both only if
  // the current one is still there: swiped away, it stays gone for this rest.
  update({ barStartMs, endMs }) {
    return enqueueRestOperation(() => call((module) => module.update(barStartMs, endMs, nextToken())));
  },

  // Every rest-clearing event and the launch sweep. Immediate; on Android
  // targeted, so O4's alert in the slot is left alone (O13.5 C).
  end() {
    return enqueueRestOperation(() => call((module) => module.end()));
  },
};

// barStartMs = endMs − totalSeconds, so the bar matches the in-app ring. It is
// deliberately not `startMs`: the engine's own startMs rebases differently.
export function countdownTimes({ endMs, totalSeconds }) {
  return { barStartMs: endMs - totalSeconds * 1000, endMs };
}

// Test hook.
export function setRestCountdownModuleForTest(module) {
  native = module;
  tokenCounter = 0;
}
