import { act, create } from 'react-test-renderer';

import { RestTimerWidget } from './RuntimeOverlays';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
let mockReducedMotion = false;
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));

function render(props) {
  let tree;
  act(() => {
    tree = create(
      <RestTimerWidget
        timer={{ setId: 1, secondsLeft: 60, totalSeconds: 90 }}
        onMinimize={() => {}}
        onAdjust={() => {}}
        onSkip={() => {}}
        position={null}
        onPosition={() => {}}
        {...props}
      />
    );
  });
  return tree.root.findAll((node) => node.props.testID === 'rest-timer' && typeof node.type === 'string')[0];
}

describe('RestTimerWidget accessibility (§22.1, M5)', () => {
  it('expands the minimized disc from a screen-reader activation', () => {
    const onExpand = jest.fn();
    const disc = render({ minimized: true, onExpand });
    expect(disc.props.accessible).toBe(true);
    expect(disc.props.accessibilityRole).toBe('button');
    expect(disc.props.accessibilityLabel).toBe('Expand rest timer');
    expect(disc.props.accessibilityActions).toEqual([{ name: 'activate', label: 'Expand rest timer' }]);
    disc.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
    disc.props.onAccessibilityTap();
    expect(onExpand).toHaveBeenCalledTimes(2);
  });

  it('leaves the expanded disc to its inner controls', () => {
    const disc = render({ minimized: false, onExpand: jest.fn() });
    expect(disc.props.accessible).toBeUndefined();
    expect(disc.props.accessibilityActions).toBeUndefined();
  });
});

describe('last-10-seconds pulse and hit areas (design system v1 #8, #10, #12)', () => {
  const { Animated } = require('react-native');
  let loop;

  beforeEach(() => {
    // Stubbed: a real loop would keep animating forever in Jest.
    loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  });

  afterEach(() => {
    loop.mockRestore();
    mockReducedMotion = false;
  });

  it('pulses the digits (1 → 1.06) only in the last 10 seconds', () => {
    render({ minimized: false, timer: { setId: 1, secondsLeft: 30, totalSeconds: 90 } });
    expect(loop).not.toHaveBeenCalled();
    render({ minimized: false, timer: { setId: 1, secondsLeft: 8, totalSeconds: 90 } });
    expect(loop).toHaveBeenCalled();
  });

  it('never pulses under reduced motion', () => {
    mockReducedMotion = true;
    render({ minimized: false, timer: { setId: 1, secondsLeft: 8, totalSeconds: 90 } });
    expect(loop).not.toHaveBeenCalled();
  });

  it('gives the controls 44 pt targets without overlapping Skip and ±5', () => {
    let tree;
    act(() => {
      tree = create(
        <RestTimerWidget timer={{ setId: 1, secondsLeft: 60, totalSeconds: 90 }} minimized={false} onMinimize={() => {}} onAdjust={() => {}} onSkip={() => {}} position={null} onPosition={() => {}} />
      );
    });
    const byId = (id) => tree.root.find((node) => node.props.testID === id && node.props.onPress);
    expect(byId('rest-timer-minus').props.hitSlop).toEqual({ top: 4, bottom: 4 });
    expect(byId('rest-timer-plus').props.hitSlop).toEqual({ top: 4, bottom: 4 });
    expect(byId('rest-timer-minimize').props.hitSlop).toBe(6);
    expect(byId('rest-timer-skip').props.hitSlop).toEqual({ top: 9, bottom: 9 });
  });
});
