import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { restCountdown } from '../../../shared/time/restCountdown';
import { EXACT_ALARM_OFFERED_KEY, NOTIFICATION_PERMISSION_ASKED_KEY, REST_BANNER_CHANNEL_ID, REST_CHANNEL_ID, restNotificationBehavior } from './restAlerts';

// The expo side of the rest alerts (RN-SPEC-time §7.2, O4, A1, A2).
// SessionRuntime uses it; App.js calls initRestAlerts() once at startup.

let initialized = false;
let player = null;
let audioMode = null;

// Owner ruling (23 Oct 2026): the rest-done beep plays even with the iPhone
// ring/silent switch on, and DUCKS other audio (music keeps playing, quieter)
// instead of mixing over it or stopping it. Set once, best effort, never
// throws; a failure retries on the next beep. (The 28 Sep build forced the
// silent-mode part too.)
export const BEEP_AUDIO_MODE = Object.freeze({
  playsInSilentMode: true,
  interruptionMode: 'duckOthers',
  shouldPlayInBackground: false,
});

function ensureAudioMode() {
  if (!audioMode) {
    let pending;
    try {
      pending = Promise.resolve(setAudioModeAsync(BEEP_AUDIO_MODE));
    } catch (error) {
      pending = Promise.reject(error);
    }
    audioMode = pending.catch(() => {
      audioMode = null;
    });
  }
  return audioMode;
}

// O4 rule 1 (the channel, created once at startup) and rule 4 (the handler).
export function initRestAlerts() {
  if (initialized) {
    return;
  }
  initialized = true;
  ensureAudioMode();
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => restNotificationBehavior(notification.request.content.data, AppState.currentState),
  });
  if (Platform.OS === 'android') {
    // No `sound` key: the channel then uses the system default sound. On a
    // channel, `sound: 'default'` names a custom file and fails.
    Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
    // Q4: heads-up, but silent; the §7.2 beep is the sound.
    Notifications.setNotificationChannelAsync(REST_BANNER_CHANNEL_ID, {
      name: 'Rest complete',
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
      enableVibrate: false,
    }).catch(() => {});
  }
}

// The web asks only while permission is 'default' (never answered), and
// never again after one denial. Android reports a NEVER-asked notification
// permission as 'denied' with canAskAgain, and keeps canAskAgain after one
// "Don't allow", so canAskAgain alone can't tell the two apart: it counts as
// 'undetermined' only until the app has asked once (`askedBefore`).
// (ported from the 28 Sep build's asked-once guard)
export function permissionState({ status, granted, canAskAgain }, askedBefore = false) {
  if (granted || status === 'granted') {
    return 'granted';
  }
  if (status === 'undetermined') {
    return 'undetermined';
  }
  return canAskAgain && !askedBefore ? 'undetermined' : 'denied';
}

async function askedBefore() {
  try {
    return (await AsyncStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY)) !== null;
  } catch {
    // Unreadable storage: never risk asking twice.
    return true;
  }
}

const restAlertPlatform = {
  getPermission: async () => permissionState(await Notifications.getPermissionsAsync(), await askedBefore()),
  // Recorded BEFORE the dialog shows, so a kill mid-dialog never re-asks.
  requestPermission: async () => {
    await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, '1').catch(() => {});
    return (await Notifications.requestPermissionsAsync()).status;
  },
  getScheduled: () => Notifications.getAllScheduledNotificationsAsync(),
  getPresented: () => Notifications.getPresentedNotificationsAsync(),
  cancelScheduled: (id) => Notifications.cancelScheduledNotificationAsync(id),
  dismiss: (id) => Notifications.dismissNotificationAsync(id),
  schedule: (request) => Notifications.scheduleNotificationAsync(request),
  // §7.2 step 1: the pre-rendered two-beep WAV, best effort.
  // The audio mode is applied first (once); the beep plays either way.
  playBeep: () =>
    ensureAudioMode().then(() => {
      try {
        if (!player) {
          player = createAudioPlayer(require('../../../../assets/sounds/rest-done.wav'));
        }
        player.seekTo(0);
        player.play();
      } catch {
        // Best effort, as on the web.
      }
    }),
  // A2 rules 2 and 3, from the O13 module (Android; iOS answers true).
  canScheduleExactAlarms: () => restCountdown.canScheduleExactAlarms(),
  openExactAlarmSettings: () => restCountdown.openExactAlarmSettings(),
  readOffered: async () => (await AsyncStorage.getItem(EXACT_ALARM_OFFERED_KEY)) !== null,
  markOffered: () => AsyncStorage.setItem(EXACT_ALARM_OFFERED_KEY, '1'),
};

export default restAlertPlatform;
