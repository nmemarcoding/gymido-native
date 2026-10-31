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

  it('restSheetLayout: 390×844 (sheet 753, inset 34): a 16:9 photo at full card width (366 → 206), the full gaps', () => {
    expect(restSheetLayout({ sheetHeight: 753, insetsBottom: 34, photoAspect: 16 / 9, width: 390, hasPhoto: true })).toEqual({
      gaps: { banner: 14, photo: 28, bar: 13, controls: 21 },
      photo: 206,
    });
    // A portrait image stops at the 295 card.
    expect(restSheetLayout({ sheetHeight: 753, insetsBottom: 34, photoAspect: 3 / 4, width: 390, hasPhoto: true }).photo).toBe(295);
  });

  it('restSheetLayout: 360×640 Android 3-button (top 24 → sheet 572, nav 48): the short gaps; the photo gives up the room (166, floor 160); it fits', () => {
    const layout = restSheetLayout({ sheetHeight: 640 - 24 - 44, insetsBottom: 48, photoAspect: 3 / 4, width: 360, hasPhoto: true });
    expect(layout.gaps).toEqual({ banner: 8, photo: 16, bar: 8, controls: 16 });
    // 572 − (48 + 8 + 60 + 8 + 16 + 23 + 8 + 76 + 16 + 55 + 40 + 48) = 166 (above the 160 floor).
    expect(layout.photo).toBe(166);
  });

  it('the controls are pinned (inset + 40 above the bottom, captions inside it); nothing scrolls at normal text', () => {
    mockHeight = 640;
    mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
    const tree = renderHero();
    loadPhoto(tree);
    expect(tree.root.findAll((node) => node.type === 'RCTScrollView')).toHaveLength(0);
    const row = tree.root.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.bottom === 48 + 40 - 28)[0];
    expect(within(row, 'rest-timer-skip')).toHaveLength(1);
    expect(photoHeight(tree)).toBe(166);
  });

  it('no photo: the name, then the bar + digits in a centred zone above the controls', () => {
    const tree = renderHero({ ...HERO, exercise: null });
    expect(hosts(tree, 'rest-photo')).toHaveLength(0);
    expect(hosts(tree, 'rest-name')).toHaveLength(1);
    expect(StyleSheet.flatten(host(tree, 'rest-timer-zone').props.style)).toMatchObject({ flex: 1, justifyContent: 'center' });
    expect(digits(tree).fontSize).toBe(76);
  });
});
