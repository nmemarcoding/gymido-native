import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, typography } from '../../../shared/theme/tokens';

import { RestTimerWidget } from './RuntimeOverlays';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => {
  const { View } = require('react-native');
  return (props) => <View testID="remote-image" {...props} />;
});
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockWidth > 700 ? 1194 : 844, scale: 2, fontScale: mockFontScale }),
}));
let mockReducedMotion = false;
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockWidth = 390;
  mockFontScale = 1;
});
const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const all = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');

function renderTree(props) {
  let tree;
  act(() => {
    tree = create(
      <RestTimerWidget
        timer={{ setId: 1, secondsLeft: 60, totalSeconds: 90, nextSetKey: '1:2' }}
        onMinimize={() => {}}
        onExpand={() => {}}
        onAdjust={() => {}}
        onSkip={() => {}}
        position={null}
        onPosition={() => {}}
        {...props}
      />
    );
  });
  mounted.push(tree);
  return tree;
}

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
  mounted.push(tree);
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

  // DECLARED A1 (T-146 rev 23 + FE Q4): the full Rest never pulses (colour only); the disc keeps the pulse.
  it('the minimised disc pulses (1 → 1.06) only in its last 10 seconds; the full Rest never pulses', () => {
    render({ minimized: true, timer: { setId: 1, secondsLeft: 30, totalSeconds: 90 } });
    expect(loop).not.toHaveBeenCalled();
    render({ minimized: false, timer: { setId: 1, secondsLeft: 4, totalSeconds: 90 } });
    expect(loop).not.toHaveBeenCalled();
    render({ minimized: true, timer: { setId: 1, secondsLeft: 8, totalSeconds: 90 } });
    expect(loop).toHaveBeenCalled();
  });

  it('never pulses under reduced motion', () => {
    mockReducedMotion = true;
    render({ minimized: true, timer: { setId: 1, secondsLeft: 8, totalSeconds: 90 } });
    expect(loop).not.toHaveBeenCalled();
  });

  // DECLARED A3 (T-146 boards 1–3): −5 / +5 are 52 circles, Skip rest a 52 pill.
  it('gives every control a ≥ 44 target (T-146: 52 circles, a 52 pill, the 44 chevron)', () => {
    const tree = renderTree({ minimized: false });
    const flat = (id) => StyleSheet.flatten(host(tree, id).props.style);
    expect(flat('rest-timer-minus').minHeight).toBe(52);
    expect(flat('rest-timer-plus').minHeight).toBe(52);
    expect(flat('rest-timer-minus').width).toBe(52);
    expect(flat('rest-timer-plus').width).toBe(52);
    expect(flat('rest-timer-skip').minHeight).toBe(52);
    expect(flat('rest-timer-minimize').width).toBe(44);
    expect(flat('rest-timer-minimize').height).toBe(44);
  });
});

const HERO_MID = { mode: 'mid', name: 'Barbell Bench Press', exercise: { thumbnail: { url: 'https://example.com/b.jpg', media_type: 'image' } }, left: 2 };
const HERO_NEXT = { mode: 'next', name: 'Seated Leg Curl', exercise: { thumbnail: { url: 'https://example.com/c.jpg', media_type: 'image' } }, left: 0 };
const NEXT = { exerciseName: 'Barbell Bench Press', exercise: { name: 'Barbell Bench Press', thumbnail: { url: 'https://example.com/b.jpg' } }, line: 'Set 3 · 8–10 reps · 135 lb' };
const text = (node) => {
  const children = [].concat(node.props.children);
  return children.map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? text(child) : '')).join('');
};
const texts = (tree) => tree.root.findAll((node) => node.type === 'Text').map(text);

