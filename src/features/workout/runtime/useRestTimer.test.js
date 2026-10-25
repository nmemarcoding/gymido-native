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
