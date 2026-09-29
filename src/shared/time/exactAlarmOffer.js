import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import nativeModule from '../../../modules/rest-countdown';

// A2 (RN-SPEC-time): exact rest alerts on Android, offered ONCE. expo schedules
// exact only when canScheduleExactAlarms() is true; otherwise Android batches
// the alert, sometimes by minutes. The grant is a settings page, so the app
// explains first (ExactAlarmOfferDialog). No path depends on the answer: every
// O4 alert is sent either way, and only its timing differs.

export const EXACT_ALARM_OFFERED_KEY = 'gymido.exactAlarmOffered';

let native = nativeModule;

// Rule 2's gate, all of it.
export function shouldOfferExactAlarm({
  platformOS,
  apiLevel,
  canScheduleExact,
  notificationsGranted,
  askedThisStart,
  offeredBefore,
}) {
  return (
    platformOS === 'android' &&
    apiLevel >= 31 &&
    !canScheduleExact &&
    notificationsGranted &&
    // The OS notification dialog and this one never appear back to back.
    !askedThisStart &&
    !offeredBefore
  );
}

function canScheduleExact() {
  try {
    return native ? Boolean(native.canScheduleExactAlarms()) : true;
  } catch {
    return true;
  }
}

async function offeredBefore() {
  try {
    return (await AsyncStorage.getItem(EXACT_ALARM_OFFERED_KEY)) !== null;
  } catch {
    // Unreadable storage: never risk offering twice.
    return true;
  }
}

// Called at a rest start, after the rest timer has started (nothing waits on
// it). Resolves true when the dialog should show now. Rule 4: the offer is
// recorded the moment it is shown, before any answer, so declining, backing
// out or killing the app with it open all count as the one offer.
export async function claimExactAlarmOffer({ granted, asked }) {
  if (Platform.OS !== 'android') {
    return false;
  }
  const offer = shouldOfferExactAlarm({
    platformOS: Platform.OS,
    apiLevel: Number(Platform.Version),
    canScheduleExact: canScheduleExact(),
    notificationsGranted: granted,
    askedThisStart: asked,
    offeredBefore: await offeredBefore(),
  });
  if (!offer) {
    return false;
  }
  try {
    await AsyncStorage.setItem(EXACT_ALARM_OFFERED_KEY, '1');
  } catch {
    // Not recorded means it could show again: don't show it at all.
    return false;
  }
  return true;
}

// "Open settings": Android's "Alarms & reminders" page for Gymido. Returning
// needs no code (rule 6): O4 rule 1b's next re-arm schedules through expo,
// which re-reads the permission.
export function openExactAlarmSettings() {
  try {
    native?.openExactAlarmSettings();
  } catch {
    // Best effort.
  }
}

// Test hook.
export function setExactAlarmModuleForTest(module) {
  native = module;
}
