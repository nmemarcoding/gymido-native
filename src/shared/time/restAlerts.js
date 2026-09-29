import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { AppState, Platform, Vibration } from 'react-native';

// Rest-done alert and [O4] background notifications (RN-SPEC-time §7.2 + O4).
// Every part is best-effort: a failure here must never break the timer.

export const REST_END_KIND = 'rest-end';
// [O4-A1] rule 9: every rest notification shares one identifier, so a send
// that ever raced a removal would replace rather than stack. Belt-and-braces
// only — removal (rule 10) is the mechanism.
export const REST_NOTIFICATION_ID = 'gymido.rest';
const ANDROID_CHANNEL = 'rest-timer';
const TITLE = 'Rest complete';
const BODY = 'Time for your next set.';

let player = null;
let permissionStatus = null;

function safe(promise) {
  return Promise.resolve(promise).catch(() => null);
}

// [O4] rule 4: the SCHEDULED rest-end notification never double-alerts in the
// foreground. Keyed on `source`, not `kind` alone ([O4-A1] correction): the
// foreground parity alert is a rest-end notification too, and must show — as a
// transient banner that is not kept in the tray. Its sound is the §7.2 beep,
// which plays separately, so the notification itself stays silent.
export function restNotificationPresentation(notification, appState = AppState.currentState) {
  const data = notification?.request?.content?.data;
  if (data?.kind === REST_END_KIND && data?.source === 'foreground') {
    return { shouldShowBanner: true, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
  }
  const silent = data?.kind === REST_END_KIND && appState === 'active';
  return { shouldShowBanner: !silent, shouldShowList: !silent, shouldPlaySound: !silent, shouldSetBadge: false };
}

export function configureRestNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => restNotificationPresentation(notification),
  });
  if (Platform.OS === 'android') {
    safe(
      // Omitting `sound` keeps the channel's system default sound. Naming one
      // would look for a bundled custom file (see the content note below).
      Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
      })
    );
  }
}

// Permission is requested only when undetermined, at the parity moment: a set
// completion starting a rest (§7.2).
//
// Resolves to { granted, asked }: `asked` is whether the OS dialog was shown
// just now. A2's exact-alarm offer must never follow it back to back.
export async function ensureRestNotificationPermission() {
  const current = await safe(Notifications.getPermissionsAsync());
  if (!current) {
    return { granted: false, asked: false };
  }
  if (current.status === 'undetermined' || (Platform.OS === 'ios' && current.canAskAgain && !current.granted)) {
    const result = await safe(Notifications.requestPermissionsAsync());
    permissionStatus = result?.status ?? null;
    return { granted: Boolean(result?.granted), asked: true };
  }
  permissionStatus = current.status;
  return { granted: Boolean(current.granted), asked: false };
}

export async function hasRestNotificationPermission() {
  if (permissionStatus === 'granted') {
    return true;
  }
  const current = await safe(Notifications.getPermissionsAsync());
  permissionStatus = current?.status ?? null;
  return Boolean(current?.granted);
}

// [O4-A1] rule 10 "Serialise it": every rest-notification operation runs
// through this one queue, each awaiting the previous. Without it two
// overlapping sends (a 1b re-arm landing during a ±5s reschedule) could each
// snapshot before the other sends, and both would survive.
let queue = Promise.resolve();

function enqueue(operation) {
  const run = queue.then(operation, operation);
  queue = run.catch(() => null);
  return run.catch(() => null);
}

// O13.5 A: the live rest countdown runs through this same queue, so rest events
// apply in order across both.
export const enqueueRestOperation = enqueue;

let sendCounter = 0;

const kindOf = (content) => content?.data?.kind;

