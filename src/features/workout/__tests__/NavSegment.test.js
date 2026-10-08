import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { FILL_DURATION_MS, NavSegmentBar, isSwipeUpToSheet } from '../runtime/NavSegment';

afterEach(() => {
  jest.restoreAllMocks();
  useReducedMotion.mockReturnValue(true);
});

// RN-SPEC-workout §19.8: dy < −45 px and |dy| > |dx| opens the sheet.
describe('isSwipeUpToSheet', () => {
  test.each([
    [{ dx: 0, dy: -46 }, true],
    [{ dx: 30, dy: -60 }, true],
    [{ dx: 0, dy: -45 }, false],
    [{ dx: -70, dy: -60 }, false],
    [{ dx: 0, dy: 60 }, false],
    [{ dx: 80, dy: 0 }, false],
  ])('%j → %s', (gesture, expected) => {
    expect(isSwipeUpToSheet(gesture)).toBe(expected);
  });
});

describe('fill animation', () => {
  test('300 ms ease-out to the new ratio when motion is allowed', async () => {
    useReducedMotion.mockReturnValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    const view = await render(<NavSegmentBar id={1} ratio={0} isViewed={false} isActive={false} />);
    await view.rerender(<NavSegmentBar id={1} ratio={0.5} isViewed={false} isActive={false} />);
    const config = timing.mock.calls.at(-1)[1];
    expect(config).toMatchObject({ toValue: 0.5, duration: FILL_DURATION_MS, useNativeDriver: true });
    expect(config.easing).toEqual(expect.any(Function));
  });

  test('no animation under reduced motion', async () => {
    useReducedMotion.mockReturnValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const view = await render(<NavSegmentBar id={1} ratio={0} isViewed={false} isActive={false} />);
    await view.rerender(<NavSegmentBar id={1} ratio={0.5} isViewed={false} isActive={false} />);
    expect(timing).not.toHaveBeenCalled();
  });
});
