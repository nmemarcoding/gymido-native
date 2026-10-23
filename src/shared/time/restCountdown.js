import { requireOptionalNativeModule } from 'expo';

// RN-SPEC-time O13: the live rest countdown (modules/rest-countdown). Absent
// from Jest and from dev clients built before the module, where every call is
// a no-op, as when the platform has it turned off (O13.4: quietly absent).
const native = requireOptionalNativeModule('RestCountdown');

export const restCountdown = {
  isEnabled: async () => (native ? native.isEnabled() : false),
  start: async (options) => native?.start(options),
  update: async (options) => native?.update(options),
  end: async () => native?.end(),
  // A2 (Android): null when unknown, which never offers.
  canScheduleExactAlarms: async () => (native ? native.canScheduleExactAlarms() : null),
  // Synchronous on the native side; a throw here would land in an onPress
  // handler (fatal in release), so it never escapes.
  // §7.2 step 2: the native rest-end buzz. False when the module is absent
  // (Jest, older dev clients), so the caller falls back to RN Vibration.
  vibrateRestEnd: () => {
    try {
      return Boolean(native?.vibrateRestEnd());
    } catch {
      return false;
    }
  },
  openExactAlarmSettings: () => {
    try {
      native?.openExactAlarmSettings();
    } catch {
      // No settings screen to open (ActivityNotFound, lost context).
    }
  },
};
