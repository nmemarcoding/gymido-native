import * as Notifications from 'expo-notifications';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { installNotificationTray } from '../../../test/notificationTray';
import {
  cancelRestEndNotification,
  playRestDoneAlert,
  resetRestAlertsForTest,
  restNotificationPresentation,
  sendRestEndNotification,
} from '../../../shared/time/restAlerts';
import { useRestTimer } from '../runtime/useRestTimer';

// [O4] background rest alerts. These pin the scheduling lifecycle itself, which
// no screen test can reach: the notification is the only observable, and the
// bug class here (a rest that silently loses its pending notification) is
// invisible in the UI.

const REST_SECONDS = 180;
let handlers = [];

function emit(state) {
  handlers.forEach((handler) => handler(state));
}

function scheduledDates() {
  return Notifications.scheduleNotificationAsync.mock.calls
    .map(([request]) => request?.trigger?.date)
    .filter(Boolean)
    .map((date) => new Date(date).getTime());
}

// Lets every queued notification operation finish (the tray may add latency).
async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  });
}

async function startRest(result, { setId = 201 } = {}) {
  await act(async () => {
    result.current.startRestTimer({ setId, restSeconds: REST_SECONDS, nextSetKey: '100:202' });
  });
  await act(async () => {});
}

beforeEach(async () => {
  handlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
    if (event === 'change') {
      handlers.push(handler);
    }
    return {
      remove: () => {
        handlers = handlers.filter((entry) => entry !== handler);
      },
    };
  });
  await resetRestAlertsForTest();
  Notifications.scheduleNotificationAsync.mockClear();
  Notifications.cancelScheduledNotificationAsync.mockClear();
});

