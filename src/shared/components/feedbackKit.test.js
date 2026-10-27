import { AccessibilityInfo, Animated, Platform, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { act, create } from 'react-test-renderer';

import { colors, motion, radii } from '../theme/tokens';
import Banner, { BannerText } from './Banner';
import EmptyState, { EMPTY_STATE_DEFAULTS } from './EmptyState';
import ErrorAlert, { RETRY_HEIGHT, RETRY_SLOP, RetryButton } from './ErrorAlert';
import ErrorBox from './ErrorBox';
import { FEEDBACK_TONES, INLINE_ERROR_TILE, InlineError, SuccessState } from './FeedbackBox';
import FeedbackIcon, { FEEDBACK_ICON_NAMES } from './FeedbackIcon';
import GlassSurface from './GlassSurface';
import GradientFill from './GradientFill';
import Loader from './Loader';
import PillButton from './PillButton';
import RouteErrorBoundary, { RouteErrorFallback } from './RouteErrorBoundary';
import Skeleton, { SHIMMER_MS, SKELETON_RADIUS } from './Skeleton';
import Spinner from './Spinner';
import ToastHost, { InlineToast, TAB_BAR_CLEARANCE, TOAST_GAP, TOAST_TONES, ToastCard, toastPlacement } from './ToastHost';
import { useToastStore } from './toastStore';
import Card3D from '../../features/workout/components/Card3D';
import WorkoutSkeleton from '../../features/workout/components/WorkoutSkeleton';
import OnHoldBox from '../../features/myPlans/components/OnHoldBox';
import { ClientsBanner, InactiveBanner } from '../../features/trainer/plans/components/AffectedClients';

let mockReducedMotion = false;
jest.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { useSafeAreaInsets: () => mockInsets, SafeAreaView: View };
});
jest.mock('expo', () => ({ reloadAppAsync: jest.fn() }));

const mounted = [];
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}
const flat = (node) => StyleSheet.flatten(node.props.style);
const host = (tree, testID) => tree.root.find((node) => node.props.testID === testID && typeof node.type === 'string');
const texts = (tree) => tree.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));
const byTitle = (tree, title) => tree.root.findAll((node) => node.type === PillButton && node.props.title === title);

function atWidth(width) {
  const dimensions = require('react-native/Libraries/Utilities/useWindowDimensions');
  return jest.spyOn(dimensions, 'default').mockReturnValue({ width, height: 900, scale: 2, fontScale: 1 });
}

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  mockReducedMotion = false;
  mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  jest.restoreAllMocks();
});

describe('FeedbackIcon', () => {
  it.each(FEEDBACK_ICON_NAMES)('%s: an Svg with explicit size, hidden from screen readers', (name) => {
    const svg = render(<FeedbackIcon name={name} size={20} color={colors.info} />).root.findByType(Svg);
    expect(svg.props).toMatchObject({ width: 20, height: 20, stroke: colors.info, strokeLinecap: 'round', accessibilityElementsHidden: true });
  });
});

describe('Spinner (§5: never stops)', () => {
  it('turns once a second by default', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render(<Spinner />);
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: motion.spinnerLoopMs }));
  });

  it('under reduced motion slows to 3 s per turn and keeps looping (no opt-in needed)', () => {
    mockReducedMotion = true;
    const timing = jest.spyOn(Animated, 'timing');
    const loop = jest.spyOn(Animated, 'loop');
    render(<Spinner />);
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: 3000 }));
    expect(loop).toHaveBeenCalled();
  });

  it('still honours a caller-given reduced pace', () => {
    mockReducedMotion = true;
    const timing = jest.spyOn(Animated, 'timing');
    render(<Spinner reducedMotionLoopMs={4500} />);
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: 4500 }));
  });

  it('draws a gold round-capped arc on a faint track in a fixed-size Svg', () => {
    const tree = render(<Spinner size={36} thickness={4} />);
    const svg = tree.root.findByType(Svg);
    expect(svg.props).toMatchObject({ width: 36, height: 36 });
    expect(tree.root.findByType(Circle).props).toMatchObject({ stroke: colors.hairlineStrong, strokeWidth: 4, r: 16 });
    expect(tree.root.findByType(Path).props).toMatchObject({ stroke: colors.gold, strokeLinecap: 'round' });
    expect(tree.root.findByType(Animated.View).props.accessibilityElementsHidden).toBe(true);
  });

  it('keeps callers’ colours (button spinners on a transparent track)', () => {
    const tree = render(<Spinner size={16} thickness={2} color={colors.onGold} track="transparent" />);
    expect(tree.root.findByType(Circle).props.stroke).toBe('transparent');
    expect(tree.root.findByType(Path).props.stroke).toBe(colors.onGold);
  });
});

