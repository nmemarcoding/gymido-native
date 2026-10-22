import { AppState } from 'react-native';

import { closePanel } from '../shell/shellUiStore';
import { fetchNotificationsPage, useNotificationStore } from './notificationStore';

// App-shell spec §7.2 and ⚠S3/⚠S4, as one module-level controller.
// Each "mount" (a header variant change, see ⚠S4) fetches page 1 through the
// store and starts a poll that hits page 1 directly, immediately and then
// every 30 s, refetching through the store only when `total` changes.
//
// Lifecycle pairing (invariant) A: the interval is cleared on stop and on
// every AppState change away from `active`; it is re-armed on start and on
// every change back to `active` (without an extra immediate request).
// Exactly one interval exists while the bell is mounted and the app is
// active, and none otherwise.

const POLL_MS = 30000;

let mountedVariant = null;
let interval = null;
let lastTotal = null;
let appStateSubscription = null;
let appActive = true;

// An unknown state (before the first report) counts as active.
const isActive = (state) => state == null || state === 'unknown' || state === 'active';

async function poll() {
  try {
    const data = await fetchNotificationsPage(1);
    const total = typeof data.total === 'number' ? data.total : (data.items ?? []).length;
    if (lastTotal !== null && total !== lastTotal) {
      useNotificationStore.getState().fetchNotifications();
    }
    lastTotal = total;
  } catch {
    // Poll errors are ignored.
  }
}

function arm() {
  if (!interval && appActive && mountedVariant !== null) {
    interval = setInterval(poll, POLL_MS);
  }
}

function disarm() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

function onAppStateChange(next) {
  appActive = isActive(next);
  if (appActive) {
    arm();
  } else {
    disarm();
  }
}

// Called when a screen's header becomes the visible one. A different header
// variant than the current mount remounts the bell: fetch, restart polling
// with a fresh baseline, and close the panel.
export function mountBell(variant) {
  if (variant === mountedVariant) {
    return;
  }
  disarm();
  mountedVariant = variant;
  lastTotal = null;
  closePanel();
  if (!appStateSubscription) {
    appActive = isActive(AppState.currentState);
    appStateSubscription = AppState.addEventListener('change', onAppStateChange);
  }
  useNotificationStore.getState().fetchNotifications();
  poll();
  arm();
}

// The shell unmounted (sign-out): stop everything.
export function unmountBell() {
  disarm();
  mountedVariant = null;
  lastTotal = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
}
