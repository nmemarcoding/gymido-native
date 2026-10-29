import { AppState } from 'react-native';

import { AuthStatus, useAuthStore } from '../auth/authStore';
import { isTrainerUser } from '../shell/shellRules';
import { openShellPath, shellNavigation } from '../shell/shellLinks';
import { requestPermissionAtWorkoutStart } from '../workout/runtime/restAlerts';
import { isReminder } from './reminderPlan';
import { addReminderTapListener, initReminderChannel, lastReminderTap, reminderApi, reminderPlatform } from './reminderPlatform';
import { onReminderSignal, registerReminderActions } from './reminderSignals';
import { createReminderSync } from './reminderSync';
import { isWorkoutRemindersOn, loadWorkoutReminders, setReminderPermission, useWorkoutReminders } from './workoutReminderSetting';

const SIGNED_OUT = new Set([AuthStatus.signedOut, AuthStatus.accountUnavailable]);

let controller = null;
let cleanups = [];

// Members only (owner): a trainer account gets no reminders.
function isSignedInMember(state = useAuthStore.getState()) {
  return state.status === AuthStatus.signedIn && !isTrainerUser(state.user);
}

// T-103, once at startup (App.js). Reschedules on every app open and
// foreground, on sign-in, on a Settings change and on a plan or schedule
// change; clears everything on sign-out. A tap on a reminder opens Today.
export function startWorkoutReminders({
  platform = reminderPlatform,
  api = reminderApi,
  appState = AppState,
  openToday = () => openShellPath('/'),
  navigation = shellNavigation,
} = {}) {
  if (controller) {
    return controller;
  }
  initReminderChannel();
  const allowed = async () => {
    if (!isSignedInMember() || !isWorkoutRemindersOn()) {
      return false;
    }
    const permission = await platform.getPermission().catch(() => 'denied');
    setReminderPermission(permission);
    return permission === 'granted';
  };
  const sync = createReminderSync({ platform, api, allowed });
  const resync = () => sync.sync().catch(() => {});

  // UX ruling §5: Today's root, after sign-in when signed out; dropped for a
  // trainer account.
  let tapPending = false;
  const openPendingTap = () => {
    const state = useAuthStore.getState();
    if (!tapPending || state.status !== AuthStatus.signedIn) {
      return;
    }
    if (isTrainerUser(state.user)) {
      tapPending = false;
    } else if (navigation.isReady()) {
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
  const unsubscribeSignals = onReminderSignal((signal) => {
    if (signal === 'workoutFinished') {
      sync.finishToday().catch(() => {});
    } else if (signal === 'planChanged') {
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
    // workout start, whichever comes first). Never for a trainer account.
    async askOnTrainingDay(platformOverride = platform) {
      if (!isSignedInMember()) {
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
