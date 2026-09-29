import * as Notifications from 'expo-notifications';

import { installNotificationTray } from '../../../test/notificationTray';
import { resetRestAlertsForTest, sendRestEndNotification } from '../restAlerts';
import { countdownTimes, RestCountdown, setRestCountdownModuleForTest } from '../restCountdown';

// O13 (RN-SPEC-time): the JS wrapper over the native RestCountdown module. The
// native side can't run in Jest, so these pin what the wrapper promises: the
// queue order, the quiet skips, and that a failure never escapes.

let calls;

function fakeModule({ enabled = true, fail = false } = {}) {
  const record = (name) =>
    jest.fn(async (...args) => {
      calls.push([name, ...args]);
      if (fail) {
        throw new Error('native failure');
      }
      return name === 'isEnabled' ? enabled : undefined;
    });
  return { isEnabled: record('isEnabled'), start: record('start'), update: record('update'), end: record('end') };
}

const names = () => calls.map(([name]) => name);

beforeEach(async () => {
  calls = [];
  await resetRestAlertsForTest();
  Notifications.scheduleNotificationAsync.mockClear();
});

afterAll(() => setRestCountdownModuleForTest(null));

describe('RestCountdown', () => {
  it('start: ends any previous countdown, then posts this one with bookkeeping args', async () => {
    const module = fakeModule();
    setRestCountdownModuleForTest(module);
    await RestCountdown.start({ barStartMs: 1000, endMs: 61000, setId: 201 });

    expect(names()).toEqual(['end', 'isEnabled', 'start']);
    // setId travels as a string; a fresh token per post.
    expect(module.start).toHaveBeenCalledWith(1000, 61000, '201', 'countdown-1');
  });

  it('A1 rule 13 order through ONE queue: previous rest-end removed, countdown posted, THEN the alert', async () => {
    const tray = installNotificationTray();
    setRestCountdownModuleForTest(fakeModule());
    Notifications.scheduleNotificationAsync.mockImplementation(async (request) => {
      calls.push(['alert', request.content.data.kind]);
      return 'gymido.rest';
    });
    // A delivered alert left from the previous rest.
    tray.tray.delivered.push({
      identifier: 'gymido.rest',
      content: { data: { kind: 'rest-end', source: 'scheduled', setId: 101 } },
      trigger: null,
    });
    Notifications.dismissNotificationAsync.mockImplementation(async (id) => {
      calls.push(['dismiss-rest-end', id]);
      tray.tray.delivered = [];
    });

    // Both queued synchronously, exactly as useRestTimer does at a rest start.
    const countdown = RestCountdown.start({ barStartMs: 0, endMs: Date.now() + 60000, setId: 201 });
    const alert = sendRestEndNotification({ endMs: Date.now() + 60000, setId: 201 });
    await Promise.all([countdown, alert]);

    expect(names()).toEqual(['dismiss-rest-end', 'end', 'isEnabled', 'start', 'alert']);
  });

  it('start is skipped quietly when not enabled (O13.4), but the old countdown still ends', async () => {
    const module = fakeModule({ enabled: false });
    setRestCountdownModuleForTest(module);
    await RestCountdown.start({ barStartMs: 0, endMs: 60000, setId: 1 });

    expect(module.end).toHaveBeenCalledTimes(1);
    expect(module.start).not.toHaveBeenCalled();
  });

  it('update and end pass straight through, each with a fresh token for update', async () => {
    const module = fakeModule();
    setRestCountdownModuleForTest(module);
    await RestCountdown.update({ barStartMs: 5, endMs: 65000 });
    await RestCountdown.update({ barStartMs: 5, endMs: 70000 });
    await RestCountdown.end();

    expect(module.update).toHaveBeenNthCalledWith(1, 5, 65000, 'countdown-1');
    expect(module.update).toHaveBeenNthCalledWith(2, 5, 70000, 'countdown-2');
    expect(module.end).toHaveBeenCalledTimes(1);
  });

  it('is a quiet no-op with no native module (Jest, or an older build)', async () => {
    setRestCountdownModuleForTest(null);
    await expect(RestCountdown.start({ barStartMs: 0, endMs: 1, setId: 1 })).resolves.toBeUndefined();
    await expect(RestCountdown.update({ barStartMs: 0, endMs: 1 })).resolves.toBeNull();
    await expect(RestCountdown.end()).resolves.toBeNull();
    await expect(RestCountdown.isEnabled()).resolves.toBe(false);
  });

  it('a native failure never escapes: the rest timer must not break', async () => {
    setRestCountdownModuleForTest(fakeModule({ fail: true }));
    await expect(RestCountdown.start({ barStartMs: 0, endMs: 1, setId: 1 })).resolves.toBeUndefined();
    await expect(RestCountdown.end()).resolves.toBeNull();
  });
});

describe('countdownTimes', () => {
  it('derives the bar start from the total, not the engine start (O13.1)', () => {
    // A 60s rest that +5s grew to 65s total, now ending at 100000.
    expect(countdownTimes({ endMs: 100000, totalSeconds: 65 })).toEqual({ barStartMs: 35000, endMs: 100000 });
  });
});