describe('Loader', () => {
  it('defaults the label to "Loading" and is a busy progressbar', () => {
    const tree = render(<Loader />);
    const region = tree.root.find((node) => node.props.accessibilityRole === 'progressbar' && typeof node.type === 'string');
    expect(region.props.accessibilityLabel).toBe('Loading');
    expect(region.props.accessibilityState).toEqual({ busy: true });
    expect(texts(tree)).toEqual(['Loading']);
  });

  it('shows the screen’s label beside an 18 px spinner, 14 secondary', () => {
    const tree = render(<Loader label="Loading dashboard" />);
    expect(texts(tree)).toEqual(['Loading dashboard']);
    expect(tree.root.findByType(Spinner).props).toMatchObject({ size: 18, thickness: 2, track: colors.hairlineButton });
    expect(flat(tree.root.findByType(Text))).toMatchObject({ fontSize: 14, color: colors.textSecondary, fontFamily: 'Geist-Regular' });
    expect(flat(tree.root.findByType(Text)).fontWeight).toBeUndefined();
  });
});

describe('Skeleton (§5)', () => {
  const layout = (tree, width) => act(() => host(tree, 'sk').props.onLayout({ nativeEvent: { layout: { width, height: 12 } } }));

  it('is a fillSkeleton block, radius 10, hidden from screen readers', () => {
    const block = host(render(<Skeleton testID="sk" style={{ height: 12 }} />), 'sk');
    expect(flat(block)).toMatchObject({ backgroundColor: colors.fillSkeleton, borderRadius: SKELETON_RADIUS, height: 12, overflow: 'hidden' });
    expect(SKELETON_RADIUS).toBe(10);
    expect(block.props.accessibilityElementsHidden).toBe(true);
    expect(block.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('takes a radius for pills and rings', () => {
    expect(flat(host(render(<Skeleton testID="sk" radius={radii.full} />), 'sk')).borderRadius).toBe(radii.full);
  });

  it('mounts the shimmer gradient from the first render and sweeps once laid out', () => {
    const loop = jest.spyOn(Animated, 'loop');
    const timing = jest.spyOn(Animated, 'timing');
    const tree = render(<Skeleton testID="sk" />);
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(1);
    expect(loop).not.toHaveBeenCalled();
    layout(tree, 200);
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: SHIMMER_MS }));
    expect(flat(host(tree, 'sk-shimmer')).opacity).toBe(1);
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(1);
  });

  it('turns the shimmer off under reduced motion (hidden, no loop)', () => {
    mockReducedMotion = true;
    const loop = jest.spyOn(Animated, 'loop');
    const tree = render(<Skeleton testID="sk" />);
    layout(tree, 200);
    expect(loop).not.toHaveBeenCalled();
    expect(flat(host(tree, 'sk-shimmer')).opacity).toBe(0);
  });

  it('can be a static block with no shimmer layer at all', () => {
    const tree = render(<Skeleton testID="sk" shimmer={false} />);
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(0);
  });
});

describe('WorkoutSkeleton', () => {
  it('keeps its loading region and draws the hub shape from Skeleton blocks', () => {
    const tree = render(<WorkoutSkeleton />);
    const region = host(tree, 'workout-skeleton');
    expect(region.props).toMatchObject({ accessibilityRole: 'progressbar', accessibilityLabel: 'Loading workout', accessibilityLiveRegion: 'polite' });
    const blocks = tree.root.findAllByType(Skeleton);
    expect(blocks.length).toBe(18);
    expect(blocks.filter((block) => block.props.radius === radii.full)).toHaveLength(10);
  });

  it('lays the day cards in 1 column on phones and 2 on tablets', () => {
    const cardWidths = (tree) =>
      tree.root.findAllByType(Card3D).slice(1).map((node) => StyleSheet.flatten(node.props.style).width);
    atWidth(390);
    expect(cardWidths(render(<WorkoutSkeleton />))).toEqual(['100%', '100%', '100%']);
    mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
    jest.restoreAllMocks();
    atWidth(834);
    expect(cardWidths(render(<WorkoutSkeleton />))).toEqual(['48%', '48%', '48%']);
  });
});

