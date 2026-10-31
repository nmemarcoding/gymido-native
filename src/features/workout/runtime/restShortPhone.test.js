import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { RestTimerWidget } from './RuntimeOverlays';
import { restSheetLayout } from './RestSheet';

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

// T-153 rest sheet fit (ruling §6).
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

// DELETED B1 (owner delegated OK 30 Oct): restRingSize / restDigitsStyle (the phone ring is gone).

// DECLARED (T-153 §6, PM-approved; were the 9 T-146 "PhoneRest fit" tests): the rest sheet's fit. The controls stay
// pinned 40 above the bottom inset; the photo card shrinks first (floor 160), then the gaps go short; 360×640 fits
// without a scroll; no photo → the name, with the bar + digits centred below it.
describe('RestSheet fit (T-153 §6)', () => {
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
  const loadPhoto = (tree, width = 16, height = 9) => act(() => tree.root.findAll((node) => node.props.testID === 'remote-image' && node.props.onLoad)[0].props.onLoad({ width, height }));
  const photoHeight = (tree) => StyleSheet.flatten(host(tree, 'rest-photo').props.style).height;

  // DECLARED (T-162 = spec §12 P2, approved; replaces the T-161 live-layout tests): the short gaps switch on the window
  // height (< 844); 14 is always above the banner; the controls are pinned 40 above the bottom inset in EVERY state, the
  // photo card, bar and digits anchored to the top, the leftover between the digits and the controls (min 16).
  it('restSheetLayout: 390×844 (sheet 753, inset 34): the full gaps; a 16:9 photo at full card width (366 → 206)', () => {
    expect(restSheetLayout({ sheetHeight: 753, windowHeight: 844, insetsBottom: 34, photoAspect: 16 / 9, width: 390, hasPhoto: true })).toEqual({
      gaps: { banner: 14, photo: 28, bar: 13 },
      photo: 206,
    });
    // A portrait image stops at the 295 card.
    expect(restSheetLayout({ sheetHeight: 753, windowHeight: 844, insetsBottom: 34, photoAspect: 3 / 4, width: 390, hasPhoto: true }).photo).toBe(295);
  });

  it('restSheetLayout: 360×640 Android 3-button (top 24 → sheet 572, nav 48): the short gaps by the window height; the photo keeps 16 above the controls (160)', () => {
    const layout = restSheetLayout({ sheetHeight: 640 - 24 - 44, windowHeight: 640, insetsBottom: 48, photoAspect: 3 / 4, width: 360, hasPhoto: true });
    expect(layout.gaps).toEqual({ banner: 8, photo: 16, bar: 8 });
    // 572 − (48 + 14 + 60 + 8 + 16 + 23 + 8 + 76 + 16 + 55 + 40 + 48) = 160.
    expect(layout.photo).toBe(160);
    // 843 is still short; the trigger is the window, not the photo room.
    expect(restSheetLayout({ sheetHeight: 760, windowHeight: 843, insetsBottom: 34, photoAspect: 16 / 9, width: 390, hasPhoto: true }).gaps.banner).toBe(8);
  });

  const pinnedRow = (tree, inset) => tree.root.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.position === 'absolute' && StyleSheet.flatten(node.props.style)?.bottom === inset + 40 - 26)[0];

  it('photo state: the controls are pinned (inset + 40 above the bottom, captions inside it); nothing scrolls at normal text', () => {
    mockHeight = 640;
    mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
    const tree = renderHero();
    loadPhoto(tree);
    expect(tree.root.findAll((node) => node.type === 'RCTScrollView')).toHaveLength(0);
    expect(within(pinnedRow(tree, 48), 'rest-timer-skip')).toHaveLength(1);
    expect(photoHeight(tree)).toBe(160);
  });

  it('no photo: the name, then the bar + digits under it (anchored to the top); the controls pinned', () => {
    const tree = renderHero({ ...HERO, exercise: null });
    expect(hosts(tree, 'rest-photo')).toHaveLength(0);
    expect(hosts(tree, 'rest-name')).toHaveLength(1);
    expect(StyleSheet.flatten(host(tree, 'rest-timer-zone').props.style)?.flex).toBeUndefined();
    expect(digits(tree).fontSize).toBe(76);
    expect(within(pinnedRow(tree, mockInsets.bottom), 'rest-timer-skip')).toHaveLength(1);
  });
});
