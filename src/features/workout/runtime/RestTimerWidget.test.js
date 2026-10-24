import { act, create } from 'react-test-renderer';

import { RestTimerWidget } from './RuntimeOverlays';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);

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
