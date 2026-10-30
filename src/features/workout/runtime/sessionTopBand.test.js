import { Animated, Keyboard, ScrollView, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import SessionRuntime from './SessionRuntime';
import { endSessionState } from './workoutSessionStore';
import { colors, motion, spacing } from '../../../shared/theme/tokens';

// UX native final audit 27 Oct 2026, row A116 + ruling 2 amendment (1): the
// workout session draws no band while the edge-to-edge stage photo sits under
// the status bar and the floating pills (Exit · plan · timer · All). Once the
// photo has scrolled out from under them, a backdrop band (the status-bar
// backdrop's colours) fades in from the top edge to the pills' bottom, 150 ms,
// at once with reduced motion, so list text never runs under the pills.

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
const mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock, Defs: Mock, LinearGradient: Mock, Stop: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => {
  const { View } = require('react-native');
  return (props) => <View testID="remote-image" {...props} />;
});
jest.mock('../api/workoutApi', () => ({
  abandonWorkout: jest.fn(() => Promise.resolve()),
  completeWorkout: jest.fn(() => Promise.resolve()),
  updateSessionSet: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../exercises/api/exercisesApi', () => ({ getExercise: jest.fn(() => Promise.resolve({ id: 7, description: 'Lie back.' })) }));
jest.mock('./restAlertPlatform', () => ({ __esModule: true, default: require('./restAlerts').NO_PLATFORM }));
let mockReducedMotion = true;
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockWindow }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));

const set = (id, done = false) => ({ id, set_number: id % 10, is_completed: done, target_reps_min: 8, rest_seconds_planned: 0 });
const SESSION = {
  id: 1,
  started_at: new Date().toISOString(),
  exercises: [
    { id: 1, exercise_name_snapshot: 'Squat', sets: [set(11, true), set(12)], exercise: { thumbnail: { url: 'https://example.com/a.gif' } } },
    { id: 2, exercise_name_snapshot: 'Press', sets: [set(21), set(22)] },
  ],
};
const STAGE_HEIGHT = 420;
const CHROME_HEIGHT = 52;

let mounted = null;
function render() {
  let tree;
  act(() => {
    tree = create(
      <SessionRuntime
        session={SESSION}
        planName="Plan"
        exerciseStatsMap={{}}
        reload={jest.fn(() => Promise.resolve())}
        reloadWithLoader={jest.fn(() => Promise.resolve())}
        writeOverlay={jest.fn()}
        actionError=""
        setActionError={jest.fn()}
        successMessage=""
        setSuccessMessage={jest.fn()}
        reloadError={false}
        retrying={false}
        onRetry={jest.fn()}
        onCompleted={jest.fn()}
      />
    );
  });
  mounted = tree;
  return tree;
}

const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const byId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string')[0];
const flat = (node) => StyleSheet.flatten(node.props.style);
const band = (tree) => host(tree, 'session-top-band');
// The page scroll: the one holding the stage.
const pageScroll = (tree) => tree.root.findAllByType(ScrollView).find((node) => node.findAll((child) => child.props.testID === 'exercise-stage').length > 0);

function layOut(tree) {
  const chrome = host(tree, 'session-chrome');
  if (chrome?.props.onLayout) {
    act(() => chrome.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: CHROME_HEIGHT } } }));
  }
  act(() => host(tree, 'exercise-stage').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: STAGE_HEIGHT } } }));
}
const scrollTo = (tree, y) => act(() => pageScroll(tree).props.onScroll({ nativeEvent: { contentOffset: { x: 0, y } } }));
// T-132 (web 2.1.15 phone): phones draw a solid header bar above the scroll, so the band only lives where pills
// float over one scroll: tablet browsing.
const TABLET = { width: 1024, height: 768, scale: 2, fontScale: 1 };
function renderTabletBrowsing() {
  mockWindow = TABLET;
  const tree = render();
  act(() => byId(tree, 'session-exercise-row-1').props.onPress());
  return tree;
}

beforeEach(() => {
  mockReducedMotion = true;
  mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  endSessionState();
  jest.restoreAllMocks();
});

