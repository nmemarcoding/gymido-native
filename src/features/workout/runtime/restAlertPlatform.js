import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { AccessibilityInfo, AppState, Linking, Platform } from 'react-native';

import { restCountdown } from '../../../shared/time/restCountdown';
import {
  EXACT_ALARM_OFFERED_KEY,
  NOTIFICATION_PERMISSION_ASKED_KEY,
  LEGACY_REST_CHANNEL_ID,
  REST_BANNER_CHANNEL_ID,
  REST_CHANNEL_ID,
  SPEAK_INTRO_SHOWN_KEY,
  restNotificationBehavior,
} from './restAlerts';
import { isSpeakRestAlertsOn, isVibrateRestAlertsOn, loadSpeakRestAlerts } from './speakRestAlerts';

// The expo side of the rest alerts (RN-SPEC-time §7.2, O4, A1, A2).
// SessionRuntime uses it; App.js calls initRestAlerts() once at startup.

let initialized = false;
let player = null;
let audioMode = null;
// A3: no speech while VoiceOver/TalkBack is on (the beep still plays). Read
// once at startup, then kept current by the change listener.
let screenReaderOn = false;
// The two-beep WAV is 0.56 s; the spoken cue starts once it has played.
const SPEAK_AFTER_BEEP_MS = 600;
// Audio-session hygiene: once the beep (and the spoken cue) are done, the
// session is released, so other audio un-ducks and nothing in our app holds
// an active playback session (iOS can hold back haptics while one is active).
// Released on going to the background too. Every play re-activates it first:
// on Android, expo-audio refuses to play at all while it is released.
const RELEASE_AFTER_BEEP_MS = 900;
let releaseTimer = null;
let speechTimer = null;
// A spoken cue is due or playing: only its end (or a stop) releases.
let speechPending = false;
// Resolves once the latest beep has started (activating the session can take
// a moment), so the spoken cue is timed from the beep, never over it.
let beepStarted = Promise.resolve();

function releaseAudioSession(delayMs = 0) {
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    Promise.resolve()
      .then(() => setIsAudioActiveAsync(false))
      .catch(() => {});
  }, delayMs);
}

function activateAudioSession() {
  clearTimeout(releaseTimer);
  releaseTimer = null;
  return Promise.resolve()
    .then(() => setIsAudioActiveAsync(true))
    .catch(() => {});
}

// The beep player, created (and so preloaded) at startup: the first load of
// the WAV takes longer than the spoken cue's delay, which made the very first
// cue start before its beep.
function ensurePlayer() {
  if (!player) {
    player = createAudioPlayer(require('../../../../assets/sounds/rest-done.wav'));
  }
  return player;
}

// Resolves when the player actually reports playing (or after a cap): after
// the session was released, Android takes up to ~1 s to restart the beep's
// track, so timing the spoken cue from play() alone could put it first.
const BEEP_START_CAP_MS = 1500;

function whenPlaying(audioPlayer) {
  return new Promise((resolve) => {
    let subscription = null;
    let cap = null;
    const done = () => {
      clearTimeout(cap);
      subscription?.remove?.();
      resolve();
    };
    cap = setTimeout(done, BEEP_START_CAP_MS);
    try {
      subscription = audioPlayer.addListener?.('playbackStatusUpdate', (status) => {
        if (status?.playing) {
          done();
        }
      });
    } catch {
      done();
    }
  });
}

