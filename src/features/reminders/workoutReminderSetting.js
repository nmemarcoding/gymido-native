import { create } from 'zustand';

import { getPreference, setPreference } from '../../shared/storage/preferences';

// T-103 "Workout reminders" (UX ruling §3): default ON. Stored on the device
// only ('1'/'0', missing means on); never sent to the server, kept on logout.
export const WORKOUT_REMINDERS_KEY = 'gymido.workoutReminders';

// `permission`: the OS notification permission as restAlertPlatform reads it
// ('granted' | 'undetermined' | 'denied'); null until first read.
export const useWorkoutReminders = create(() => ({ enabled: true, permission: null }));

export async function loadWorkoutReminders() {
  const stored = await getPreference(WORKOUT_REMINDERS_KEY);
  useWorkoutReminders.setState({ enabled: stored !== '0' });
}

export function setWorkoutRemindersEnabled(enabled) {
  useWorkoutReminders.setState({ enabled });
  return setPreference(WORKOUT_REMINDERS_KEY, enabled ? '1' : '0');
}

export function isWorkoutRemindersOn() {
  return useWorkoutReminders.getState().enabled;
}

export function setReminderPermission(permission) {
  useWorkoutReminders.setState({ permission });
}

// T-172 fix d: the last sync's outcome ({ at, count, source, reason, status });
// count 0 carries why (no-plan, not-active:…, no-schedule, no-weekdays,
// not-started, no-slot-left, not-allowed; plan-read-failed when nothing ran).
export function setReminderLastSync(lastSync) {
  useWorkoutReminders.setState({ lastSync });
}