describe('session top band (UX native final audit 27 Oct 2026, A116 + ruling 2 amendment 1)', () => {
  // T-132 A1 (PM OK 29 Oct): checked at tablet browsing (the phone has no band; see the T-132 block below). Was: the
  // phone render (390 × 844), chrome top = insets.top + 10.
  it('spans the top edge to the pills’ bottom, full column width, under the pills and over the scroll, never a touch target', () => {
    const tree = renderTabletBrowsing();
    layOut(tree);
    const chromeTop = flat(host(tree, 'session-chrome')).top;
    expect(chromeTop).toBe(mockInsets.top + spacing['2_5'] + spacing[3]);
    expect(flat(band(tree))).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, height: chromeTop + CHROME_HEIGHT });
    expect(band(tree).props.pointerEvents).toBe('none');
    expect(band(tree).props.importantForAccessibility).toBe('no-hide-descendants');
    // Draw order in the column: the scroll, then the band, then the pills.
    const column = host(tree, 'session-column');
    const order = column.findAll((node) => typeof node.type === 'string' && ['session-top-band', 'session-chrome'].includes(node.props.testID));
    expect(order.map((node) => node.props.testID)).toEqual(['session-top-band', 'session-chrome']);
    expect(pageScroll(tree).findAll((node) => node.props.testID === 'session-top-band')).toHaveLength(0);
  });

  // T-132 A2 (PM OK 29 Oct): at tablet browsing. Was: the phone render.
  it('no band while the photo is under the pills; the band once the photo has scrolled out from under them; gone again back at the top', () => {
    const tree = renderTabletBrowsing();
    expect(flat(band(tree)).opacity).toBe(0);
    layOut(tree);
    const bandHeight = flat(band(tree)).height;
    scrollTo(tree, 0);
    expect(flat(band(tree)).opacity).toBe(0);
    scrollTo(tree, STAGE_HEIGHT - bandHeight - 1);
    expect(flat(band(tree)).opacity).toBe(0);
    scrollTo(tree, STAGE_HEIGHT - bandHeight);
    expect(flat(band(tree)).opacity).toBe(1);
    scrollTo(tree, STAGE_HEIGHT + 300);
    expect(flat(band(tree)).opacity).toBe(1);
    scrollTo(tree, 0);
    expect(flat(band(tree)).opacity).toBe(0);
  });

  it('the scroll reports often enough to catch the edge', () => {
    const tree = render();
    expect(pageScroll(tree).props.scrollEventThrottle).toBe(16);
  });

  // T-132 A4 (PM OK 29 Oct): at tablet browsing. Was: the phone render.
  it('fades in over 150 ms (and out) without reduced motion', () => {
    mockReducedMotion = false;
    const timing = jest.spyOn(Animated, 'timing');
    const tree = renderTabletBrowsing();
    layOut(tree);
    timing.mockClear();
    scrollTo(tree, STAGE_HEIGHT);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: motion.durationFast }));
    expect(motion.durationFast).toBe(150);
    timing.mockClear();
    scrollTo(tree, 0);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: motion.durationFast }));
  });

  // T-132 A5 (PM OK 29 Oct): at tablet browsing. Was: the phone render.
  it('uses the status-bar backdrop colours (ruling 2 amendment 2): the 0.86 ground fill', () => {
    const tree = renderTabletBrowsing();
    expect(flat(host(tree, 'session-top-band-fill')).backgroundColor).toBe('rgba(10, 11, 15, 0.86)');
  });

  // T-132 A6 (PM OK 29 Oct; web 2.1.15 phone, sticky at large text pending FE Q2): phones have no band at large text
  // either; the solid header bar above the scroll covers the status bar (the chrome starts at insets.top + 10).
  // Was: a band of the status bar's height that faded in once the stage scrolled away.
  it('large text: no band on phones; the solid header bar above the scroll covers the status bar', () => {
    mockWindow = { ...mockWindow, fontScale: 2 };
    const tree = render();
    expect(band(tree)).toBeUndefined();
    const bar = host(tree, 'session-header-bar');
    expect(pageScroll(tree).findAll((node) => node.props.testID === 'session-header-bar')).toHaveLength(0);
    expect(flat(bar.findAll((node) => node.props.testID === 'session-chrome' && typeof node.type === 'string')[0]).paddingTop).toBe(mockInsets.top + spacing['2_5']);
  });

  it('tablet live: no band (the logger column already starts below the pills and the stage column does not scroll)', () => {
    mockWindow = { width: 1024, height: 768, scale: 2, fontScale: 1 };
    const tree = render();
    expect(band(tree)).toBeUndefined();
  });

  it('tablet browsing (floating pills over the one scroll): the band, as on phones', () => {
    mockWindow = { width: 1024, height: 768, scale: 2, fontScale: 1 };
    const tree = render();
    act(() => byId(tree, 'session-exercise-row-1').props.onPress());
    expect(host(tree, 'browsing-bar')).toBeDefined();
    layOut(tree);
    const bandHeight = flat(band(tree)).height;
    expect(bandHeight).toBe(flat(host(tree, 'session-chrome')).top + CHROME_HEIGHT);
    scrollTo(tree, STAGE_HEIGHT - bandHeight);
    expect(flat(band(tree)).opacity).toBe(1);
  });
});

// T-132 A7 (PM OK 29 Oct; web 2.1.15 phone): the "A116 fix" phone block (375 × 667 and 390 × 844: the band came in as
// soon as the open photo's edge passed the floating pills' bottom, with the same 150 ms fade) is removed. Phones have
// no floating pills and no band: the chrome sits in a solid header bar above the page scroll, at every scroll.
describe('T-132 phones: a solid header bar above the scroll, no band', () => {
  it.each([
    ['375 × 667', { width: 375, height: 667, scale: 2, fontScale: 1 }],
    ['390 × 844', { width: 390, height: 844, scale: 3, fontScale: 1 }],
    ['320 × 568', { width: 320, height: 568, scale: 2, fontScale: 1 }],
  ])('%s: the header bar (status bar + chrome) is above the page scroll, the ground-bar fill + hairline; the photo starts the scroll; no band at any scroll', (_name, window) => {
    mockWindow = window;
    const tree = render();
    const bar = host(tree, 'session-header-bar');
    expect(flat(bar)).toMatchObject({ backgroundColor: colors.groundBar, borderBottomWidth: 1, borderBottomColor: colors.hairline });
    const column = host(tree, 'session-column');
    const order = column.children.filter((child) => typeof child !== 'string').map((child) => child.props.testID ?? child.type.displayName ?? child.type.name ?? child.type);
    expect(order.indexOf('session-header-bar')).toBe(0);
    const chrome = bar.findAll((node) => node.props.testID === 'session-chrome' && typeof node.type === 'string')[0];
    expect(flat(chrome).position).toBeUndefined();
    expect(flat(chrome).paddingTop).toBe(mockInsets.top + spacing['2_5']);
    expect(pageScroll(tree).findAll((node) => node.props.testID === 'session-chrome')).toHaveLength(0);
    expect(flat(host(tree, 'exercise-stage')).paddingTop ?? 0).toBe(0);
    expect(flat(host(tree, 'exercise-stage')).height).toBe(300);
    expect(band(tree)).toBeUndefined();
    scrollTo(tree, 0);
    scrollTo(tree, 400);
    expect(band(tree)).toBeUndefined();
  });
});
