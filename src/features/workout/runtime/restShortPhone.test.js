import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { RestTimerWidget } from './RuntimeOverlays';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
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
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
let mockHeight = 844;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: mockHeight, scale: 2, fontScale: 1 }),
}));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

// T-146 phone Rest fit (RN-SPEC dated 30 Oct + Q5): the buttons sit at the
// bottom at every height, nothing scrolls; the photo is at most min(320, 38 %
// of the height) and gives up the room it lacks (floor 160); the timer is
// clamp(72, 11 % of the height, 92).
const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockHeight = 844;
  mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
});
const hosts = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const host = (tree, id) => hosts(tree, id)[0];
const within = (parent, id) => parent.findAll((node) => node.props.testID === id && typeof node.type === 'string');

const digits = (tree) => StyleSheet.flatten(host(tree, 'rest-countdown').props.style);
const layout = (node, height) => act(() => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } }));

// DELETED B1 (owner delegated OK 30 Oct): restRingSize / restDigitsStyle (the phone ring is gone).

// T-146 (DECLARED B2/B3, PM-approved; RN-SPEC dated 30 Oct + Q5): the phone Rest no longer scrolls or docks: the
// −5 · Skip rest · +5 bar sits at the bottom (insets.bottom + 24); the buttons never move.
describe('PhoneRest (T-146 fit)', () => {
  const HERO = { mode: 'mid', name: 'Leg Press', exercise: { thumbnail: { url: 'https://example.com/leg.jpg', media_type: 'image' } }, left: 3 };
  function renderHero(hero = HERO) {
    let tree;
    act(() => {
      tree = create(
        <RestTimerWidget timer={{ setId: 1, secondsLeft: 60, totalSeconds: 90 }} hero={hero} onMinimize={() => {}} onAdjust={() => {}} onSkip={() => {}} position={null} onPosition={() => {}} />
      );
    });
    mounted.push(tree);
    return tree;
  }
  // The 390×277 board photo, loaded.
  const loadPhoto = (tree) => act(() => tree.root.findAll((node) => node.props.testID === 'remote-image' && node.props.onLoad)[0].props.onLoad({ width: 390, height: 277 }));
  const photoHeight = (tree) => StyleSheet.flatten(host(tree, 'rest-photo').props.style).height;

  it.each([844, 640])('%i tall: the buttons sit in the bottom bar (insets.bottom + 24); nothing scrolls', (height) => {
    mockHeight = height;
    mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
    const tree = renderHero();
    expect(tree.root.findAll((node) => node.type === 'RCTScrollView')).toHaveLength(0);
    expect(hosts(tree, 'rest-dock')).toHaveLength(0);
    const bar = tree.root.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.bottom === 48 + 24)[0];
    expect(within(bar, 'rest-timer-skip')).toHaveLength(1);
  });

  it('844 tall: the photo at its own aspect (full width 360 → 256), the 92 digits', () => {
    const tree = renderHero();
    loadPhoto(tree);
    expect(photoHeight(tree)).toBe(256);
    expect(digits(tree).fontSize).toBe(92);
  });

  it('360x640 Android, 3-button nav (status 24, nav 48): digits 72 (11 %), the photo capped (38 %) and giving up the room', () => {
    mockHeight = 640;
    mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
    const tree = renderHero();
    loadPhoto(tree);
    expect(digits(tree).fontSize).toBe(72);
    expect(digits(tree).lineHeight).toBe(72);
    // around = top 76 + 40 + text 66 + 24 + digits 72 + 16 + bar 52 + bottom 72 = 418; room 222 (< the 243 cap).
    expect(photoHeight(tree)).toBe(222);
    layout(host(tree, 'rest-text'), 104);
    expect(photoHeight(tree)).toBe(184);
  });

  it('the photo never goes below its 160 floor; the digits keep their clamp', () => {
    mockHeight = 640;
    mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
    const tree = renderHero();
    loadPhoto(tree);
    layout(host(tree, 'rest-text'), 200);
    expect(photoHeight(tree)).toBe(160);
    expect(digits(tree).fontSize).toBe(72);
  });

  it('no photo (none, or not loaded yet): no card and no blend; the text starts 24 under the top bar', () => {
    mockHeight = 640;
    const tree = renderHero({ ...HERO, exercise: null });
    expect(hosts(tree, 'rest-photo')).toHaveLength(0);
    expect(hosts(tree, 'rest-photo-blend')).toHaveLength(0);
    expect(digits(tree).fontSize).toBe(72);
    // top bar = 0 + 8 + 44; the column = 24 below it.
    expect(StyleSheet.flatten(host(tree, 'rest-column').props.style).top).toBe(52 + 24);
  });
});