describe('Rest, phone (UX F2 Rest board)', () => {
  // DECLARED A4 (T-146 §1.0 rev 19/29): no "Resting" title and no "of m:ss"; the timer says it.
  it('is the full-screen dialog "Rest timer": the eyebrow, the name and the digits, labelled "Resting, … left"', () => {
    const tree = renderTree({ minimized: false, hero: HERO_MID });
    const root = host(tree, 'rest-timer');
    expect(root.props.role).toBe('dialog');
    expect(root.props.accessibilityLabel).toBe('Rest timer');
    expect(root.props.accessibilityViewIsModal).toBe(true);
    const style = StyleSheet.flatten(root.props.style);
    expect(style).toEqual(expect.objectContaining({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.ground }));
    expect(texts(tree)).toEqual(expect.arrayContaining(['2 sets left', 'Barbell Bench Press', '1:00']));
    expect(texts(tree)).not.toContain('Resting');
    expect(texts(tree)).not.toContain('of 1:30');
    expect(StyleSheet.flatten(host(tree, 'rest-eyebrow').props.style)).toEqual(expect.objectContaining({ textTransform: 'uppercase', fontSize: 14, color: colors.textMuted }));
    const digits = host(tree, 'rest-countdown');
    expect(digits.props.accessibilityRole).toBe('timer');
    expect(digits.props.accessibilityLabel).toBe('Resting, 1 minute left');
    expect(StyleSheet.flatten(digits.props.style)).toEqual(expect.objectContaining({ fontSize: 92, lineHeight: 92, fontFamily: typography.displayTimer.fontFamily, color: colors.textPrimary }));
    expect(StyleSheet.flatten(digits.props.style).fontVariant).toEqual(['tabular-nums']);
  });

  // DELETED A5 + A6 (owner delegated OK 30 Oct): the phone Rest has no ring and no Next card (the tablet keeps both).

  // DECLARED A7 (T-146 rest 3, rev 36): after an exercise's last set, the next exercise + a gold Start now.
  it('rest 3: "Go to the next exercise", the next exercise\'s name, no eyebrow, a gold "Start now" (Skip\'s action)', () => {
    const onSkip = jest.fn();
    const tree = renderTree({ minimized: false, hero: HERO_NEXT, onSkip });
    expect(texts(tree)).toEqual(expect.arrayContaining(['Go to the next exercise', 'Seated Leg Curl']));
    expect(all(tree, 'rest-eyebrow')).toHaveLength(0);
    const skip = host(tree, 'rest-timer-skip');
    expect(skip.props.accessibilityLabel).toBe('Start now');
    expect(StyleSheet.flatten(skip.props.style).backgroundColor).toBe(colors.gold);
    act(() => tree.root.findAll((n) => n.props.testID === 'rest-timer-skip' && n.props.onPress)[0].props.onPress());
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('wires minimise, −5 / +5 and Skip rest (labels kept)', () => {
    const onMinimize = jest.fn();
    const onAdjust = jest.fn();
    const onSkip = jest.fn();
    const tree = renderTree({ minimized: false, onMinimize, onAdjust, onSkip });
    const press = (id) => act(() => tree.root.findAll((n) => n.props.testID === id && n.props.onPress)[0].props.onPress());
    press('rest-timer-minimize');
    press('rest-timer-minus');
    press('rest-timer-plus');
    press('rest-timer-skip');
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onAdjust.mock.calls).toEqual([[-5], [5]]);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(host(tree, 'rest-timer-minimize').props.accessibilityLabel).toBe('Minimize rest timer');
    expect(host(tree, 'rest-timer-minus').props.accessibilityLabel).toBe('Decrease rest timer by 5 seconds');
    expect(host(tree, 'rest-timer-plus').props.accessibilityLabel).toBe('Increase rest timer by 5 seconds');
    expect(host(tree, 'rest-timer-skip').props.accessibilityLabel).toBe('Skip rest');
  });

  // DECLARED A9 (T-146 rev 23): red in the last 5 s (rest ≥ 10 s): digits, fill and its edge.
  it('last 5 s of a rest ≥ 10 s: digits + edge #FF7A70, fill red .12; 6 s and a short rest stay calm', () => {
    const style = (tree, id) => StyleSheet.flatten(host(tree, id).props.style);
    const calm = renderTree({ minimized: false, timer: { setId: 1, secondsLeft: 6, totalSeconds: 90 } });
    expect(style(calm, 'rest-countdown').color).toBe(colors.textPrimary);
    expect(style(calm, 'rest-drain-edge').backgroundColor).toBe(colors.gold);
    expect(style(calm, 'rest-drain-fill').backgroundColor).toBe('rgba(255, 194, 26, 0.08)');
    const red = renderTree({ minimized: false, timer: { setId: 1, secondsLeft: 5, totalSeconds: 90 } });
    expect(style(red, 'rest-countdown').color).toBe(colors.dangerText);
    expect(style(red, 'rest-drain-edge').backgroundColor).toBe(colors.dangerText);
    expect(style(red, 'rest-drain-fill').backgroundColor).toBe('rgba(255, 122, 112, 0.12)');
    const short = renderTree({ minimized: false, timer: { setId: 1, secondsLeft: 5, totalSeconds: 8 } });
    expect(style(short, 'rest-countdown').color).toBe(colors.textPrimary);
  });

  it('under reduced motion the colour still changes in the last 10 s', () => {
    mockReducedMotion = true;
    const tree = renderTree({ minimized: false, timer: { setId: 1, secondsLeft: 5, totalSeconds: 90 } });
    expect(StyleSheet.flatten(host(tree, 'rest-countdown').props.style).color).toBe(colors.dangerText);
    mockReducedMotion = false;
  });

  // DECLARED A11 (T-146 §1.0): the drain fill, not a ring; it never passes its zone.
  it('a total that grew with +5 s keeps the drain fill within its zone (scaleY ≤ 1), anchored at the bottom', () => {
    const tree = renderTree({ minimized: false, timer: { setId: 1, secondsLeft: 95, totalSeconds: 95 } });
    const fill = StyleSheet.flatten(host(tree, 'rest-drain-fill').props.style);
    const scaleY = fill.transform.find((step) => 'scaleY' in step).scaleY;
    expect(typeof scaleY === 'number' ? scaleY : scaleY.__getValue()).toBeLessThanOrEqual(1);
    expect(fill.transformOrigin).toBe('bottom');
  });

  it('renders nothing without a rest', () => {
    const tree = renderTree({ timer: null, minimized: false });
    expect(tree.toJSON()).toBeNull();
  });
});

describe('Rest, tablet (UX F2 Tablet: Rest)', () => {
  it('is a centred 600 card "Rest timer" over scrim-strong, ring 320, digits 100, the tablet Next card', () => {
    mockWidth = 834;
    const tree = renderTree({ minimized: false, next: NEXT });
    const card = host(tree, 'rest-card');
    expect(card.props.role).toBe('dialog');
    expect(card.props.accessibilityLabel).toBe('Rest timer');
    expect(StyleSheet.flatten(card.props.style).width).toBe(600);
    expect(StyleSheet.flatten(host(tree, 'rest-ring-box').props.style).width).toBe(320);
    expect(StyleSheet.flatten(host(tree, 'rest-countdown').props.style).fontSize).toBe(100);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Next', 'Set 3 · 8–10 reps · 135 lb', 'Barbell Bench Press']));
    expect(StyleSheet.flatten(host(tree, 'rest-timer-minus').props.style).minHeight).toBe(56);
    expect(StyleSheet.flatten(host(tree, 'rest-timer-skip').props.style).minHeight).toBe(62);
  });

  // T-146 (FE Q2): the tablet keeps its layout and takes only the behaviour rules.
  it('T-146: red digits in the last 5 s (rest ≥ 10 s), not at 6 s; rest 3 makes Skip the gold "Start now"', () => {
    mockWidth = 834;
    const calm = renderTree({ minimized: false, next: NEXT, timer: { setId: 1, secondsLeft: 6, totalSeconds: 90 } });
    expect(StyleSheet.flatten(host(calm, 'rest-countdown').props.style).color).toBe(colors.textPrimary);
    expect(host(calm, 'rest-timer-skip').props.accessibilityLabel).toBe('Skip rest');
    const red = renderTree({ minimized: false, next: NEXT, hero: HERO_NEXT, timer: { setId: 1, secondsLeft: 5, totalSeconds: 90 } });
    expect(StyleSheet.flatten(host(red, 'rest-countdown').props.style).color).toBe(colors.dangerText);
    expect(host(red, 'rest-timer-skip').props.accessibilityLabel).toBe('Start now');
    expect(StyleSheet.flatten(host(red, 'rest-timer-skip').props.style).backgroundColor).toBe(colors.gold);
  });
});

describe('Rest minimised (UX F2 Rest minimised)', () => {
  // DECLARED change (UX ruling A121, option B, 27 Oct 2026): was "phone: a 92 dark disc at right 20 / top 112"
  // with top: 112 (it sat over the stage's "How to" pill). The phone disc now docks ABOVE the session's bottom bar
  // (the tablet I2 rule): right 20, top = window height − the dock room − 92.
  // T-132 (PM OK 29 Oct; web 2.1.15 RT:94-100): the phone disc sits right 24, as on the tablet. Was: right 20
  // (left 390 − 20 − 92).
  it('phone: a 92 dark disc at right 24, docked above the dock room, with the r40 ring and 24 digits', () => {
    const dockRoom = 202;
    const tree = renderTree({ minimized: true, dockRoom });
    const disc = host(tree, 'rest-timer');
    const style = StyleSheet.flatten(disc.props.style);
    expect(style).toEqual(expect.objectContaining({ width: 92, height: 92, borderRadius: 46, left: 390 - 24 - 92, top: 844 - dockRoom - 92, borderColor: colors.hairlineBright }));
    const arc = tree.root.findAll((node) => node.props.testID === 'rest-mini-ring-arc')[0];
    expect(arc.props.r).toBe(40);
    expect(arc.props.strokeWidth).toBe(6);
    expect(StyleSheet.flatten(host(tree, 'rest-countdown').props.style).fontSize).toBe(24);
  });

  // DECLARED change (UX verdict I2, iPad 15e819a; P8 verdict "KEEP 92 at 24 (T §5); the 132 board disc is
  // superseded"): was "tablet: a 132 disc at right 40 / bottom 60, r58 stroke 7, 32 digits" with
  // toEqual(objectContaining({ width: 132, height: 132, left: 834 - 40 - 132, top: 1194 - 60 - 132 })), r 58,
  // stroke 7, digits 32. The 132 disc at bottom 60 sat on top of "Complete workout" and the disabled Did it.
  it('tablet (I2): the 92 disc (r40 ring, 24 digits) docks 24 from the right, ABOVE the dock room', () => {
    mockWidth = 834;
    const dockRoom = 136 + 16;
    const tree = renderTree({ minimized: true, dockRoom });
    const style = StyleSheet.flatten(host(tree, 'rest-timer').props.style);
    expect(style).toEqual(expect.objectContaining({ width: 92, height: 92, borderRadius: 46, left: 834 - 24 - 92, top: 1194 - dockRoom - 92 }));
    const arc = tree.root.findAll((node) => node.props.testID === 'rest-mini-ring-arc')[0];
    expect(arc.props.r).toBe(40);
    expect(arc.props.strokeWidth).toBe(6);
    expect(StyleSheet.flatten(host(tree, 'rest-countdown').props.style).fontSize).toBe(24);
  });

  it('tablet (I2): a drag never takes the disc down onto the dock (clamped above the dock room)', () => {
    mockWidth = 834;
    const dockRoom = 152;
    const onPosition = jest.fn();
    const tree = renderTree({ minimized: true, dockRoom, onPosition });
    const disc = () => host(tree, 'rest-timer');
    const touch = (pageX, pageY) => ({ nativeEvent: { pageX, pageY, touches: [], changedTouches: [] }, touchHistory: { touchBank: [] } });
    act(() => disc().props.onResponderGrant(touch(700, 900)));
    act(() => disc().props.onResponderMove(touch(700, 1190)));
    expect(onPosition).toHaveBeenCalled();
    expect(onPosition.mock.calls.at(-1)[0].y).toBe(1194 - dockRoom - 92);
    // A stored position below the dock is pulled back up (the re-clamp on each tick).
    const below = renderTree({ minimized: true, dockRoom, onPosition, position: { x: 600, y: 1100 } });
    expect(StyleSheet.flatten(host(below, 'rest-timer').props.style).top).toBe(1194 - dockRoom - 92);
  });

  // DECLARED change (UX ruling A121, option B): was "phone keeps its disc and clamp (the dock room is tablet
  // only)" with a stored y 700 kept at 700 under a 200 dock room. The phone now clamps above the dock room too.
  it('phone: a stored or dragged position never sits on the dock (clamped above the dock room)', () => {
    const onPosition = jest.fn();
    const tree = renderTree({ minimized: true, dockRoom: 200, position: { x: 100, y: 700 }, onPosition });
    expect(StyleSheet.flatten(host(tree, 'rest-timer').props.style).top).toBe(844 - 200 - 92);
    const above = renderTree({ minimized: true, dockRoom: 200, position: { x: 100, y: 400 }, onPosition });
    expect(StyleSheet.flatten(host(above, 'rest-timer').props.style).top).toBe(400);
  });

  // UX ruling A121 (option B, 27 Oct 2026): docked above the bottom room, the phone disc clears the top of the
  // screen: the session header bar (Exit, about 60 with a 2-line plan name) and the live photo's top row (the ring
  // and "How to"), on a small (667) and a regular (844) phone.
  // T-132 D1 (PM OK 29 Oct; web 2.1.15 phone): no phone dock, so the room is 24 + inset, and the header bar now sits
  // ABOVE the photo, whose top row holds the ring and How to. Was: dockRoom 32 + 64 + 44 + 28 + inset,
  // PHONE_STAGE_HEIGHT === 330 (pills inside the stage) and the disc top > 330 and > 60 + 44.
  it.each([
    [667, 0],
    [844, 34],
  ])('phone %s (inset %s): the docked disc clears the header bar and the photo\'s ring / How to row', (height, inset) => {
    const { PHONE_STAGE_HEIGHT, LIVE_PHOTO_INSET, LIVE_RING_SIZE } = require('./RuntimeParts');
    const dockRoom = 24 + inset;
    const top = height - dockRoom - 92;
    const headerBar = 60 + 44;
    expect(top).toBeGreaterThan(headerBar + LIVE_PHOTO_INSET + LIVE_RING_SIZE);
    expect(top).toBeGreaterThan(headerBar + PHONE_STAGE_HEIGHT);
    const tree = renderTree({ minimized: true, dockRoom });
    expect(StyleSheet.flatten(host(tree, 'rest-timer').props.style).top).toBe(844 - dockRoom - 92);
  });

  it('pressed scales to 0.96; a tap expands, a drag past 4 pt moves it (clamped 8 from the edge)', () => {
    const onExpand = jest.fn();
    const onPosition = jest.fn();
    const tree = renderTree({ minimized: true, onExpand, onPosition });
    const disc = () => host(tree, 'rest-timer');
    act(() => disc().props.onResponderGrant({ nativeEvent: { pageX: 300, pageY: 150, touches: [], changedTouches: [] }, touchHistory: { touchBank: [] } }));
    expect(StyleSheet.flatten(disc().props.style).transform).toEqual([{ scale: 0.96 }]);
    act(() => disc().props.onResponderRelease({ nativeEvent: { pageX: 300, pageY: 150, touches: [], changedTouches: [] }, touchHistory: { touchBank: [] } }));
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(disc().props.style).transform).toBeUndefined();
  });

  it('the digits go danger in the last 10 s on the disc too', () => {
    const tree = renderTree({ minimized: true, timer: { setId: 1, secondsLeft: 9, totalSeconds: 90 } });
    expect(StyleSheet.flatten(host(tree, 'rest-countdown').props.style).color).toBe(colors.dangerText);
  });
});

