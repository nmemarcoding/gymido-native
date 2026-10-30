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
import { isWorkoutRemindersOn, loadWorkoutReminders, setReminderPermission, useWorkoutReminders } from './workoutReminderSetting';

const SIGNED_OUT = new Set([AuthStatus.signedOut, AuthStatus.accountUnavailable]);
// Review M1: who is signed in isn't known yet; a sync then changes nothing.
const AUTH_PENDING = new Set([AuthStatus.restoring, AuthStatus.authenticating, AuthStatus.loadingUser]);

let controller = null;
let cleanups = [];

// T-136 (owner, 30 Oct 2026): a trainer gets them too, from their own plan
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
  const sync = createReminderSync({ platform, api, allowed, localCompleted: () => finishedHere });
  const resync = () => sync.sync().catch(() => {});

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
      sync.clearAll().catch(() => {});
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
  });

  cleanups.push(unsubscribeAuth, unsubscribeSetting, () => appStateSubscription?.remove(), unsubscribeSignals);

  const refreshPermission = async () => {
    setReminderPermission(await platform.getPermission().catch(() => 'denied'));
  };
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
