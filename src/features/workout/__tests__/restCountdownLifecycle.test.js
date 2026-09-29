import * as Notifications from 'expo-notifications';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { resetRestAlertsForTest } from '../../../shared/time/restAlerts';
import { setRestCountdownModuleForTest } from '../../../shared/time/restCountdown';
import { useRestTimer } from '../runtime/useRestTimer';

// [O13.3] Lifecycle pairing: the lock-screen countdown is bound to the REST,
// never to foreground state. Every start has exactly one end on every path that
// clears the rest, ±5s updates it, and no AppState transition touches it.

const REST_SECONDS = 60;
let handlers = [];
let log = [];
let module;

function emit(state) {
  handlers.forEach((handler) => handler(state));
}

function fakeModule() {
  const record = (name) =>
    jest.fn(async (...args) => {
      log.push([name, ...args]);
      return name === 'isEnabled' ? true : undefined;
    });
  return { isEnabled: record('isEnabled'), start: record('start'), update: record('update'), end: record('end') };
}

// Lets every queued rest operation finish.
async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  });
}

async function startRest(result, { setId = 201, restSeconds = REST_SECONDS } = {}) {
  await act(async () => {
    result.current.startRestTimer({ setId, restSeconds, nextSetKey: '301:202' });
  });
  await settle();
}

const count = (name) => log.filter(([entry]) => entry === name).length;

beforeEach(async () => {
  handlers = [];
  log = [];
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
  module = fakeModule();
  setRestCountdownModuleForTest(module);
  Notifications.scheduleNotificationAsync.mockImplementation(async (request) => {
    log.push(['alert', request.trigger ? 'scheduled' : 'foreground']);
    return 'gymido.rest';
  });
});

afterEach(() => {
  Notifications.scheduleNotificationAsync.mockReset();
  Notifications.scheduleNotificationAsync.mockImplementation(() => Promise.resolve('notification-id'));
});

afterAll(() => setRestCountdownModuleForTest(null));

describe('[O13] countdown lifecycle', () => {
  it('starts with the rest, for its end instant, with the bar spanning the total', async () => {
    const before = Date.now();
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);

    expect(module.start).toHaveBeenCalledTimes(1);
    const [barStartMs, endMs, setId] = module.start.mock.calls[0];
    expect(endMs).toBeGreaterThanOrEqual(before + REST_SECONDS * 1000);
    expect(endMs).toBeLessThan(before + (REST_SECONDS + 2) * 1000);
    expect(endMs - barStartMs).toBe(REST_SECONDS * 1000);
    expect(setId).toBe('201');
  });

  it('is queued before the O4 alert at a rest start (A1 rule 13)', async () => {
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    const order = log.map(([name]) => name).filter((name) => name === 'start' || name === 'alert');
    expect(order).toEqual(['start', 'alert']);
  });

  it('+5s updates it: new end, and the bar grows with the total', async () => {
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    const [, firstEnd] = module.start.mock.calls[0];

    await act(async () => result.current.adjustRestTimer(5));
    await settle();

    expect(module.update).toHaveBeenCalledTimes(1);
    const [barStartMs, endMs] = module.update.mock.calls[0];
    expect(Math.abs(endMs - (firstEnd + 5000))).toBeLessThanOrEqual(1000);
    expect(endMs - barStartMs).toBe((REST_SECONDS + 5) * 1000);
  });

  it.each([
    ['skip', (result) => result.current.skipRestTimer()],
    ['clear (un-complete, complete, discard)', (result) => result.current.clearRestTimer()],
  ])('%s ends it exactly once', async (_label, clear) => {
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    await act(async () => clear(result));
    await settle();
    expect(count('end')).toBe(2); // one inside start (the previous rest's), one here
    const lastEnd = log.map(([name]) => name).lastIndexOf('end');
    expect(lastEnd).toBeGreaterThan(log.map(([name]) => name).indexOf('start'));
  });

  it('−5s down to zero is the silent end: an end, never an update to the past', async () => {
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result, { restSeconds: 5 });
    await act(async () => result.current.adjustRestTimer(-5));
    await settle();

    expect(module.update).not.toHaveBeenCalled();
    expect(log.map(([name]) => name).slice(-1)[0]).toBe('end');
    expect(log.some(([name, kind]) => name === 'alert' && kind === 'foreground')).toBe(false);
  });

  it('unmounting the screen ends it', async () => {
    const { result, unmount } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    await act(async () => unmount());
    await settle();
    expect(log.map(([name]) => name).slice(-1)[0]).toBe('end');
  });

  it('a new rest ends the old countdown, THEN starts the new one', async () => {
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result, { setId: 201 });
    await startRest(result, { setId: 202 });

    const tail = log.map(([name]) => name).filter((name) => name === 'start' || name === 'end');
    // [start 201's own pre-end, start 201], then 202: end before start.
    expect(tail.slice(-2)).toEqual(['end', 'start']);
    expect(module.start.mock.calls[1][2]).toBe('202');
  });

  it('is never touched by AppState: resume and leaving leave it running', async () => {
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result);
    const before = log.length;
    const countdownCalls = () => log.slice(before).filter(([name]) => ['start', 'update', 'end'].includes(name));

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await act(async () => emit('active'));
      await act(async () => emit('background'));
    }
    await settle();
    expect(countdownCalls()).toEqual([]);
  });

  it('natural end in the foreground: the countdown ends BEFORE the parity alert (O13.3)', async () => {
    const { result } = await renderHook(() => useRestTimer({}));
    await startRest(result, { restSeconds: 1 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1700));
    });
    await settle();

    const names = log.map(([name, kind]) => (name === 'alert' ? `alert:${kind}` : name));
    const end = names.lastIndexOf('end');
    const parity = names.indexOf('alert:foreground');
    expect(parity).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(-1);
    expect(end).toBeLessThan(parity);
    // And it is not ended a second time after the alert.
    expect(names.slice(parity).includes('end')).toBe(false);
  });
});