describe('Rest large text (UX §9)', () => {
  for (const scale of [1, 2, 3.1]) {
    it(`fontScale ${scale}: digits capped at 1.2, labels at 2.0, nothing truncated, minHeight not height`, () => {
      mockFontScale = scale;
      // DECLARED A15 (T-146): the eyebrow and name carry the 2.0 cap ("of m:ss" is gone); the name wraps to 2 lines.
      const tree = renderTree({ minimized: false, hero: HERO_MID });
      expect(host(tree, 'rest-countdown').props.maxFontSizeMultiplier).toBe(1.2);
      expect(host(tree, 'rest-countdown').props.adjustsFontSizeToFit).toBe(true);
      expect(host(tree, 'rest-eyebrow').props.maxFontSizeMultiplier).toBe(2);
      expect(host(tree, 'rest-name').props.maxFontSizeMultiplier).toBe(2);
      expect(host(tree, 'rest-name').props.numberOfLines).toBe(2);
      for (const id of ['rest-timer-minus', 'rest-timer-plus', 'rest-timer-skip']) {
        const style = StyleSheet.flatten(host(tree, id).props.style);
        expect(style.height).toBeUndefined();
      }
      // Button labels never carry a line cap.
      const labels = tree.root.findAll((n) => n.type === 'Text' && ['Skip rest', '−5', '+5'].includes(text(n)));
      expect(labels).toHaveLength(3);
      labels.forEach((label) => expect(label.props.numberOfLines).toBeUndefined());
      // T-146 (Q5): nothing scrolls; the photo and then the digits give up the room.
      expect(tree.root.findAll((n) => n.type === 'RCTScrollView')).toHaveLength(0);
    });
  }
});

