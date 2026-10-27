import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { RetryButton } from '../../../shared/components/ErrorAlert';
import FeedbackIcon from '../../../shared/components/FeedbackIcon';
import GradientFill from '../../../shared/components/GradientFill';
import PillButton from '../../../shared/components/PillButton';
import { colors, gradients, radii } from '../../../shared/theme/tokens';
import { FOCUS_DELAY_MS, STATE_MAX_WIDTH, WorkoutEmptyState, WorkoutErrorState } from './WorkoutStates';
import { textScale } from '../../../shared/theme/tokens';

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

  it('look: danger-edged card radius 32 (board), 640 max centred, 72 icon tile, 32/34/700 title, 14/22 secondary body', () => {
    const tree = render(<WorkoutErrorState message="m" onRetry={jest.fn()} />);
    expect(flat(host(tree, 'workout-error'))).toMatchObject({
      borderRadius: 32,
      borderColor: colors.dangerLine,
      maxWidth: STATE_MAX_WIDTH,
      alignSelf: 'center',
      paddingVertical: 32,
      paddingHorizontal: 24,
      overflow: 'hidden',
    });
    expect(STATE_MAX_WIDTH).toBe(640);
    expect(flat(host(tree, 'workout-error-icon'))).toMatchObject({ width: 72, height: 72, borderRadius: radii.xl, backgroundColor: colors.dangerTint });
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
    expect(flat(host(tree, 'workout-empty'))).toMatchObject({ borderRadius: 32, maxWidth: 640, alignSelf: 'center', paddingVertical: 40, borderColor: colors.hairlineStrong });
    const fills = tree.root.findAllByType(GradientFill);
    expect(fills).toHaveLength(3);
    expect(fills[0].props.colors).toBe(gradients.card.colors);
    expect(fills[1].props.colors).toBe(gradients.heroGlow.colors);
    expect(flat(host(tree, 'workout-empty-icon'))).toMatchObject({ width: 132, height: 132, borderRadius: radii.full, overflow: 'hidden' });
    const [title] = tree.root.findAllByType(Text);
    expect(flat(title)).toMatchObject({ fontSize: 32, marginTop: 22 });
    expect(focus).not.toHaveBeenCalled();
  });
});

describe('Phase 2 tokens: exact board colours (UX §8.5 ladder)', () => {
  it('error card: gradient-danger-card + glow-danger-ambient, danger-line edge, danger-tint tile', () => {
    const tree = render(<WorkoutErrorState message="m" onRetry={jest.fn()} />);
    const [card, glow] = tree.root.findAllByType(GradientFill);
    expect(card.props).toMatchObject({ angle: 160, colors: gradients.dangerCard.colors });
    expect(glow.props.colors).toBe(gradients.signInFailedGlow.colors);
    expect(glow.props.colors[0]).toBe('rgba(255, 90, 78, 0.18)');
    expect(flat(host(tree, 'workout-error')).borderColor).toBe('rgba(255, 90, 78, 0.30)');
    expect(flat(host(tree, 'workout-error-icon')).backgroundColor).toBe('rgba(255, 90, 78, 0.14)');
  });

  it('empty card: gold-orb glows (0.26) on the top wash and the disc; the bar in text-secondary', () => {
    const tree = render(<WorkoutEmptyState onBrowse={jest.fn()} />);
    const fills = tree.root.findAllByType(GradientFill);
    expect(fills[1].props.colors[0]).toBe('rgba(255, 194, 26, 0.26)');
    expect(fills[2].props).toMatchObject({ colors: ['rgba(255, 194, 26, 0.26)', colors.fillWell], stops: [0, 0.7] });
    const svgRects = tree.root.findAll((node) => node.props.fill === colors.textSecondary && node.props.width === 22);
    expect(svgRects.length).toBeGreaterThan(0);
  });
});

describe('UX §9 large text', () => {
  const cases = [
    ['error', () => <WorkoutErrorState message="Network Error" onRetry={jest.fn()} />],
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

  it('no fixed height on the text cards (they grow with the text)', () => {
    [render(<WorkoutErrorState message="m" onRetry={jest.fn()} />), render(<WorkoutEmptyState onBrowse={jest.fn()} />)].forEach((tree) => {
      ['workout-error', 'workout-empty'].forEach((id) => {
        const found = tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
        found.forEach((node) => expect(flat(node).height).toBeUndefined());
      });
    });
  });
});

describe('Board geometry (phase2-open-items §3 D)', () => {
  it('error: the 26 px warning glyph inside the 72 tile (board), danger-text', () => {
    const tree = render(<WorkoutErrorState message="m" onRetry={jest.fn()} />);
    const icon = host(tree, 'workout-error-icon').findByType(FeedbackIcon);
    expect(icon.props).toMatchObject({ name: 'warning', size: 26, color: colors.dangerText });
  });

  it('tile glyph ruling (tokens §7 "Tile glyphs"): the warning glyph renders 26 px at stroke 2.0 on its 24 viewBox, inside the 72 tile', () => {
    const tree = render(<WorkoutErrorState message="m" onRetry={jest.fn()} />);
    const tile = host(tree, 'workout-error-icon');
    expect(flat(tile)).toMatchObject({ width: 72, height: 72 });
    const svg = tile.find((node) => node.props.viewBox === '0 0 24 24' && typeof node.type !== 'string');
    expect(svg.props).toMatchObject({ width: 26, height: 26 });
    const stroke = tile.findAll((node) => node.props.strokeWidth !== undefined).map((node) => Number(node.props.strokeWidth));
    expect(stroke.length).toBeGreaterThan(0);
    stroke.forEach((value) => expect(value).toBe(2));
  });

  it('both cards draw the board radius 32 (no token), clipped', () => {
    const error = render(<WorkoutErrorState message="m" onRetry={jest.fn()} />);
    const empty = render(<WorkoutEmptyState onBrowse={jest.fn()} />);
    expect(flat(host(error, 'workout-error'))).toMatchObject({ borderRadius: 32, overflow: 'hidden' });
    expect(flat(host(empty, 'workout-empty'))).toMatchObject({ borderRadius: 32, overflow: 'hidden' });
  });

  it('the icon is fixed chrome: no Text, so the text scale never resizes it', () => {
    const tree = render(<WorkoutErrorState message="m" onRetry={jest.fn()} />);
    expect(host(tree, 'workout-error-icon').findAllByType(Text)).toHaveLength(0);
  });
});
