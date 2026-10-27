import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { RetryButton } from '../../../shared/components/ErrorAlert';
import GradientFill from '../../../shared/components/GradientFill';
import PillButton from '../../../shared/components/PillButton';
import { colors, gradients, radii } from '../../../shared/theme/tokens';
import { FOCUS_DELAY_MS, STATE_MAX_WIDTH, WorkoutEmptyState, WorkoutErrorState } from './WorkoutStates';

// The module object itself, so spies on its getters reach the component.
const ReactNative = require('react-native');

const { AccessibilityInfo } = ReactNative;

const mounted = [];
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}
const host = (tree, testID) => tree.root.find((node) => node.props.testID === testID && typeof node.type === 'string');
const flat = (node) => StyleSheet.flatten(node.props.style);
const texts = (tree) => tree.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));

let announce;
let focus;
let handle;
beforeEach(() => {
  jest.useFakeTimers();
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  handle = jest.spyOn(ReactNative, 'findNodeHandle', 'get').mockReturnValue((ref) => (ref ? 11 : null));
});
afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  jest.useRealTimers();
  announce.mockRestore();
  focus.mockRestore();
  handle.mockRestore();
});

describe('W2 Workout unavailable (§D2, whole-page inline error WITH "Try again")', () => {
  it('shows the code copy and the transport message; role alert, announced', () => {
    const tree = render(<WorkoutErrorState message="Network Error" onRetry={jest.fn()} />);
    expect(texts(tree)).toEqual(['Workout unavailable', 'Network Error', 'Try again']);
    expect(host(tree, 'workout-error').props).toMatchObject({ accessibilityRole: 'alert', accessibilityLiveRegion: 'assertive' });
    expect(announce).toHaveBeenCalledWith('Workout unavailable Network Error');
  });

  it('the fallback message the screen passes ("Please try again.")', () => {
    expect(texts(render(<WorkoutErrorState message="Please try again." onRetry={jest.fn()} />))).toContain('Please try again.');
  });

  it('"Try again" is the ruling-2 Retry (glass 40/44, 14/600) and re-runs the load', () => {
    const onRetry = jest.fn();
    const tree = render(<WorkoutErrorState message="m" onRetry={onRetry} />);
    const retry = tree.root.findByType(RetryButton);
    expect(retry.props).toMatchObject({ title: 'Try again', testID: 'workout-error-retry', loading: false });
    expect(tree.root.findAllByType(PillButton)).toHaveLength(0);
    act(() => retry.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('retrying: label unchanged, disabled, busy', () => {
    const tree = render(<WorkoutErrorState message="m" onRetry={jest.fn()} retrying />);
    expect(host(tree, 'workout-error-retry').props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(texts(tree)).toContain('Try again');
  });

  it('PM parity: "Try again" gets the initial focus after mount', () => {
    render(<WorkoutErrorState message="m" onRetry={jest.fn()} />);
    expect(focus).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(FOCUS_DELAY_MS));
    expect(focus).toHaveBeenCalledWith(11);
  });

  it('no focus move after unmount', () => {
    const tree = render(<WorkoutErrorState message="m" onRetry={jest.fn()} />);
    act(() => tree.unmount());
    mounted.splice(0);
    act(() => jest.advanceTimersByTime(FOCUS_DELAY_MS));
    expect(focus).not.toHaveBeenCalled();
  });

  it('look: danger-edged card radius 28, 640 max centred, 72 icon tile, 32/34/700 title, 14/22 secondary body', () => {
    const tree = render(<WorkoutErrorState message="m" onRetry={jest.fn()} />);
    expect(flat(host(tree, 'workout-error'))).toMatchObject({
      borderRadius: radii.xxl,
      borderColor: colors.dangerTextBorder,
      maxWidth: STATE_MAX_WIDTH,
      alignSelf: 'center',
      paddingVertical: 32,
      paddingHorizontal: 24,
      overflow: 'hidden',
    });
    expect(STATE_MAX_WIDTH).toBe(640);
    expect(flat(host(tree, 'workout-error-icon'))).toMatchObject({ width: 72, height: 72, borderRadius: radii.xl, backgroundColor: colors.dangerTextTint });
    const [title, body] = tree.root.findAllByType(Text);
    expect(flat(title)).toMatchObject({ fontSize: 32, lineHeight: 34, fontFamily: 'Geist-Bold', marginTop: 18, color: colors.textPrimary });
    expect(flat(title).fontWeight).toBeUndefined();
    expect(flat(body)).toMatchObject({ fontSize: 14, lineHeight: 22, maxWidth: 290, color: colors.textSecondary });
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(2);
  });
});

describe('W1 No active workout plan (§D2 EmptyState, whole tab)', () => {
  it('code copy, polite, announced; "Browse plans" is the one gold primary', () => {
    const onBrowse = jest.fn();
    const tree = render(<WorkoutEmptyState onBrowse={onBrowse} />);
    expect(texts(tree)).toEqual([
      'No active workout plan',
      'Pick a plan first, then come back here to start a workout with real backend data.',
      'Browse plans',
    ]);
    expect(host(tree, 'workout-empty').props.accessibilityLiveRegion).toBe('polite');
    expect(announce).toHaveBeenCalledWith('No active workout plan');
    const [button] = tree.root.findAllByType(PillButton);
    expect(button.props).toMatchObject({ testID: 'workout-browse-plans', title: 'Browse plans' });
    expect(button.props.variant).toBeUndefined();
    act(() => button.props.onPress());
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });

  it('look: gradient-card + gold top glow from the first render, 132 disc, 32 title, 640 centred', () => {
    const tree = render(<WorkoutEmptyState onBrowse={jest.fn()} />);
    expect(flat(host(tree, 'workout-empty'))).toMatchObject({ borderRadius: radii.xxl, maxWidth: 640, alignSelf: 'center', paddingVertical: 40, borderColor: colors.hairlineStrong });
    const fills = tree.root.findAllByType(GradientFill);
    expect(fills).toHaveLength(3);
    expect(fills[0].props.colors).toBe(gradients.card.colors);
    expect(fills[1].props.colors).toBe(gradients.goldAmbient.colors);
    expect(flat(host(tree, 'workout-empty-icon'))).toMatchObject({ width: 132, height: 132, borderRadius: radii.full, overflow: 'hidden' });
    const [title] = tree.root.findAllByType(Text);
    expect(flat(title)).toMatchObject({ fontSize: 32, marginTop: 22 });
    expect(focus).not.toHaveBeenCalled();
  });
});
