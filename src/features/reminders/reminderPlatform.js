import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import restAlertPlatform from '../workout/runtime/restAlertPlatform';
import { getCurrentPlan } from '../myPlans/api/myPlansApi';
import { listCompletedWorkouts } from '../workout/api/workoutApi';
import { REMINDER_CHANNEL_ID } from './reminderSync';

// T-103: the reminders share the rest alerts' notification primitives and
// OS permission (one permission per app, UX ruling §3).
// `canAskAgain`: the OS would still show its dialog (Android after one "Don't
// allow"); false = only the system settings can turn it on.
export const reminderPlatform = {
  ...restAlertPlatform,
  canAskAgain: async () => Boolean((await Notifications.getPermissionsAsync()).canAskAgain),
};

export const reminderApi = { getCurrentPlan, listCompletedWorkouts };

// UX ruling §2: default sound and vibration; no badge count.
export function initReminderChannel(os = Platform.OS) {
  if (os !== 'android') {
    return;
  }
  Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Workout reminders',
    description: 'Reminders on your training days',
    importance: Notifications.AndroidImportance.DEFAULT,
    showBadge: false,
  }).catch(() => {});
}

export function addReminderTapListener(listener) {
  const subscription = Notifications.addNotificationResponseReceivedListener(listener);
  return () => subscription.remove();
}

// Cold start: the tap that launched the app (null when none).
export function lastReminderTap() {
  return Notifications.getLastNotificationResponseAsync?.().catch(() => null) ?? Promise.resolve(null);
}
