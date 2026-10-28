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

  it('gives every control a ≥ 44 target (v2: 52 / 60 / 44 sizes, no hitSlop needed)', () => {
    const tree = renderTree({ minimized: false });
    const flat = (id) => StyleSheet.flatten(host(tree, id).props.style);
    expect(flat('rest-timer-minus').minHeight).toBe(52);
    expect(flat('rest-timer-plus').minHeight).toBe(52);
    expect(flat('rest-timer-minus').minWidth).toBe(96);
    expect(flat('rest-timer-skip').minHeight).toBe(60);
    expect(flat('rest-timer-minimize').width).toBe(44);
    expect(flat('rest-timer-minimize').height).toBe(44);
  });
});

const NEXT = { exerciseName: 'Barbell Bench Press', exercise: { name: 'Barbell Bench Press', thumbnail: { url: 'https://example.com/b.jpg' } }, line: 'Set 3 · 8–10 reps · 135 lb' };
const text = (node) => {
  const children = [].concat(node.props.children);
  return children.map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? text(child) : '')).join('');
};
const texts = (tree) => tree.root.findAll((node) => node.type === 'Text').map(text);

describe('Rest, phone (UX F2 Rest board)', () => {
  it('is the full-screen dialog "Rest timer" with "Resting", the digits and "of m:ss"', () => {
    const tree = renderTree({ minimized: false, next: NEXT });
    const root = host(tree, 'rest-timer');
    expect(root.props.role).toBe('dialog');
    expect(root.props.accessibilityLabel).toBe('Rest timer');
    expect(root.props.accessibilityViewIsModal).toBe(true);
    const style = StyleSheet.flatten(root.props.style);
    expect(style).toEqual(expect.objectContaining({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.ground }));
    expect(texts(tree)).toEqual(expect.arrayContaining(['Resting', '1:00', 'of 1:30']));
    const digits = host(tree, 'rest-countdown');
    expect(digits.props.accessibilityRole).toBe('timer');
    expect(StyleSheet.flatten(digits.props.style)).toEqual(expect.objectContaining({ fontSize: 92, lineHeight: 92, fontFamily: typography.displayTimer.fontFamily, color: colors.textPrimary }));
    expect(StyleSheet.flatten(digits.props.style).fontVariant).toEqual(['tabular-nums']);
  });

  it('draws the 300 ring: r136, stroke 14, the arc = time remaining', () => {
    const tree = renderTree({ minimized: false });
    const box = host(tree, 'rest-ring-box');
    expect(StyleSheet.flatten(box.props.style)).toEqual(expect.objectContaining({ width: 300, height: 300 }));
    const arc = tree.root.findAll((node) => node.props.testID === 'rest-ring-arc')[0];
    expect(arc.props.r).toBe(136);
    expect(arc.props.strokeWidth).toBe(14);
    expect(arc.props.stroke).toBe(colors.gold);
    const circumference = 2 * Math.PI * 136;
    // 1:00 of 1:30 → one third used.
    const offset = arc.props.strokeDashoffset;
    const value = typeof offset === 'number' ? offset : offset.__getValue();
    expect(value).toBeCloseTo(circumference / 3, 3);
  });

  it('shows the Next card (photo + "Next · {exercise}" + the set line)', () => {
    const tree = renderTree({ minimized: false, next: NEXT });
    const card = host(tree, 'rest-next');
    expect(card.props.accessibilityLabel).toBe('Next, Barbell Bench Press, Set 3 · 8–10 reps · 135 lb');
    expect(texts(tree)).toEqual(expect.arrayContaining(['Next · Barbell Bench Press', 'Set 3 · 8–10 reps · 135 lb']));
    expect(all(tree, 'rest-next-image')).toHaveLength(1);
  });

  it('hides the Next card when there is no next set; Skip rest stays', () => {
    const tree = renderTree({ minimized: false, next: null });
    expect(all(tree, 'rest-next')).toHaveLength(0);
    expect(host(tree, 'rest-timer-skip')).toBeDefined();
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

  it('last 10 s: the digits turn danger text; above 10 s they do not; "of m:ss" unchanged', () => {
    const calm = renderTree({ minimized: false, timer: { setId: 1, secondsLeft: 11, totalSeconds: 90 } });
    expect(StyleSheet.flatten(host(calm, 'rest-countdown').props.style).color).toBe(colors.textPrimary);
    const final = renderTree({ minimized: false, timer: { setId: 1, secondsLeft: 10, totalSeconds: 90 } });
    expect(StyleSheet.flatten(host(final, 'rest-countdown').props.style).color).toBe(colors.dangerText);
    expect(text(host(final, 'rest-total'))).toBe('of 1:30');
  });

  it('under reduced motion the colour still changes in the last 10 s', () => {
    mockReducedMotion = true;
    const tree = renderTree({ minimized: false, timer: { setId: 1, secondsLeft: 5, totalSeconds: 90 } });
    expect(StyleSheet.flatten(host(tree, 'rest-countdown').props.style).color).toBe(colors.dangerText);
    mockReducedMotion = false;
  });

  it('a total that grew with +5 s keeps the ring within one turn', () => {
    const tree = renderTree({ minimized: false, timer: { setId: 1, secondsLeft: 95, totalSeconds: 95 } });
    const arc = tree.root.findAll((node) => node.props.testID === 'rest-ring-arc')[0];
    const offset = arc.props.strokeDashoffset;
    expect(typeof offset === 'number' ? offset : offset.__getValue()).toBeCloseTo(0, 5);
    expect(text(host(tree, 'rest-total'))).toBe('of 1:35');
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
});

describe('Rest minimised (UX F2 Rest minimised)', () => {
  // DECLARED change (UX ruling A121, option B, 27 Oct 2026): was "phone: a 92 dark disc at right 20 / top 112"
  // with top: 112 (it sat over the stage's "How to" pill). The phone disc now docks ABOVE the session's bottom bar
  // (the tablet I2 rule): right 20, top = window height − the dock room − 92.
  it('phone: a 92 dark disc at right 20, docked above the dock room, with the r40 ring and 24 digits', () => {
    const dockRoom = 202;
    const tree = renderTree({ minimized: true, dockRoom });
    const disc = host(tree, 'rest-timer');
    const style = StyleSheet.flatten(disc.props.style);
    expect(style).toEqual(expect.objectContaining({ width: 92, height: 92, borderRadius: 46, left: 390 - 20 - 92, top: 844 - dockRoom - 92, borderColor: colors.hairlineBright }));
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

  // UX ruling A121 (option B, 27 Oct 2026): docked above the bottom bar, the phone disc clears the top of the
  // screen: the session top bar (Exit, about 60 with a 2-line plan name) and the stage's "How to" pill, which
  // both live inside the 330 phone stage, on a small (667) and a regular (844) phone with the live dock.
  it.each([
    [667, 0],
    [844, 34],
  ])('phone %s (inset %s): the docked disc clears "How to" and Exit (inside the 330 stage)', (height, inset) => {
    const { PHONE_STAGE_HEIGHT } = require('./RuntimeParts');
    const dockRoom = 32 + 64 + 44 + 28 + inset;
    const top = height - dockRoom - 92;
    expect(PHONE_STAGE_HEIGHT).toBe(330);
    expect(top).toBeGreaterThan(PHONE_STAGE_HEIGHT);
    expect(top).toBeGreaterThan(60 + 44);
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
      const tree = renderTree({ minimized: false, next: NEXT });
      expect(host(tree, 'rest-countdown').props.maxFontSizeMultiplier).toBe(1.2);
      expect(host(tree, 'rest-countdown').props.adjustsFontSizeToFit).toBe(true);
      expect(host(tree, 'rest-total').props.maxFontSizeMultiplier).toBe(2);
      for (const id of ['rest-timer-minus', 'rest-timer-plus', 'rest-timer-skip']) {
        const style = StyleSheet.flatten(host(tree, id).props.style);
        expect(style.height).toBeUndefined();
      }
      // Button labels never carry a line cap.
      const labels = tree.root.findAll((n) => n.type === 'Text' && ['Skip rest', '−5s', '+5s'].includes(text(n)));
      labels.forEach((label) => expect(label.props.numberOfLines).toBeUndefined());
      // The whole screen scrolls when it needs the room.
      expect(tree.root.findAll((n) => n.type === 'RCTScrollView').length).toBeGreaterThan(0);
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