describe('EmptyState (§5)', () => {
  it('shows UX’s defaults in a centred card with the 44 px icon tile', () => {
    const tree = render(<EmptyState />);
    expect(texts(tree)).toEqual([EMPTY_STATE_DEFAULTS.title, EMPTY_STATE_DEFAULTS.message]);
    expect(EMPTY_STATE_DEFAULTS).toEqual({ title: 'Nothing to show yet', message: 'Once data is available, it will appear here.' });
    const tile = host(tree, 'empty-state-icon');
    // D's kit fold: the State boards' 0.07 ring track → track.
    expect(flat(tile)).toMatchObject({ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.track });
    expect(tree.root.findByType(FeedbackIcon).props.name).toBe('empty');
  });

  it('uses the screen’s copy, title 15/600 and message 13 muted, with no live region by default (review)', () => {
    const tree = render(<EmptyState title="No exercises found" message="Try a different search term." />);
    expect(texts(tree)).toEqual(['No exercises found', 'Try a different search term.']);
    const [title, message] = tree.root.findAllByType(Text);
    expect(flat(title)).toMatchObject({ fontSize: 15, fontFamily: 'Geist-SemiBold', color: colors.textPrimary, textAlign: 'center' });
    expect(flat(message)).toMatchObject({ fontSize: 13, color: colors.textMuted });
    const card = title.parent.parent;
    expect(flat(card)).toMatchObject({ backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radii.xl, alignItems: 'center' });
    expect(tree.root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityLiveRegion)).toHaveLength(0);
  });

  it('is a polite live region only when the screen opts in with `live`', () => {
    const tree = render(<EmptyState live title="Nothing yet" message="Later." />);
    expect(tree.root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityLiveRegion === 'polite')).toHaveLength(1);
  });

  it('hides the message when the screen passes null', () => {
    expect(texts(render(<EmptyState title="No days yet" message={null} />))).toEqual(['No days yet']);
  });

  it('offers the optional action as a glass button that fires onAction', () => {
    const onAction = jest.fn();
    const tree = render(<EmptyState title="t" message="m" actionLabel="Browse plans" actionTestID="go" onAction={onAction} />);
    const [button] = byTitle(tree, 'Browse plans');
    expect(button.props).toMatchObject({ variant: 'secondary', testID: 'go' });
    act(() => button.props.onPress());
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('has no button without an action label', () => {
    expect(render(<EmptyState title="t" message="m" />).root.findAllByType(PillButton)).toHaveLength(0);
  });

  it('draws the danger-text disc for icon="error"', () => {
    const tree = render(<EmptyState icon="error" title="t" message="m" />);
    expect(flat(host(tree, 'empty-state-error-icon'))).toMatchObject({ borderRadius: radii.full, backgroundColor: colors.dangerTextTint });
    expect(tree.root.findByType(FeedbackIcon).props).toMatchObject({ name: 'error', color: colors.dangerText });
  });
});

