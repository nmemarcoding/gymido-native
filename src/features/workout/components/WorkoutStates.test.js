import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import FeedbackIcon from '../../../shared/components/FeedbackIcon';
import GradientFill from '../../../shared/components/GradientFill';
import { colors, radii, textScale } from '../../../shared/theme/tokens';
import HubButton from './hub/HubButton';
import { FOCUS_DELAY_MS, STATE_MAX_WIDTH, WorkoutEmptyState, WorkoutErrorState } from './WorkoutStates';

// DECLARED changes (T-76, 28 Oct 2026; boards "Workout hub states" 6 and 8,
// UX check U2/U3): the Phase 2 look tests (radius 32 glow cards, 72 tile,
// 132 disc, 32/34 title, gradient-card / danger glows, "Try again" glass
// secondary 48, the empty copy "…with real backend data.") are replaced by
// the hub card language below: error r24 danger-line with a 56 tile and the
// outlined 52 "Try again"; empty r28 with the 56 gold calendar tile, the
// brief's copy and "Build me a plan" only while the generator is on. The
// brief allows no coloured glow, so "no gradient layer" replaces the glow
// checks. Behaviour checks (role, announce, focus, busy retry, large text)
// are unchanged.

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
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
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

describe('state 8: Workout unavailable (whole-page error WITH "Try again")', () => {
  it('the brief\'s copy by default; role alert, announced', () => {
    const tree = render(<WorkoutErrorState onRetry={jest.fn()} />);
    expect(texts(tree)).toEqual(['Workout unavailable', 'Please try again.', 'Try again']);
    expect(host(tree, 'workout-error').props).toMatchObject({ accessibilityRole: 'alert', accessibilityLiveRegion: 'assertive' });
    expect(announce).toHaveBeenCalledWith('Workout unavailable Please try again.');
  });

  it('"Try again" is the outlined 52 and re-runs the load', () => {
    const onRetry = jest.fn();
    const tree = render(<WorkoutErrorState onRetry={onRetry} />);
    const retry = tree.root.findAll((node) => node.type === HubButton && node.props.testID === 'workout-error-retry')[0];
    expect(retry.props).toMatchObject({ title: 'Try again', variant: 'outline', loading: false });
    expect(flat(host(tree, 'workout-error-retry'))).toMatchObject({ minHeight: 52, borderColor: colors.hairlineBright });
    act(() => retry.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('retrying: label unchanged, disabled, busy', () => {
    const tree = render(<WorkoutErrorState onRetry={jest.fn()} retrying />);
    expect(host(tree, 'workout-error-retry').props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(texts(tree)).toContain('Try again');
  });

  it('the title "Workout unavailable" gets the initial focus after mount', () => {
    handle.mockReturnValue((ref) => (ref?.props?.testID === 'workout-error-title' ? 21 : ref ? 11 : null));
    let tree;
    act(() => {
      tree = create(<WorkoutErrorState onRetry={jest.fn()} />);
    });
    mounted.push(tree);
    expect(focus).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(FOCUS_DELAY_MS));
    expect(focus).toHaveBeenCalledWith(21);
  });

  it('no focus move after unmount', () => {
    const tree = render(<WorkoutErrorState onRetry={jest.fn()} />);
    act(() => tree.unmount());
    mounted.splice(0);
    act(() => jest.advanceTimersByTime(FOCUS_DELAY_MS));
    expect(focus).not.toHaveBeenCalled();
  });

  it('look (U3): r24 danger-line card on surface, 640 max centred, 56 danger-tint tile with the 26 warning glyph, 24/30 title, 15/22 body; no gradient', () => {
    const tree = render(<WorkoutErrorState onRetry={jest.fn()} />);
    expect(flat(host(tree, 'workout-error'))).toMatchObject({
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.dangerLine,
      backgroundColor: colors.surface,
      maxWidth: STATE_MAX_WIDTH,
      alignSelf: 'center',
      paddingVertical: 28,
      paddingHorizontal: 20,
    });
    expect(flat(host(tree, 'workout-error-icon'))).toMatchObject({ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.dangerTint });
    expect(tree.root.findByType(FeedbackIcon).props).toMatchObject({ name: 'warning', size: 26, color: colors.dangerText });
    const [title, body] = tree.root.findAllByType(Text);
    expect(flat(title)).toMatchObject({ fontSize: 24, lineHeight: 30, color: colors.textPrimary, textAlign: 'center' });
    expect(flat(body)).toMatchObject({ fontSize: 15, lineHeight: 22, color: colors.textSecondary });
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(0);
  });
});

describe('state 6: No active workout plan (U2)', () => {
  it('the brief\'s copy, polite, announced; "Browse plans" is the one gold action', () => {
    const onBrowse = jest.fn();
    const tree = render(<WorkoutEmptyState onBrowse={onBrowse} onBuild={jest.fn()} />);
    expect(texts(tree)).toEqual(['No active workout plan', 'Pick a plan first, then come back here to start a workout.', 'Browse plans']);
    expect(host(tree, 'workout-empty').props.accessibilityLiveRegion).toBe('polite');
    expect(announce).toHaveBeenCalledWith('No active workout plan');
    expect(flat(host(tree, 'workout-browse-plans'))).toMatchObject({ minHeight: 56, backgroundColor: colors.gold });
    act(() => tree.root.findAll((node) => node.type === HubButton && node.props.testID === 'workout-browse-plans')[0].props.onPress());
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });

  it('"Build me a plan" (outlined) only while the generator is on', () => {
    const onBuild = jest.fn();
    expect(render(<WorkoutEmptyState onBrowse={jest.fn()} onBuild={onBuild} />).root.findAll((node) => node.props.testID === 'workout-build-plan')).toHaveLength(0);
    const tree = render(<WorkoutEmptyState onBrowse={jest.fn()} onBuild={onBuild} generatorAvailable />);
    expect(texts(tree)).toContain('Build me a plan');
    expect(flat(host(tree, 'workout-build-plan'))).toMatchObject({ minHeight: 52, borderColor: colors.hairlineBright });
    act(() => tree.root.findAll((node) => node.type === HubButton && node.props.testID === 'workout-build-plan')[0].props.onPress());
    expect(onBuild).toHaveBeenCalledTimes(1);
  });

  it('look: r28 hairline-strong card on surface, the 56 gold calendar tile, 24/30 title; no gradient', () => {
    const tree = render(<WorkoutEmptyState onBrowse={jest.fn()} />);
    expect(flat(host(tree, 'workout-empty'))).toMatchObject({
      borderRadius: radii.xxl,
      borderColor: colors.hairlineStrong,
      backgroundColor: colors.surface,
      maxWidth: STATE_MAX_WIDTH,
      alignSelf: 'center',
    });
    expect(flat(host(tree, 'workout-empty-icon'))).toMatchObject({ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.goldTint });
    expect(flat(tree.root.findAllByType(Text)[0])).toMatchObject({ fontSize: 24, lineHeight: 30 });
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(0);
  });
});

describe('UX §9 large text', () => {
  const cases = [
    ['error', () => <WorkoutErrorState onRetry={jest.fn()} />],
    ['empty', () => <WorkoutEmptyState onBrowse={jest.fn()} />],
  ];
  it.each(cases)('%s: title capped 1.6, wraps by word to 3 lines, shrinks a long word; body capped 2.0', (_, make) => {
    const tree = render(make());
    const [title, body] = tree.root.findAllByType(Text);
    expect(title.props).toMatchObject({
      maxFontSizeMultiplier: textScale.title,
      numberOfLines: 3,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.7,
      textBreakStrategy: 'simple',
    });
    expect(body.props.maxFontSizeMultiplier).toBe(textScale.body);
    expect(body.props.numberOfLines).toBeUndefined();
  });

  it('no fixed height on the cards (they grow with the text)', () => {
    expect(flat(host(render(<WorkoutErrorState onRetry={jest.fn()} />), 'workout-error')).height).toBeUndefined();
    expect(flat(host(render(<WorkoutEmptyState onBrowse={jest.fn()} />), 'workout-empty')).height).toBeUndefined();
  });

  it('the icon tiles hold no Text, so the text scale never resizes them', () => {
    expect(host(render(<WorkoutErrorState onRetry={jest.fn()} />), 'workout-error-icon').findAllByType(Text)).toHaveLength(0);
    expect(host(render(<WorkoutEmptyState onBrowse={jest.fn()} />), 'workout-empty-icon').findAllByType(Text)).toHaveLength(0);
  });
});
