import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { digitsInkPad, digitsInkPadVertical } from './RestParts';
import { REST_DIGITS_FLOOR, REST_RING_FLOOR, RestTimerWidget, restDigitsStyle, restRingSize } from './RuntimeOverlays';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
let mockHeight = 844;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: mockHeight, scale: 2, fontScale: 1 }),
}));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

// T-88 (UX short-phone ruling, 28 Oct 2026): Skip rest pinned in a dock at
// every height; under 700 tall the ring shrinks (floor 200) and the digits
// scale with it (never below 40), keeping the T-72 ink padding.
const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockHeight = 844;
  mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
});
const hosts = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const host = (tree, id) => hosts(tree, id)[0];
const within = (parent, id) => parent.findAll((node) => node.props.testID === id && typeof node.type === 'string');

function render(secondsLeft = 60) {
  let tree;
  act(() => {
    tree = create(
      <RestTimerWidget
        timer={{ setId: 1, secondsLeft, totalSeconds: 90 }}
        onMinimize={() => {}}
        onAdjust={() => {}}
        onSkip={() => {}}
        position={null}
        onPosition={() => {}}
      />
    );
  });
  mounted.push(tree);
  return tree;
}
const ring = (tree) => StyleSheet.flatten(host(tree, 'rest-ring-box').props.style).width;
const digits = (tree) => StyleSheet.flatten(host(tree, 'rest-countdown').props.style);
const layout = (node, height) => act(() => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } }));

describe('restRingSize', () => {
  it.each([
    ['700+ tall: the board, whatever is left', 700, 600, 300],
    ['844 tall', 844, 200, 300],
    ['short with room: the height left', 640, 380, 260],
    ['short, room above the board: the board', 690, 300, 300],
    ['below the floor: 200 (the middle scrolls)', 640, 500, REST_RING_FLOOR],
  ])('%s', (_name, windowHeight, fixed, expected) => {
    expect(restRingSize({ board: 300, windowHeight, fixed })).toBe(expected);
  });

  it('a board narrower than the floor stays the board', () => {
    expect(restRingSize({ board: 180, windowHeight: 600, fixed: 500 })).toBe(180);
  });
});

describe('restDigitsStyle: the 92/300 ratio, floor 40, the T-72 ink padding at every size', () => {
  it.each([300, 260, 240, 200])('ring %i', (size) => {
    const style = restDigitsStyle(size);
    expect(style.fontSize).toBe(Math.max(REST_DIGITS_FLOOR, Math.round((92 * size) / 300)));
    expect(style.lineHeight).toBe(style.fontSize);
    expect(style.letterSpacing).toBeLessThan(0);
    // Horizontal: one tracking step + 5 % of the size; vertical: the 1.03 em
    // digit span over the lineHeight + 5 %, so no edge or top is clipped.
    expect(digitsInkPad(style)).toBe(Math.ceil(-style.letterSpacing + style.fontSize * 0.05));
    expect(digitsInkPadVertical(style)).toBe(Math.ceil(0.03 * style.fontSize + style.fontSize * 0.05));
    expect(digitsInkPadVertical(style)).toBeGreaterThan(0);
  });

  it('never below 40', () => {
    expect(restDigitsStyle(100).fontSize).toBe(REST_DIGITS_FLOOR);
  });
});

describe('PhoneRest (T-88)', () => {
  it.each([844, 640])('%i tall: Skip rest is in the pinned rest-dock (12 + insets.bottom), not in the scroll', (height) => {
    mockHeight = height;
    mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
    const tree = render();
    const dock = host(tree, 'rest-dock');
    expect(within(dock, 'rest-timer-skip')).toHaveLength(1);
    expect(StyleSheet.flatten(dock.props.style).position).toBe('absolute');
    expect(StyleSheet.flatten(host(tree, 'rest-dock-body').props.style).paddingBottom).toBe(12 + 48);
    expect(StyleSheet.flatten(host(tree, 'rest-dock-fade').props.style).height).toBe(32);
    const scroll = tree.root.findAll((node) => node.props.contentContainerStyle && typeof node.type !== 'string')[0];
    expect(within(scroll, 'rest-timer-skip')).toHaveLength(0);
  });

  it('the scroll padding is the measured dock height', () => {
    const tree = render();
    layout(host(tree, 'rest-dock'), 164);
    const scroll = tree.root.findAll((node) => node.props.contentContainerStyle && typeof node.type !== 'string')[0];
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(164);
  });

  it('844 tall: ring 300 and the default 92 digits (unchanged)', () => {
    const tree = render();
    expect(ring(tree)).toBe(300);
    expect(digits(tree).fontSize).toBe(92);
  });

  it('640 tall: gaps 24 / 20 (UX option b); the ring takes the height left (measured parts), digits scaled; the floor holds', () => {
    mockHeight = 640;
    const tree = render();
    layout(host(tree, 'rest-dock'), 104);
    const [header, adjust, bottom] = tree.root.findAll((node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function' && node.props.testID === undefined);
    expect(StyleSheet.flatten(adjust.props.style).marginTop).toBe(20);
    layout(header, 44);
    layout(adjust, 44);
    // fixed = top 12 + header 44 + gap 24 + gap 20 + ±5 44 + bottom + dock 104
    layout(bottom, 24 + 140);
    expect(ring(tree)).toBe(640 - 412);
    expect(digits(tree).fontSize).toBe(70);
    expect(digits(tree).lineHeight).toBe(70);
    layout(bottom, 24 + 260);
    expect(ring(tree)).toBe(REST_RING_FLOOR);
    expect(digits(tree).fontSize).toBe(61);
    layout(bottom, 24);
    expect(ring(tree)).toBe(300);
    expect(digits(tree).fontSize).toBe(92);
  });

  it('360x640 Android, 3-button nav (status 24, nav 48), a Next card: no scroll needed, ring 232', () => {
    mockHeight = 640;
    mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
    const tree = render();
    layout(host(tree, 'rest-dock'), 32 + 60 + 12 + 48);
    const [header, adjust, bottom] = tree.root.findAll((node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function' && node.props.testID === undefined);
    layout(header, 44);
    layout(adjust, 44);
    layout(bottom, 24 + 64);
    expect(ring(tree)).toBe(640 - (24 + 12 + 44 + 24 + 20 + 44 + 88 + 152));
    expect(ring(tree)).toBe(232);
  });

  it('844 tall: the gaps stay 64 / 44', () => {
    const tree = render();
    const [, adjust] = tree.root.findAll((node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function' && node.props.testID === undefined);
    expect(StyleSheet.flatten(adjust.props.style).marginTop).toBe(44);
  });
});
