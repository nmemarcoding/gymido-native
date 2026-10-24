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
