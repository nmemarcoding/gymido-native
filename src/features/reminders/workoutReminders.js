import { AppState } from 'react-native';

import { AuthStatus, useAuthStore } from '../auth/authStore';
import { openShellPath, shellNavigation } from '../shell/shellLinks';
import { isTrainerUser } from '../shell/shellRules';
import { saveWorkspacePreference } from '../shell/shellUiStore';
import { Workspace } from '../workspace/workspace';
import { requestPermissionAtWorkoutStart } from '../workout/runtime/restAlerts';
import { isReminder } from './reminderPlan';
import { addReminderTapListener, lastReminderTap, reminderApi, reminderPlatform } from './reminderPlatform';
import { onReminderSignal, registerReminderActions } from './reminderSignals';
import { createReminderSync } from './reminderSync';
import { getPreference, setPreference } from '../../shared/storage/preferences';
import { isWorkoutRemindersOn, loadWorkoutReminders, setReminderLastSync, setReminderPermission, useWorkoutReminders } from './workoutReminderSetting';

const SIGNED_OUT = new Set([AuthStatus.signedOut, AuthStatus.accountUnavailable]);
// Review M1: who is signed in isn't known yet; a sync then changes nothing.
const AUTH_PENDING = new Set([AuthStatus.restoring, AuthStatus.authenticating, AuthStatus.loadingUser]);

let controller = null;
let cleanups = [];

// T-172 fix a: a sync whose plan read failed (with no cached plan to fall
// back on) tries again after these delays, on top of every foreground.
export const REMINDER_RETRY_DELAYS_MS = Object.freeze([5000, 20000, 60000]);
// T-172 fix b: the last good GET /my-plans/current, for the signed-in user
// only (another account on this device never schedules from it); cleared on
// sign-out. Plan data, no secrets.
export const REMINDER_PLAN_CACHE_KEY = 'gymido.reminderPlanCache';
// T-172 fix d: the last sync's outcome ({ at, count, source, reason, status }),
// so "why no reminder" can be read on the device.
export const REMINDER_LAST_SYNC_KEY = 'gymido.reminderLastSync';

// Review M1: the token's `sub` is set on both paths (online /auth/me and the
// offline cold start, authService.js:61/:74); user.id exists only online.
const userKey = (state = useAuthStore.getState()) => String(state.claims?.sub ?? '');

export const reminderPlanCache = {
  // Review L1: the sync reads the owner once, at its start, and passes it to
  // load / save, so a sign-in switch during the request never files A's plan
  // under B.
  owner: () => userKey(),
  // undefined = nothing cached for this user; null = the last read said "no plan".
  async load(owner = userKey()) {
    const stored = owner ? await getPreference(REMINDER_PLAN_CACHE_KEY) : null;
    if (!stored) {
      return undefined;
    }
    const parsed = JSON.parse(stored);
    return parsed?.owner === owner ? parsed.current : undefined;
  },
  async save(current, owner = userKey()) {
    if (owner) {
      await setPreference(REMINDER_PLAN_CACHE_KEY, JSON.stringify({ owner, current: current ?? null }));
    }
  },
  clear() {
    return setPreference(REMINDER_PLAN_CACHE_KEY, '');
  },
};

function reportSync(entry) {
  const lastSync = { at: new Date().toISOString(), ...entry };
  setReminderLastSync(lastSync);
  setPreference(REMINDER_LAST_SYNC_KEY, JSON.stringify(lastSync)).catch?.(() => {});
  if (__DEV__ && !entry.count) {
    console.info('[reminders] scheduled 0:', entry.reason, entry.status ?? '');
  }
}

// T-136 (owner, 29 Oct 2026): a trainer gets them too, from their own plan
// (the personal side), exactly as a member.
function isSignedIn(state = useAuthStore.getState()) {
  return state.status === AuthStatus.signedIn;
}

// UX ruling §5: a tap opens the personal Today; a trainer in trainer mode is
// switched to the personal side first (the mode switch's own steps, §6.2).
export function openPersonalToday() {
  if (useAuthStore.getState().workspace === Workspace.trainer) {
    saveWorkspacePreference(Workspace.member);
  }
  openShellPath('/');
}