describe('FeedbackBox: InlineError / SuccessState / ErrorBox (§5)', () => {
  it('InlineError: default title, role alert, the danger card (dangerFaint fill, dangerLine edge) with the error icon', () => {
    const tree = render(<InlineError testID="err" message="Please try again." />);
    const box = host(tree, 'err');
    expect(box.props.accessibilityRole).toBe('alert');
    expect(flat(box)).toMatchObject({
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.dangerFaint,
      borderColor: colors.dangerLine,
    });
    expect(colors.dangerFaint).toBe('rgba(255, 90, 78, 0.08)');
    expect(colors.dangerLine).toBe('rgba(255, 90, 78, 0.30)');
    expect(texts(tree)).toEqual(['Something went wrong', 'Please try again.']);
    expect(tree.root.findByType(FeedbackIcon).props).toMatchObject({ name: 'error', color: colors.dangerText });
  });

  it('InlineError icon tile: the 150° dangerLine → dangerFaint gradient from the first render, dangerLine edge, clipped', () => {
    const tree = render(<InlineError testID="err" message="m" />);
    const tile = host(tree, 'inline-error-icon');
    expect(flat(tile)).toMatchObject({ width: INLINE_ERROR_TILE, height: INLINE_ERROR_TILE, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.dangerLine, overflow: 'hidden' });
    expect(tree.root.findByType(GradientFill).props).toMatchObject({ angle: 150, colors: [colors.dangerLine, colors.dangerFaint] });
    // The icon sits inside the tile, in the text colour (U1).
    expect(tree.root.findByType(FeedbackIcon).parent.props.testID).toBe('inline-error-icon');
  });

  it('InlineError (§D1 + State boards): dangerText title (600) over the dangerTextSoft message', () => {
    const [title, message] = render(<InlineError title="Dashboard unavailable" message="m" />).root.findAllByType(Text);
    expect(flat(title)).toMatchObject({ fontFamily: 'Geist-SemiBold', color: colors.dangerText });
    expect(flat(message)).toMatchObject({ color: colors.dangerTextSoft });
  });

  it('InlineError without a message: the title only, tile still drawn', () => {
    const tree = render(<InlineError testID="err" />);
    expect(texts(tree)).toEqual(['Something went wrong']);
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(1);
  });

  it('InlineError is announced on mount and when its text changes, assertive on Android', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const tree = render(<InlineError testID="err" title="Please check this answer" message="Too many days." />);
    expect(announce).toHaveBeenCalledWith('Please check this answer. Too many days.');
    expect(host(tree, 'err').props.accessibilityLiveRegion).toBe('assertive');
    announce.mockClear();
    act(() => tree.update(<InlineError testID="err" title="Please check this answer" message="Pick fewer." />));
    expect(announce).toHaveBeenCalledWith('Please check this answer. Pick fewer.');
  });

  it('ErrorBox / SuccessState keep the primary title and muted message (only InlineError changes)', () => {
    const [title, message] = render(<ErrorBox title="Something went wrong" message="x" />).root.findAllByType(Text);
    expect(flat(title).color).toBe(colors.textPrimary);
    expect(flat(message).color).toBe(colors.textMuted);
  });

  it('SuccessState: default "Success", teal tint and a teal check, role summary', () => {
    const tree = render(<SuccessState testID="ok" message="Profile created." />);
    const box = host(tree, 'ok');
    expect(box.props.accessibilityRole).toBe('summary');
    // Success is green everywhere (UX, 26 Oct).
    expect(flat(box)).toMatchObject({ backgroundColor: 'rgba(74, 222, 128, 0.08)', borderColor: 'rgba(74, 222, 128, 0.25)' });
    expect(texts(tree)).toEqual(['Success', 'Profile created.']);
    expect(tree.root.findByType(FeedbackIcon).props).toMatchObject({ name: 'check', color: colors.success });
    expect(FEEDBACK_TONES.success.iconColor).toBe(colors.success);
  });

  it('no message: title only', () => {
    expect(texts(render(<SuccessState />))).toEqual(['Success']);
  });

  it('ErrorBox: the error box, title optional as in v1', () => {
    const tree = render(<ErrorBox testID="eb" message="Login failed" />);
    expect(host(tree, 'eb').props.accessibilityRole).toBe('alert');
    expect(texts(tree)).toEqual(['Login failed']);
    expect(flat(host(tree, 'eb')).backgroundColor).toBe(colors.dangerTextFill);
    expect(texts(render(<ErrorBox title="Something went wrong" message="x" />))).toEqual(['Something went wrong', 'x']);
  });
});