// Review M6 + owner override O14 (RN-SPEC-time §7.2, gymido d04f7254): Android Back on the EXPANDED Rest minimises
// it to the disc and consumes the press; the rest keeps running (no clear, skip, adjust or alert change). Minimised
// (or no rest): not handled, so the leave-workout guard runs as before.
describe('Android Back on the Rest (O14)', () => {
  const { BackHandler } = require('react-native');
  const { consumeRestBack } = require('./restBackGate');
  let listeners;
  beforeEach(() => {
    listeners = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      const entry = { handler, removed: false };
      listeners.push(entry);
      return { remove: () => (entry.removed = true) };
    });
  });
  afterEach(() => jest.restoreAllMocks());
  const live = () => listeners.filter((entry) => !entry.removed);

  it.each([390, 834])('expanded (%s): Back → minimised, handled (true); the timer is untouched', (width) => {
    mockWidth = width;
    const onMinimize = jest.fn();
    const onSkip = jest.fn();
    const onAdjust = jest.fn();
    const onExpand = jest.fn();
    renderTree({ onMinimize, onSkip, onAdjust, onExpand, minimized: false });
    expect(live()).toHaveLength(1);
    let handled;
    act(() => {
      handled = live()[0].handler();
    });
    expect(handled).toBe(true);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
    expect(onAdjust).not.toHaveBeenCalled();
    expect(onExpand).not.toHaveBeenCalled();
  });

  it('minimised or no rest: no Back listener and the gate does not consume', () => {
    const onMinimize = jest.fn();
    const tree = renderTree({ onMinimize, minimized: true });
    expect(live()).toHaveLength(0);
    expect(consumeRestBack()).toBe(false);
    act(() => tree.update(<RestTimerWidget timer={null} onMinimize={onMinimize} onExpand={() => {}} onAdjust={() => {}} onSkip={() => {}} position={null} onPosition={() => {}} />));
    expect(live()).toHaveLength(0);
    expect(onMinimize).not.toHaveBeenCalled();
  });

  it('minimising (or the rest ending) removes the listener and closes the gate', () => {
    const props = { onMinimize: jest.fn(), onExpand: () => {}, onAdjust: () => {}, onSkip: () => {}, position: null, onPosition: () => {} };
    const tree = renderTree({ ...props, minimized: false });
    expect(live()).toHaveLength(1);
    act(() => tree.update(<RestTimerWidget timer={{ setId: 1, secondsLeft: 50, totalSeconds: 90 }} minimized {...props} />));
    expect(live()).toHaveLength(0);
    expect(consumeRestBack()).toBe(false);
    act(() => tree.update(<RestTimerWidget timer={{ setId: 1, secondsLeft: 50, totalSeconds: 90 }} minimized={false} {...props} />));
    expect(live()).toHaveLength(1);
    act(() => tree.update(<RestTimerWidget timer={null} minimized={false} {...props} />));
    expect(live()).toHaveLength(0);
  });
});

