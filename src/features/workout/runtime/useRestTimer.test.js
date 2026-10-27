import { act, create } from 'react-test-renderer';

import useRestTimer from './useRestTimer';

function makeAlerts() {
  return { restStarted: jest.fn(), endMoved: jest.fn(), restEnded: jest.fn(), restCleared: jest.fn() };
}

function renderTimer(alerts) {
  const handle = {};
  function Harness() {
    Object.assign(handle, useRestTimer({ onRestComplete: () => {}, alerts }));
    return null;
  }
  let tree;
  act(() => {
    tree = create(<Harness />);
  });
  return { handle, tree };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useRestTimer', () => {
  it('alerts again for a second rest on the same set (done → undo → done)', () => {
    const alerts = makeAlerts();
    const { handle, tree } = renderTimer(alerts);

    act(() => handle.start('A', 2, null));
    act(() => jest.advanceTimersByTime(3000));
    expect(alerts.restEnded).toHaveBeenCalledTimes(1);
    expect(handle.timer).toBeNull();

    act(() => handle.start('A', 2, null));
    act(() => jest.advanceTimersByTime(3000));
    expect(alerts.restStarted).toHaveBeenCalledTimes(2);
    expect(alerts.restEnded).toHaveBeenCalledTimes(2);
    // A natural end never cancels its own alert.
    expect(alerts.restCleared).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
});

describe('10-second announcement (design system v1 #13)', () => {
  const { AccessibilityInfo } = require('react-native');
  const { restAnnouncement } = require('./useRestTimer');
  let announce;

  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });

  afterEach(() => {
    announce.mockRestore();
  });

  it('says the true number, singular for one second', () => {
    expect(restAnnouncement(10)).toBe('10 seconds left');
    expect(restAnnouncement(1)).toBe('1 second left');
  });

  it('announces once when counting down past 10, never again after +5 s', () => {
    const { handle, tree } = renderTimer(makeAlerts());
    act(() => handle.start('A', 12, null));
    expect(announce).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(2500));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith('10 seconds left');
    act(() => handle.adjust(5));
    act(() => jest.advanceTimersByTime(6000));
    expect(announce).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('announces right after the start of a short rest, and after a −5 s with the true number', () => {
    const short = renderTimer(makeAlerts());
    act(() => short.handle.start('A', 8, null));
    expect(announce).toHaveBeenLastCalledWith('8 seconds left');
    act(() => short.tree.unmount());

    announce.mockClear();
    const jump = renderTimer(makeAlerts());
    act(() => jump.handle.start('B', 12, null));
    act(() => jump.handle.adjust(-5));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith('7 seconds left');
    act(() => jump.tree.unmount());
  });

  it('resets on a new rest (same set re-completed)', () => {
    const { handle, tree } = renderTimer(makeAlerts());
    act(() => handle.start('A', 5, null));
    act(() => jest.advanceTimersByTime(6000));
    act(() => handle.start('A', 5, null));
    expect(announce).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });
});

// T-59 follow-up (PM + reviewer, 27 Oct): with a session id the rest lives in
// the session store, so ANY remount of the Workout screen (a font-scale
// remount, a rotation, leaving and coming back) resumes the same END time.
// The alert controller keeps its one scheduled alert: never cleared,
// restarted or re-armed with another end.
describe('useRestTimer with a session (survives remounts)', () => {
  const { endSessionState, peekSession } = require('./workoutSessionStore');

  function mountTimer(alerts, sessionId, onRestComplete = () => {}) {
    const handle = {};
    function Harness() {
      Object.assign(handle, useRestTimer({ onRestComplete, alerts, sessionId }));
      return null;
    }
    let tree;
    act(() => {
      tree = create(<Harness />);
    });
    return { handle, tree };
  }
  const endOf = (alerts) => alerts.restStarted.mock.calls[0][1];

  afterEach(() => endSessionState());

  it('a remount mid-rest keeps the remaining time and the end; exactly one scheduled alert, nothing cleared', () => {
    const alerts = makeAlerts();
    let { handle, tree } = mountTimer(alerts, 'S1');
    act(() => handle.start('A', 60, 'next'));
    act(() => handle.setMinimized(true));
    act(() => jest.advanceTimersByTime(20000));
    const end = endOf(alerts);
    act(() => tree.unmount());
    expect(alerts.restCleared).not.toHaveBeenCalled();
    // Away with a rest running: one server re-check is pending before its end.
    expect(peekSession('S1').checkTimer).not.toBeNull();

    act(() => jest.advanceTimersByTime(5000));
    ({ handle, tree } = mountTimer(alerts, 'S1'));
    expect(peekSession('S1').checkTimer).toBeNull();
    expect(handle.timer).toMatchObject({ setId: 'A', secondsLeft: 35, totalSeconds: 60, nextSetKey: 'next' });
    expect(handle.minimized).toBe(true);
    expect(alerts.restStarted).toHaveBeenCalledTimes(1);
    expect(alerts.restCleared).not.toHaveBeenCalled();
    alerts.endMoved.mock.calls.forEach(([endMs]) => expect(endMs).toBe(end));

    act(() => jest.advanceTimersByTime(36000));
    expect(alerts.restEnded).toHaveBeenCalledTimes(1);
    expect(alerts.restEnded).toHaveBeenCalledWith('A', end);
    act(() => tree.unmount());
  });

  it('a rest that ended while unmounted ends naturally on the next mount: one restEnded, no clear, the next set highlighted', () => {
    const alerts = makeAlerts();
    const onRestComplete = jest.fn();
    let { handle, tree } = mountTimer(alerts, 'S1', onRestComplete);
    act(() => handle.start('A', 10, 'next'));
    act(() => tree.unmount());
    act(() => jest.advanceTimersByTime(15000));
    ({ handle, tree } = mountTimer(alerts, 'S1', onRestComplete));
    expect(handle.timer).toBeNull();
    expect(alerts.restEnded).toHaveBeenCalledTimes(1);
    expect(alerts.restCleared).not.toHaveBeenCalled();
    expect(onRestComplete).toHaveBeenCalledWith('next');
    expect(peekSession('S1').rest).toBeNull();
    act(() => tree.unmount());
  });

  it('clear() empties the stored rest; a new session starts clean', () => {
    const alerts = makeAlerts();
    let { handle, tree } = mountTimer(alerts, 'S1');
    act(() => handle.start('A', 60, null));
    act(() => handle.clear());
    act(() => tree.unmount());
    ({ handle, tree } = mountTimer(alerts, 'S1'));
    expect(handle.timer).toBeNull();
    act(() => handle.start('B', 60, null));
    act(() => tree.unmount());
    ({ handle, tree } = mountTimer(alerts, 'S2'));
    expect(handle.timer).toBeNull();
    act(() => tree.unmount());
  });

  it('without a session id an unmount still clears the rest (Pairing D, unchanged)', () => {
    const alerts = makeAlerts();
    const { handle, tree } = renderTimer(alerts);
    act(() => handle.start('A', 60, null));
    act(() => tree.unmount());
    expect(alerts.restCleared).toHaveBeenCalledTimes(1);
  });
});