describe('ErrorAlert (§5)', () => {
  it('a radius-24 danger card with the 36 px icon tile, title and server text; announced', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const tree = render(<ErrorAlert testID="ea" title="Some exercises didn't load" description="Please try again." />);
    const box = host(tree, 'ea');
    expect(box.props).toMatchObject({ accessibilityRole: 'alert', accessibilityLiveRegion: 'assertive' });
    // D's kit folds (State boards): fill glassStrong, edge dangerLine.
    expect(flat(box)).toMatchObject({ borderRadius: 24, padding: 18, backgroundColor: colors.glassStrong, borderColor: colors.dangerLine });
    const [title, description] = tree.root.findAllByType(Text);
    expect(flat(title)).toMatchObject({ fontSize: 15, fontFamily: 'Geist-SemiBold', color: colors.textPrimary });
    expect(flat(description)).toMatchObject({ fontSize: 14, lineHeight: 20, color: colors.textSecondary });
    const tile = tree.root.findByType(FeedbackIcon).parent;
    expect(flat(tile)).toMatchObject({ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.dangerTint });
    expect(announce).toHaveBeenCalledWith("Some exercises didn't load. Please try again.");
  });

  it('shows the ruling-2 Retry that calls onRetry', () => {
    const onRetry = jest.fn();
    const tree = render(<ErrorAlert title="t" description="d" onRetry={onRetry} retryTestID="r" />);
    const retry = tree.root.findByType(RetryButton);
    expect(retry.props).toMatchObject({ title: 'Retry', testID: 'r', loading: false });
    expect(tree.root.findAllByType(PillButton)).toHaveLength(0);
    act(() => retry.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('no Retry without onRetry (save failures, 403)', () => {
    expect(render(<ErrorAlert title="Could not save" />).root.findAllByType(RetryButton)).toHaveLength(0);
  });

  it('`retrying` puts the Retry in its loading state (label unchanged)', () => {
    const tree = render(<ErrorAlert title="t" onRetry={jest.fn()} retryTestID="r" retrying />);
    const button = host(tree, 'r');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(texts(tree)).toContain('Retry');
  });

  it('compact variant (Exercises board): surface fill, danger-text edge, 40 tile, centred row, 15/600 + 13/18', () => {
    const tree = render(<ErrorAlert testID="ea" variant="compact" title="Some exercises didn't load" description="Please try again." onRetry={jest.fn()} />);
    expect(flat(host(tree, 'ea'))).toMatchObject({ padding: 16, borderRadius: 24, alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.dangerTextBorder });
    expect(flat(host(tree, 'error-alert-icon'))).toMatchObject({ width: 40, height: 40, borderRadius: radii.sm });
    const [title, description] = tree.root.findAllByType(Text);
    expect(flat(title)).toMatchObject({ fontSize: 15, lineHeight: 20, fontFamily: 'Geist-SemiBold' });
    expect(flat(description)).toMatchObject({ fontSize: 13, lineHeight: 18, color: colors.textSecondary });
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(0);
  });

  it('generator variant: the danger-tint gradient from the first render, 48 tile, overflow hidden', () => {
    const tree = render(<ErrorAlert testID="ea" variant="generator" title="Could not load the plan generator" description="Down" />);
    expect(flat(host(tree, 'ea'))).toMatchObject({ padding: 18, alignItems: 'center', overflow: 'hidden', backgroundColor: colors.surface });
    expect(tree.root.findByType(GradientFill).props).toMatchObject({ angle: 160, colors: [colors.dangerTint, colors.dangerFaint] });
    expect(flat(host(tree, 'ea')).borderColor).toBe(colors.dangerLine);
    expect(flat(host(tree, 'error-alert-icon')).backgroundColor).toBe(colors.dangerTint);
    expect(flat(host(tree, 'error-alert-icon'))).toMatchObject({ width: 48, height: 48, borderRadius: radii.md });
  });

  it('an unknown variant falls back to the kit card', () => {
    const tree = render(<ErrorAlert testID="ea" variant="nope" title="t" />);
    expect(flat(host(tree, 'ea'))).toMatchObject({ backgroundColor: colors.glassStrong, padding: 18 });
  });
});

describe('RetryButton (§D1 ruling 2: one Retry everywhere)', () => {
  // The Pressable itself (its style is a function of `pressed`).
  const pressable = (tree) => tree.root.find((node) => node.props.testID === 'rb' && typeof node.props.style === 'function');
  const styleOf = (tree, pressed = false) => StyleSheet.flatten(pressable(tree).props.style({ pressed }));

  it('glass secondary, 40 visual with a 44 hit area, 14/600 primary text', () => {
    const tree = render(<RetryButton testID="rb" onPress={jest.fn()} />);
    expect(RETRY_HEIGHT).toBe(40);
    const look = styleOf(tree);
    expect(look).toMatchObject({ minHeight: 40, borderRadius: radii.full, borderWidth: 1, borderColor: colors.hairlineButton, backgroundColor: colors.fillButton, paddingHorizontal: 16 });
    expect(look.minHeight + RETRY_SLOP * 2).toBe(44);
    expect(pressable(tree).props.hitSlop).toMatchObject({ top: 2, bottom: 2 });
    expect(flat(tree.root.findByType(Text))).toMatchObject({ fontSize: 14, lineHeight: 20, fontFamily: 'Geist-SemiBold', color: colors.textPrimary });
    expect(flat(tree.root.findByType(Text)).fontWeight).toBeUndefined();
    expect(texts(tree)).toEqual(['Retry']);
  });

  it('default: an enabled button labelled by its title; press calls onPress', () => {
    const onPress = jest.fn();
    const tree = render(<RetryButton testID="rb" title="Try again" onPress={onPress} />);
    expect(pressable(tree).props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Try again', accessibilityState: { disabled: false, busy: false } });
    act(() => pressable(tree).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('pressed: the next glass step', () => {
    const tree = render(<RetryButton testID="rb" onPress={jest.fn()} />);
    expect(styleOf(tree, true).backgroundColor).toBe(colors.hairlineButton);
  });

  it('loading: label unchanged, no spinner, disabled at 0.5, busy', () => {
    const tree = render(<RetryButton testID="rb" onPress={jest.fn()} loading />);
    expect(texts(tree)).toEqual(['Retry']);
    expect(tree.root.findAllByType(Spinner)).toHaveLength(0);
    expect(pressable(tree).props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, busy: true } });
    expect(styleOf(tree).opacity).toBe(0.5);
    expect(styleOf(tree, true).backgroundColor).toBe(colors.fillButton);
  });

  it('disabled: 0.5, not busy', () => {
    const tree = render(<RetryButton testID="rb" onPress={jest.fn()} disabled />);
    expect(pressable(tree).props.accessibilityState).toEqual({ disabled: true, busy: false });
    expect(styleOf(tree).opacity).toBe(0.5);
  });
});

describe('RouteErrorBoundary screen', () => {
  it('fallback: ground, the danger icon tile, the v1 copy and "Reload app"', () => {
    const onReload = jest.fn();
    const tree = render(<RouteErrorFallback onReload={onReload} />);
    expect(flat(host(tree, 'route-error')).backgroundColor).toBe(colors.ground);
    expect(texts(tree)).toEqual(['Something went wrong', 'We hit a problem rendering this page. Reload the app to try again.', 'Reload app']);
    expect(tree.root.findAll((node) => node.props.testID === 'route-error-icon')).not.toHaveLength(0);
    act(() => tree.root.find((node) => node.props.testID === 'route-error-reload' && node.type === PillButton).props.onPress());
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('renders children until a render crash, then the fallback', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    function Boom() {
      throw new Error('boom');
    }
    expect(texts(render(<RouteErrorBoundary><Text>ok</Text></RouteErrorBoundary>))).toEqual(['ok']);
    const crashed = render(
      <RouteErrorBoundary reload={jest.fn()}>
        <Boom />
      </RouteErrorBoundary>
    );
    expect(crashed.root.findAll((node) => node.props.testID === 'route-error')).not.toHaveLength(0);
  });
});

describe('Banners (§5)', () => {
  it('OnHoldBox: warning fill 0.08 + border 0.28, radius 16, title 15/600, body 13 secondary, copy unchanged', () => {
    const tree = render(<OnHoldBox message="Your trainer paused coaching." />);
    const box = host(tree, 'my-plans-on-hold');
    expect(box.props).toMatchObject({ accessibilityRole: 'summary', accessibilityLiveRegion: 'polite' });
    expect(flat(box)).toMatchObject({ borderRadius: 16, backgroundColor: colors.warningFill, borderColor: colors.warningBorder });
    const all = texts(tree);
    expect(all[0]).toBe('Your plans are on hold');
    expect(all[1]).toBe('Your trainer paused coaching.');
    expect(all).toHaveLength(3);
    const [title, body] = tree.root.findAllByType(Text);
    expect(flat(title)).toMatchObject({ fontSize: 15, fontFamily: 'Geist-SemiBold', color: colors.textPrimary });
    expect(flat(body)).toMatchObject({ fontSize: 13, color: colors.textSecondary });
    expect(tree.root.findAllByType(FeedbackIcon)).toHaveLength(0);
  });

  it('OnHoldBox without a server message keeps only the title and the tail', () => {
    expect(texts(render(<OnHoldBox />))).toHaveLength(2);
  });

  it('inactive-plan banner: title in warning with its icon', () => {
    const tree = render(<InactiveBanner body="Members can't start it." />);
    expect(texts(tree)).toEqual(['This plan is inactive', "Members can't start it."]);
    expect(flat(tree.root.findAllByType(Text)[0]).color).toBe(colors.warning);
    expect(tree.root.findByType(FeedbackIcon).props).toMatchObject({ name: 'warning', color: colors.warning });
    expect(flat(host(tree, 'plan-inactive-banner')).backgroundColor).toBe(colors.warningFill);
  });

  it('AffectedClients: a plain card', () => {
    const tree = render(<ClientsBanner count={3} />);
    expect(flat(host(tree, 'plan-clients-banner'))).toMatchObject({ backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radii.xl, padding: 18 });
    expect(render(<ClientsBanner count={0} />).toJSON()).toBeNull();
  });

  it('Banner takes any role and body', () => {
    const tree = render(
      <Banner testID="b" title="T" accessibilityRole="alert">
        <BannerText>Body</BannerText>
      </Banner>
    );
    expect(host(tree, 'b').props.accessibilityRole).toBe('alert');
    expect(texts(tree)).toEqual(['T', 'Body']);
  });
});

describe('Toast (§5)', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }));

  it('placement: phones bottom-centre above the floating tab bar (66 + 20) plus the safe area', () => {
    expect(TAB_BAR_CLEARANCE).toBe(86);
    expect(toastPlacement({ width: 390, insets: { bottom: 34, left: 0, right: 0 } })).toEqual({ tablet: false, bottom: 86 + TOAST_GAP + 34, left: 16, right: 16 });
  });

  it('placement: tablets bottom-right with insets', () => {
    expect(toastPlacement({ width: 834, insets: { bottom: 20, left: 0, right: 10 } })).toEqual({ tablet: true, bottom: 44, left: 24, right: 34 });
  });

  it('renders nothing with no toasts', () => {
    expect(render(<ToastHost />).toJSON()).toBeNull();
  });

  it('phone: the stack is centred and clears the tab bar', () => {
    atWidth(390);
    mockInsets = { top: 0, bottom: 34, left: 0, right: 0 };
    useToastStore.setState({ toasts: [{ id: 1, tone: 'success', title: 'Weight log saved', message: '' }] });
    const stack = flat(host(render(<ToastHost />), 'toast-stack'));
    expect(stack).toMatchObject({ position: 'absolute', alignItems: 'center', paddingBottom: 86 + 12 + 34 });
    expect(stack.paddingBottom).toBeGreaterThan(TAB_BAR_CLEARANCE + 34);
  });

  it('tablet: bottom-right', () => {
    atWidth(1024);
    useToastStore.setState({ toasts: [{ id: 1, tone: 'info', title: 'A', message: '' }] });
    expect(flat(host(render(<ToastHost />), 'toast-stack'))).toMatchObject({ alignItems: 'flex-end', paddingBottom: 24, paddingRight: 24 });
  });

  it('is denser glass (tone toast) that blurs the app behind it', () => {
    useToastStore.setState({ toasts: [{ id: 1, tone: 'info', title: 'A', message: '' }] });
    const glass = render(<ToastHost />).root.findByType(GlassSurface);
    expect(glass.props).toMatchObject({ tone: 'toast', overApp: true });
  });

  it.each([
    ['success', 'check', colors.success],
    ['error', 'error', colors.dangerText],
    ['info', 'info', colors.info],
    ['warning', 'warning', colors.warning],
  ])('%s: the icon carries the tone', (tone, icon, color) => {
    const tree = render(<ToastCard tone={tone} title="T" message="" />);
    expect(tree.root.find((node) => node.props.testID === 'toast-icon' && node.type === FeedbackIcon).props).toMatchObject({ name: icon, color });
    expect(TOAST_TONES[tone]).toEqual({ icon, color });
  });

  it('unknown tone falls back to info', () => {
    const tree = render(<ToastCard tone="nope" title="T" />);
    expect(tree.root.find((node) => node.props.testID === 'toast-icon' && node.type === FeedbackIcon).props.name).toBe('info');
  });

  it('one line: a 52 px pill, 15/500 (at 1× text)', () => {
    atWidth(390);
    const tree = render(<ToastCard tone="success" title="Weight log saved" message="" />);
    const glass = tree.root.findByType(GlassSurface);
    expect(glass.props.radius).toBe(radii.full);
    expect(StyleSheet.flatten(glass.props.style)).toMatchObject({ minHeight: 52, paddingHorizontal: 18 });
    expect(texts(tree)).toEqual(['Weight log saved']);
    expect(flat(tree.root.findByType(Text))).toMatchObject({ fontSize: 15, fontFamily: 'Geist-Medium', color: colors.textPrimary });
  });

  it('message only is also one line', () => {
    expect(texts(render(<ToastCard tone="error" title="" message="Failed" />))).toEqual(['Failed']);
  });

  it('title + message: radius 20, title 14/600 over the message 13 muted', () => {
    const tree = render(<ToastCard tone="success" title="Plan copied" message="You’re now on your copy." />);
    const glass = tree.root.findByType(GlassSurface);
    expect(glass.props.radius).toBe(20);
    expect(StyleSheet.flatten(glass.props.style)).toMatchObject({ paddingVertical: 12, paddingHorizontal: 16 });
    const [title, message] = tree.root.findAllByType(Text);
    expect(flat(title)).toMatchObject({ fontSize: 14, fontFamily: 'Geist-SemiBold' });
    expect(flat(message)).toMatchObject({ fontSize: 13, color: colors.textMuted });
  });

  it('host toasts keep the close button (44 hit area) and close on press', () => {
    useToastStore.setState({ toasts: [{ id: 7, tone: 'error', title: 'Workout error', message: 'Server down' }] });
    const tree = render(<ToastHost />);
    const [close] = tree.root.findAll((node) => node.props.accessibilityLabel === 'Close notification' && typeof node.props.style === 'function');
    const size = flat({ props: { style: close.props.style({ pressed: false }) } });
    expect(size.width + close.props.hitSlop * 2).toBeGreaterThanOrEqual(44);
    expect(StyleSheet.flatten(close.props.style({ pressed: true })).backgroundColor).toBe(colors.fillButton);
    act(() => close.props.onPress());
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('a polite alert region; announced on iOS only', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const realOS = Platform.OS;
    try {
      Platform.OS = 'ios';
      const tree = render(<InlineToast testID="it" tone="error" title="Workout error" message="Nope" />);
      expect(host(tree, 'it').props).toMatchObject({ accessibilityRole: 'alert', accessibilityLiveRegion: 'polite' });
      expect(announce).toHaveBeenCalledWith('Workout error Nope');
      announce.mockClear();
      Platform.OS = 'android';
      render(<InlineToast tone="error" title="Workout error" message="Nope" />);
      expect(announce).not.toHaveBeenCalled();
    } finally {
      Platform.OS = realOS;
    }
  });

  it('InlineToast: the same glass card in place, no close button, not blurring the app root', () => {
    const tree = render(<InlineToast testID="it" tone="success" title="Saved" message="" />);
    expect(tree.root.findByType(GlassSurface).props.overApp).toBe(false);
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === 'Close notification')).toHaveLength(0);
    expect(tree.root.findByType(InlineToast).props.testID).toBe('it');
  });

  it('slides up, or appears at once under reduced motion', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render(<InlineToast tone="info" title="A" />);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: motion.slideUpMs }));
    timing.mockClear();
    mockReducedMotion = true;
    render(<InlineToast tone="info" title="A" />);
    expect(timing).not.toHaveBeenCalled();
  });
});

describe('RouteErrorFallback live region (review, 26 Oct)', () => {
  const { RouteErrorFallback } = require('./RouteErrorBoundary');

  it('has exactly one polite live region (the card), none nested', () => {
    const tree = render(<RouteErrorFallback onReload={jest.fn()} />);
    expect(tree.root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityLiveRegion === 'polite')).toHaveLength(1);
  });
});