function endSpeech() {
  clearTimeout(speechTimer);
  speechTimer = null;
  speechPending = false;
}

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
  try {
    ensurePlayer();
  } catch {
    // Best effort; playBeep tries again.
  }
  loadSpeakRestAlerts();
  AccessibilityInfo.isScreenReaderEnabled()
    .then((enabled) => {
      screenReaderOn = Boolean(enabled);
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => {
    screenReaderOn = Boolean(enabled);
  });
  // Background only: 'inactive' (Control Center, a system dialog) must not
  // cut a beep or the spoken cue.
  AppState.addEventListener('change', (next) => {
    if (next === 'background') {
      endSpeech();
      releaseAudioSession();
    }
  });
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => restNotificationBehavior(notification.request.content.data, AppState.currentState),
  });
  if (Platform.OS === 'android') {
    // No `sound` key: the channel then uses the system default sound. On a
    // channel, `sound: 'default'` names a custom file and fails.
    // Vibrates with the old build's pattern (that build's channel had it).
    Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: true,
      vibrationPattern: [0, 200, 100, 200],
    }).catch(() => {});
    Notifications.deleteNotificationChannelAsync?.(LEGACY_REST_CHANNEL_ID)?.catch?.(() => {});
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
    (beepStarted = ensureAudioMode()
      .then(activateAudioSession)
      .then(() => {
        try {
          ensurePlayer();
          const started = whenPlaying(player);
          player.seekTo(0);
          player.play();
          // A spoken cue that follows releases the session when it ends.
          // Released once the beep has played; a spoken cue that follows
          // releases it when the speech ends instead.
          started.then(() => {
            if (!speechPending) {
              releaseAudioSession(RELEASE_AFTER_BEEP_MS);
            }
          });
          return started;
        } catch {
          // Best effort, as on the web.
          return undefined;
        }
      })),
  // The spoken cue (owner request, 23 Oct 2026): the system voice, through
  // the app's audio session in the beep's mode (silent switch on, ducking).
  // Foreground only, like the beep; skipped when "Speak rest alerts" is off
  // or a screen reader is on (it would talk over VoiceOver/TalkBack).
  speakRestEnd: (text) => {
    if (!isSpeakRestAlertsOn()) {
      return;
    }
    // Set synchronously, before the beep's own release can be scheduled.
    speechPending = true;
    clearTimeout(releaseTimer);
    clearTimeout(speechTimer);
    const release = () => {
      endSpeech();
      releaseAudioSession();
    };
    // Timed from the beep's start; cancellable (a new rest, leaving the
    // session or the background clear it).
    beepStarted.then(() => {
      if (!speechPending) {
        return;
      }
      clearTimeout(speechTimer);
      speechTimer = setTimeout(() => {
        speechTimer = null;
        if (screenReaderOn) {
          release();
          return;
        }
        ensureAudioMode()
          .then(activateAudioSession)
          .then(() => {
            if (!speechPending) {
              return;
            }
            Speech.stop();
            Speech.speak(text, {
              language: 'en',
              useApplicationAudioSession: true,
              onDone: release,
              onStopped: release,
              onError: release,
            });
          })
          .catch(release);
      }, SPEAK_AFTER_BEEP_MS);
    });
  },
  // A3: offer the pop-up only when the cue would actually be spoken.
  speakIntroEligible: () => isSpeakRestAlertsOn() && !screenReaderOn,
  vibrateEnabled: () => isVibrateRestAlertsOn(),
  stopSpeech: () => {
    const wasPending = speechPending;
    endSpeech();
    try {
      Speech.stop();
    } catch {
      // Best effort.
    }
    if (wasPending) {
      releaseAudioSession();
    }
  },
  readSpeakIntroShown: async () => (await AsyncStorage.getItem(SPEAK_INTRO_SHOWN_KEY)) !== null,
  markSpeakIntroShown: () => AsyncStorage.setItem(SPEAK_INTRO_SHOWN_KEY, '1'),
  // The pop-up's iOS "Set up Siri announcements": Gymido's page in Settings.
  openNotificationSettings: () => Linking.openSettings(),
  // A2 rules 2 and 3, from the O13 module (Android; iOS answers true).
  canScheduleExactAlarms: () => restCountdown.canScheduleExactAlarms(),
  openExactAlarmSettings: () => restCountdown.openExactAlarmSettings(),
  readOffered: async () => (await AsyncStorage.getItem(EXACT_ALARM_OFFERED_KEY)) !== null,
  markOffered: () => AsyncStorage.setItem(EXACT_ALARM_OFFERED_KEY, '1'),
};

export default restAlertPlatform;