// T-103, once at startup (App.js). Reschedules on every app open and
// foreground, on sign-in, on a Settings change and on a plan or schedule
// change; clears everything on sign-out. A tap on a reminder opens Today.
export function startWorkoutReminders({
  platform = reminderPlatform,
  api = reminderApi,
  appState = AppState,
  openToday = openPersonalToday,
  navigation = shellNavigation,
  cache = reminderPlanCache,
  retryDelays = REMINDER_RETRY_DELAYS_MS,
} = {}) {
  if (controller) {
    return controller;
  }
  const allowed = async () => {
    if (AUTH_PENDING.has(useAuthStore.getState().status)) {
      return null;
    }
    if (!isSignedIn() || !isWorkoutRemindersOn()) {
      return false;
    }
    const permission = await platform.getPermission().catch(() => 'denied');
    setReminderPermission(permission);
    return permission === 'granted';
  };
  // Review L4: today's completions from this app (the complete response's
  // session), kept for the process; the sync counts them even when its
  // workouts read fails right after the finish.
  const finishedHere = [];
  const sync = createReminderSync({ platform, api, allowed, localCompleted: () => finishedHere, cache, onReport: reportSync });
  // T-172 fix a: a failed sync retries with backoff (5 s, 20 s, 60 s); any
  // sync that succeeds, or a sign-out, resets it.
  let retryTimer = null;
  let retryAttempt = 0;
  const stopRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };
  const resync = () =>
    sync.sync().then(
      (result) => {
        retryAttempt = 0;
        stopRetry();
        return result;
      },
      () => {
        if (!retryTimer && retryAttempt < retryDelays.length) {
          retryTimer = setTimeout(() => {
            retryTimer = null;
            resync();
          }, retryDelays[retryAttempt]);
          retryAttempt += 1;
        }
      }
    );

  // UX ruling §5: Today's root, after sign-in when signed out.
  let tapPending = false;
  const openPendingTap = () => {
    if (!tapPending || !isSignedIn()) {
      return;
    }
    if (navigation.isReady()) {
      tapPending = false;
      openToday();
    }
  };
  const onTap = (response) => {
    const request = response?.notification?.request;
    if (!isReminder(request?.content?.data)) {
      return;
    }
    platform.dismiss(request.identifier)?.catch?.(() => {});
    tapPending = true;
    openPendingTap();
  };

  const loaded = loadWorkoutReminders().catch(() => {});
  loaded.then(resync);
  lastReminderTap().then((response) => response && onTap(response));
  cleanups = [addReminderTapListener(onTap), navigation.addListener?.('state', openPendingTap)];

  const unsubscribeAuth = useAuthStore.subscribe((state, previous) => {
    if (state.status === previous.status && state.user === previous.user) {
      return;
    }
    if (SIGNED_OUT.has(state.status)) {
      stopRetry();
      retryAttempt = 0;
      sync.clearAll().catch(() => {});
      Promise.resolve()
        .then(() => cache?.clear?.())
        .catch(() => {});
    } else if (state.status === AuthStatus.signedIn) {
      loaded.then(resync);
      openPendingTap();
    }
  });
  const unsubscribeSetting = useWorkoutReminders.subscribe((state, previous) => {
    if (state.enabled !== previous.enabled) {
      resync();
    }
  });
  const appStateSubscription = appState.addEventListener('change', (next) => {
    if (next === 'active') {
      resync();
    }
  });
  const unsubscribeSignals = onReminderSignal((signal, payload) => {
    if (signal === 'workoutFinished' && payload?.started_at) {
      finishedHere.push(payload);
    }
    if (signal === 'workoutFinished' || signal === 'planChanged') {
      resync();
    }
    // T-172 fix c: the workout-start permission moment (WorkoutScreen) grants
    // outside this controller; read it again and schedule right away.
    if (signal === 'permissionChanged') {
      refreshPermission().then(resync, resync);
    }
  });

  cleanups.push(unsubscribeAuth, unsubscribeSetting, () => appStateSubscription?.remove(), unsubscribeSignals, stopRetry);

  async function refreshPermission() {
    setReminderPermission(await platform.getPermission().catch(() => 'denied'));
  }
  controller = {
    sync: resync,
    refreshPermission,
    // UX ruling §3, the Settings row while the OS permission is denied: ask
    // again when the OS still can, else open the app's system settings (the
    // foreground return re-reads it and reschedules).
    async fixPermission() {
      if (await platform.canAskAgain().catch(() => false)) {
        await platform.requestPermission().catch(() => 'denied');
        await refreshPermission();
        await resync();
      } else {
        platform.openNotificationSettings();
      }
    },
    // UX ruling §4 (owner, 29 Oct 2026; amends T-50): the one OS prompt, the
    // first time Today shows a training day with an active plan (or at the
    // workout start, whichever comes first). A trainer too, but never in
    // trainer mode (T-136, UX ruling 4).
    async askOnTrainingDay(platformOverride = platform) {
      const state = useAuthStore.getState();
      if (!isSignedIn(state) || (isTrainerUser(state.user) && state.workspace === Workspace.trainer)) {
        return;
      }
      // Review N1: a settled permission (asked before, granted or denied)
      // means nothing changes here, so no resync on every Today visit.
      const before = await platformOverride.getPermission().catch(() => 'denied');
      if (before !== 'undetermined') {
        return;
      }
      await requestPermissionAtWorkoutStart(platformOverride);
      await resync();
    },
  };
  registerReminderActions(controller);
  return controller;
}

// Tests only.
export function resetWorkoutRemindersForTests() {
  cleanups.forEach((cleanup) => typeof cleanup === 'function' && cleanup());
  cleanups = [];
  controller = null;
  registerReminderActions(null);
}