describe('[O4] the pending rest notification', () => {
  it('is scheduled once at rest start, for the rest end instant', async () => {
    const before = Date.now();
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const [when] = scheduledDates();
    expect(when).toBeGreaterThanOrEqual(before + REST_SECONDS * 1000);
    expect(when).toBeLessThan(before + (REST_SECONDS + 5) * 1000);
  });

  it('is cancelled on resume, so the foreground never double-alerts', async () => {
    const { result } = await renderHook(() => useRestTimer({}));
    const tray = installNotificationTray();
    await startRest(result);
    await settle();
    expect(tray.pendingRestEnd()).toHaveLength(1);

    await act(async () => emit('active'));
    await settle();
    expect(tray.pendingRestEnd()).toHaveLength(0);
  });

  // The owner's bug: a 3-minute rest never alerted, while the same rest wound
  // down to ~5s with −5s always did. O4 cancels on EVERY resume but only
  // schedules at rest start and on a ±5s rebase, so one trip to the foreground
  // — even an iOS Control Centre pull, which reports inactive → active — left
  // the rest with nothing pending for the remainder of its life.
  it('is re-armed when the app leaves the foreground again mid-rest', async () => {
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    const [plannedEnd] = scheduledDates();

    await act(async () => emit('active'));
    Notifications.scheduleNotificationAsync.mockClear();

    await act(async () => emit('background'));
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    // Re-armed for the ORIGINAL end instant, not restarted from now.
    const [rearmedEnd] = scheduledDates();
    expect(Math.abs(rearmedEnd - plannedEnd)).toBeLessThanOrEqual(1000);
  });

  it('survives repeated foreground/background cycles, staying at one pending', async () => {
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    const [plannedEnd] = scheduledDates();

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await act(async () => emit('active'));
      await act(async () => emit('background'));
    }

    const dates = scheduledDates();
    expect(dates.length).toBeGreaterThan(1);
    expect(Math.abs(dates[dates.length - 1] - plannedEnd)).toBeLessThanOrEqual(1000);
  });

  it('is not re-armed when no rest is running', async () => {
    await renderHook(() => useRestTimer({}));
    await act(async () => emit('background'));
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('is not re-armed after the rest was skipped', async () => {
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    await act(async () => result.current.skipRestTimer());
    Notifications.scheduleNotificationAsync.mockClear();

    await act(async () => emit('background'));
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('never leaves an orphan pending when a cancel races an in-flight schedule', async () => {
    const tray = installNotificationTray({ latency: 10 });
    const { result } = await renderHook(() => useRestTimer({}));
    await act(async () => {
      result.current.startRestTimer({ setId: 201, restSeconds: REST_SECONDS, nextSetKey: '' });
    });
    // The rest is cleared while the send is still in flight.
    await act(async () => result.current.clearRestTimer());
    await settle();

    expect(tray.allRestEnd()).toHaveLength(0);
  });
});

// [O4-A1] REMOVE-THEN-SEND. The owner saw unopened rest notifications pile up
// 3–10 deep; the invariant is now "at most one rest-end notification exists,
// pending or delivered".
describe('[O4-A1] no pile-up', () => {
  it('removes a delivered rest-end left from an earlier rest before sending the next', async () => {
    const tray = installNotificationTray();
    tray.tray.delivered.push({
      identifier: 'from-an-older-build',
      content: { data: { kind: 'rest-end', source: 'scheduled', setId: 101 } },
      trigger: null,
    });
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    await settle();

    expect(tray.deliveredRestEnd()).toHaveLength(0);
    expect(tray.pendingRestEnd()).toHaveLength(1);
    expect(tray.pendingRestEnd()[0]).toMatchObject({ identifier: 'gymido.rest' });
  });

  it('serialises overlapping sends: three at once leave exactly one, the last', async () => {
    // Without relying on same-identifier replacement: removal is the mechanism.
    const tray = installNotificationTray({ latency: 10, replaces: false });
    const now = Date.now();
    await act(async () => {
      sendRestEndNotification({ endMs: now + 60000, setId: 201 });
      sendRestEndNotification({ endMs: now + 65000, setId: 201 });
      sendRestEndNotification({ endMs: now + 70000, setId: 201 });
    });
    await settle();

    expect(tray.allRestEnd()).toHaveLength(1);
    expect(tray.pendingRestEnd()[0].trigger.date.getTime()).toBe(now + 70000);
  });

  it('serialises a 1b re-arm landing during a ±5s reschedule', async () => {
    const tray = installNotificationTray({ latency: 10 });
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    await settle();

    await act(async () => {
      result.current.adjustRestTimer(5);
      emit('background');
    });
    await settle();
    expect(tray.allRestEnd()).toHaveLength(1);
  });

  it('the foreground parity alert survives the rest clearing, and replaces the scheduled one', async () => {
    const tray = installNotificationTray({ latency: 5 });
    await act(async () => {
      sendRestEndNotification({ endMs: Date.now() + 60000, setId: 201 });
    });
    await settle();
    expect(tray.pendingRestEnd()).toHaveLength(1);

    // The natural-end sequence in useRestTimer: alert, then clear the rest.
    await act(async () => {
      playRestDoneAlert();
      cancelRestEndNotification();
    });
    await settle();

    expect(tray.pendingRestEnd()).toHaveLength(0);
    expect(tray.deliveredRestEnd()).toHaveLength(1);
    expect(tray.deliveredRestEnd()[0].content.data.source).toBe('foreground');
  });

  it('a superseded send removes only itself, never the newer rest queued behind it', async () => {
    const tray = installNotificationTray({ latency: 10 });
    const { result } = await renderHook(() => useRestTimer({}));
    await act(async () => {
      result.current.startRestTimer({ setId: 201, restSeconds: REST_SECONDS, nextSetKey: '' });
    });
    await act(async () => {
      result.current.startRestTimer({ setId: 202, restSeconds: REST_SECONDS, nextSetKey: '' });
    });
    await settle();

    expect(tray.allRestEnd()).toHaveLength(1);
    expect(tray.allRestEnd()[0].content.data.setId).toBe(202);
  });

  it('never touches a notification that is not a rest-end one (rule 12)', async () => {
    const tray = installNotificationTray();
    const foreign = { identifier: 'other', content: { data: { kind: 'something-else' } }, trigger: null };
    const foreignPending = { identifier: 'other-2', content: { data: {} }, trigger: { type: 'date', date: new Date() } };
    tray.addForeign(foreign);
    tray.addForeign(foreignPending);
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    await act(async () => result.current.clearRestTimer());
    await act(async () => {
      playRestDoneAlert();
    });
    await settle();

    expect(tray.tray.delivered).toContainEqual(foreign);
    expect(tray.tray.pending).toContainEqual(foreignPending);
    expect(Notifications.dismissAllNotificationsAsync).toBeUndefined();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toBeUndefined();
  });
});

describe('[O4] rule 4: foreground presentation', () => {
  const note = (data) => ({ request: { content: { data } } });

  it('silences the SCHEDULED rest-end while the app is active', () => {
    expect(restNotificationPresentation(note({ kind: 'rest-end', source: 'scheduled' }), 'active')).toMatchObject({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
    });
  });

  it('shows the FOREGROUND parity alert as a banner that is not kept in the tray', () => {
    expect(restNotificationPresentation(note({ kind: 'rest-end', source: 'foreground' }), 'active')).toMatchObject({
      shouldShowBanner: true,
      shouldShowList: false,
    });
  });

  it('leaves everything else, and the scheduled one in the background, fully shown', () => {
    const shown = { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true };
    expect(restNotificationPresentation(note({ kind: 'rest-end', source: 'scheduled' }), 'background')).toMatchObject(shown);
    expect(restNotificationPresentation(note({ kind: 'other' }), 'active')).toMatchObject(shown);
  });
});
