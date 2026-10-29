// T-103: the bridge to the reminder controller (workoutReminders.js), free of
// native imports, so API modules and screens never load the notification
// code. The API modules announce what changes the reminders:
// - 'planChanged': a schedule, enrollment or deleted workout changed what is
//   due → replace every pending reminder.
// - 'workoutFinished': today's workout was completed → cancel today's later
//   reminders and clear the one already shown.
const listeners = new Set();

export function onReminderSignal(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function signalReminders(signal) {
  for (const listener of [...listeners]) {
    try {
      listener(signal);
    } catch {
      // A listener's failure never breaks the API call that signalled.
    }
  }
}

// The screens' calls (Today's permission moment, the Settings row); no-ops
// until the controller has started.
let actions = null;

export function registerReminderActions(next) {
  actions = next;
}

export function askReminderPermissionOnTrainingDay() {
  return actions?.askOnTrainingDay() ?? Promise.resolve();
}

export function fixReminderPermission() {
  return actions?.fixPermission() ?? Promise.resolve();
}

export function refreshReminderPermission() {
  return actions?.refreshPermission() ?? Promise.resolve();
}