// T-72: on iOS the 92 digits lost the outer edge of the first and last glyph (the Text box was
// one negative tracking step narrower than the drawn line, and iOS clips the ink to the box).
describe('T-72: the countdown digits keep their ink inside the Text box', () => {
  const { digitsInkPad } = require('./RestParts');
  const cases = [
    ['phone full screen', { minimized: false }, 390],
    ['tablet card', { minimized: false }, 834],
    ['phone disc', { minimized: true, dockRoom: 202 }, 390],
    ['tablet disc', { minimized: true, dockRoom: 152 }, 834],
  ];

  it.each(cases)('%s: side padding covers one tracking step + 5 %% of the size, for every clock', (_name, props, width) => {
    mockWidth = width;
    const pads = [0, 71, 528, 599].map((secondsLeft) => {
      const tree = renderTree({ ...props, timer: { setId: 1, secondsLeft, totalSeconds: 600, nextSetKey: '1:2' } });
      const style = StyleSheet.flatten(host(tree, 'rest-countdown').props.style);
      expect(style.letterSpacing).toBeLessThan(0);
      expect(style.paddingHorizontal).toBeGreaterThanOrEqual(-style.letterSpacing + style.fontSize * 0.05);
      return style.paddingHorizontal;
    });
    expect(new Set(pads).size).toBe(1);
  });

  it('keeps the size and tracking: 92 / −0.06 em full screen (100 on tablet), 24 / −0.72 on the disc', () => {
    const phone = StyleSheet.flatten(host(renderTree({ minimized: false }), 'rest-countdown').props.style);
    expect(phone).toEqual(expect.objectContaining({ fontSize: 92, lineHeight: 92, letterSpacing: typography.displayTimer.letterSpacing, textAlign: 'center' }));
    const disc = StyleSheet.flatten(host(renderTree({ minimized: true, dockRoom: 202 }), 'rest-countdown').props.style);
    expect(disc).toEqual(expect.objectContaining({ fontSize: 24, letterSpacing: -0.72 }));
  });

  it('digitsInkPad: rounds up, ignores positive tracking, and survives a missing style', () => {
    expect(digitsInkPad({ fontSize: 92, letterSpacing: -5.52 })).toBe(11);
    expect(digitsInkPad({ fontSize: 24, letterSpacing: -0.72 })).toBe(2);
    expect(digitsInkPad({ fontSize: 20, letterSpacing: 1 })).toBe(1);
    expect(digitsInkPad(null)).toBe(0);
  });
});

