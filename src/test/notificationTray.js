import * as Notifications from 'expo-notifications';

// A stateful stand-in for the OS notification tray, installed over the
// expo-notifications mock in jest.setup.js. [O4-A1] is about what EXISTS
// (at most one rest-end notification, pending or delivered), which call
// counting cannot show. A date trigger lands in `pending`; a null trigger is
// presented at once and lands in `delivered`. The same identifier replaces,
// as the platforms do — unless `replaces: false`, the worst case rule 9's
// identifier is only belt-and-braces for. `latency` delays each call so tests
// can overlap them.
export function installNotificationTray({ latency = 0, replaces = true } = {}) {
  const tray = { pending: [], delivered: [] };
  const later = (value) =>
    latency ? new Promise((resolve) => setTimeout(() => resolve(value), latency)) : Promise.resolve(value);
  let counter = 0;

  Notifications.scheduleNotificationAsync.mockImplementation(({ identifier, content, trigger }) => {
    counter += 1;
    const id = replaces && identifier ? identifier : `auto-${counter}`;
    const request = { identifier: id, content, trigger };
    if (replaces) {
      tray.pending = tray.pending.filter((entry) => entry.identifier !== id);
      tray.delivered = tray.delivered.filter((entry) => entry.identifier !== id);
    }
    (trigger ? tray.pending : tray.delivered).push(request);
    return later(id);
  });
  Notifications.cancelScheduledNotificationAsync.mockImplementation((id) => {
    tray.pending = tray.pending.filter((entry) => entry.identifier !== id);
    return later(undefined);
  });
  Notifications.dismissNotificationAsync.mockImplementation((id) => {
    tray.delivered = tray.delivered.filter((entry) => entry.identifier !== id);
    return later(undefined);
  });
  Notifications.getAllScheduledNotificationsAsync.mockImplementation(() => later([...tray.pending]));
  Notifications.getPresentedNotificationsAsync.mockImplementation(() =>
    later(tray.delivered.map((request) => ({ request, date: Date.now() })))
  );

  const restEnd = (list) => list.filter((entry) => entry.content?.data?.kind === 'rest-end');
  return {
    tray,
    pendingRestEnd: () => restEnd(tray.pending),
    deliveredRestEnd: () => restEnd(tray.delivered),
    allRestEnd: () => [...restEnd(tray.pending), ...restEnd(tray.delivered)],
    // Something the app posts that is not a rest notification (rule 12).
    addForeign(request) {
      (request.trigger ? tray.pending : tray.delivered).push(request);
    },
  };
}