// Rule 10 steps 1–2 (and rule 12): snapshot the pending and delivered rest
// notifications, then remove every one and await it. Filters on kind — never
// anything else the app posts, never dismissAll/cancelAll. `matches` narrows
// further (rule 6 removes only its own send).
export async function removeRestNotifications({ pending = true, delivered = true, matches = () => true } = {}) {
  const [scheduled, presented] = await Promise.all([
    pending ? safe(Notifications.getAllScheduledNotificationsAsync()) : null,
    delivered ? safe(Notifications.getPresentedNotificationsAsync()) : null,
  ]);
  const removals = [];
  for (const request of scheduled || []) {
    if (kindOf(request?.content) === REST_END_KIND && matches(request.content.data)) {
      removals.push(safe(Notifications.cancelScheduledNotificationAsync(request.identifier)));
    }
  }
  for (const notification of presented || []) {
    const request = notification?.request;
    if (kindOf(request?.content) === REST_END_KIND && matches(request.content.data)) {
      removals.push(safe(Notifications.dismissNotificationAsync(request.identifier)));
    }
  }
  await Promise.all(removals);
}

// [O4-A1] rule 10: REMOVE-THEN-SEND, the ONLY way a rest-end notification is
// sent — rule 1 (rest start), 1b (re-arm on leaving the foreground), 2 (±5s)
// and, with `endMs: null`, the §7.2 foreground parity alert. Each step awaited,
// strictly in order: snapshot, remove all, then send. A past `endMs` removes
// and sends nothing (rule 2's "just cancel").
//
// Resolves to `{ token }` for the send, or null when nothing was sent. The
// token rides in `data`, so rule 6 can remove exactly this send and never a
// newer one queued behind it (they all share one identifier).
export function sendRestEndNotification({ endMs = null, setId = null, source = 'scheduled' }) {
  return enqueue(async () => {
    if (!(await hasRestNotificationPermission())) {
      return null;
    }
    await removeRestNotifications();
    if (endMs !== null && endMs <= Date.now()) {
      return null;
    }
    sendCounter += 1;
    const token = `rest-${sendCounter}`;
    const sent = await safe(
      Notifications.scheduleNotificationAsync({
        identifier: REST_NOTIFICATION_ID,
        content: {
          title: TITLE,
          body: BODY,
          data: { kind: REST_END_KIND, source, setId, token },
          // iOS takes the system default here. On Android a named sound means a
          // custom file registered with the config plugin, so the channel (which
          // owns the sound on modern Android) provides the default instead.
          ...(Platform.OS === 'ios' ? { sound: 'default' } : { channelId: ANDROID_CHANNEL }),
        },
        trigger:
          endMs === null
            ? null
            : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endMs) },
      })
    );
    return sent ? { token } : null;
  });
}

// [O4] rule 3: cancel the PENDING rest-end notification (rest cleared, app
// resumed). Delivered ones stay: dismiss-on-return was dropped (rule 11).
// With `token`, rule 6: remove only that send, pending or delivered.
export function cancelRestEndNotification({ token } = {}) {
  return enqueue(() =>
    token
      ? removeRestNotifications({ matches: (data) => data?.token === token })
      : removeRestNotifications({ delivered: false })
  );
}

// §7.2 alert, foreground only: beep, Android vibration, immediate notification.
export async function playRestDoneAlert() {
  safe(setAudioModeAsync({ playsInSilentMode: true }));
  try {
    if (!player) {
      player = createAudioPlayer(require('../../../assets/rest-done.wav'));
    }
    player.seekTo(0);
    player.play();
  } catch {
    // Sound is best-effort.
  }

  // The web only vibrates where the browser supports it: Android yes, iOS no.
  if (Platform.OS === 'android') {
    try {
      Vibration.vibrate([0, 200, 100, 200]);
    } catch {
      // Best-effort.
    }
  }

  // [O4-A1] the foreground parity alert goes through rule 10 too, so it
  // replaces the scheduled one instead of joining it.
  sendRestEndNotification({ source: 'foreground' });
}

// Test hook. Drains the queue first, so an operation left over from the
// previous test (an unmount's cancel) cannot land in the next one.
export async function resetRestAlertsForTest() {
  await queue;
  player = null;
  permissionStatus = null;
  queue = Promise.resolve();
  sendCounter = 0;
}