// T-72 round 2: on the owner's iPhone the TOPS of the digits were cut flat too. lineHeight = fontSize put the
// Geist digit tops (0.726 em over a 0.295 em descent) ~1.9 pt above the Text box, and iOS clips ink to the box.
describe('T-72 round 2: the digit tops and bottoms stay inside the Text box, with no layout shift', () => {
  const { digitsInkPadVertical } = require('./RestParts');
  const cases = [
    ['phone full screen', { minimized: false }, 390],
    ['tablet card', { minimized: false }, 834],
    ['phone disc', { minimized: true, dockRoom: 202 }, 390],
    ['tablet disc', { minimized: true, dockRoom: 152 }, 834],
  ];

  it.each(cases)('%s: top/bottom padding covers the Geist digit span over the lineHeight + 5 %%, cancelled by margin', (_name, props, width) => {
    mockWidth = width;
    const style = StyleSheet.flatten(host(renderTree(props), 'rest-countdown').props.style);
    expect(style.paddingVertical).toBeGreaterThanOrEqual(1.03 * style.fontSize - style.lineHeight + style.fontSize * 0.05);
    expect(style.paddingVertical).toBeGreaterThan(0);
    expect(style.marginVertical).toBe(-style.paddingVertical);
  });

  it('digitsInkPadVertical: 92/92 → 8, 100/100 → 8, the 24/28 disc → 2, no lineHeight → 5 % only', () => {
    expect(digitsInkPadVertical({ fontSize: 92, lineHeight: 92 })).toBe(8);
    expect(digitsInkPadVertical({ fontSize: 100, lineHeight: 100 })).toBe(8);
    expect(digitsInkPadVertical({ fontSize: 24, lineHeight: 28 })).toBe(2);
    expect(digitsInkPadVertical({ fontSize: 20 })).toBe(1);
    expect(digitsInkPadVertical(null)).toBe(0);
  });
});
