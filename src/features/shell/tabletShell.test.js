import { ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ShellOverlay from './ShellOverlay';
import ShellPage from './ShellPage';

// T-55 shell switch (RN-SPEC-v2-foundation §3 [O2]: "tablets use the rail in
// portrait AND landscape"; tablet-strategy: ≥ 1280 keeps the rail, content
// capped at 1120 and centred). ShellPage and the tab-bar overlay rendered together.
// T-56: the overlay draws the one rail; ShellPage only reserves its width.
const mockRoute = { name: 'Home', params: {} };
const mockUser = { current: null };
jest.mock('@react-navigation/native', () => ({ useRoute: () => mockRoute }));
const mockInsets = { top: 24, bottom: 20, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('react-native-draggable-flatlist', () => ({ NestableScrollContainer: 'NestableScrollContainer' }));
jest.mock('./AppHeader', () => () => null);
jest.mock('./ModeSwitch', () => () => null);
jest.mock('./BottomNav', () => {
  const { View } = require('react-native');
  return function MockBottomNav() {
    return <View testID="bottom-nav" />;
  };
});
jest.mock('../notifications/NotificationPanel', () => () => null);
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: mockUser.current, workspace: 'trainer' }) }));
jest.mock('./shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./shellUiStore', () => ({
  closePanel: jest.fn(),
  useShellUiStore: (select) => select({ panelOpen: false, isSessionActive: false }),
}));
jest.mock('../../shared/hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => 0 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const { openShellPath } = require('./shellLinks');

const homeState = { index: 0, routes: [{ name: 'TodayTab', state: { index: 0, routes: [{ name: 'Home', params: {} }] } }] };

function render(width, height, fontScale = 1, navState = homeState) {
  useWindowDimensions.mockReturnValue({ width, height, scale: 2, fontScale });
  let tree;
  act(() => {
    tree = create(
      <>
        <ShellPage>
          <Text>Page</Text>
        </ShellPage>
        <ShellOverlay state={navState} />
      </>
    );
  });
  return tree;
}

const hostAll = (tree, id) => tree.root.findAll((node) => node.props?.testID === id && typeof node.type === 'string');
const has = (tree, id) => hostAll(tree, id).length > 0;
const pageScroller = (tree) => tree.root.findAllByType(ScrollView).find((node) => node.props.testID !== 'tablet-rail-scroll');

afterEach(() => {
  jest.clearAllMocks();
  mockUser.current = null;
  Object.assign(mockRoute, { name: 'Home', params: {} });
  Object.assign(mockInsets, { left: 0, right: 0 });
});
const railsInPage = (tree) => hostAll(tree, 'app-root')[0].findAll((node) => node.props?.testID === 'tablet-rail');

describe('tablets: the rail in portrait AND landscape, no tab bar', () => {
  it.each([
    ['768 portrait', 768, 1024],
    ['768 landscape (1024 × 768)', 1024, 768],
    ['834 portrait (iPad 11")', 834, 1194],
    ['1194 landscape (iPad 11")', 1194, 834],
    ['1024 portrait (iPad 13")', 1024, 1366],
    ['1366 landscape (iPad 13")', 1366, 1024],
    ['800 portrait (Pixel Tablet)', 800, 1280],
    ['1280 landscape (Pixel Tablet)', 1280, 800],
  ])('%s', (_name, width, height) => {
    const tree = render(width, height);
    expect(hostAll(tree, 'tablet-rail')).toHaveLength(1);
    expect(has(tree, 'bottom-nav')).toBe(false);
    // T-56: drawn by the overlay, never inside the page; the page reserves 88.
    expect(railsInPage(tree)).toHaveLength(0);
    expect(StyleSheet.flatten(hostAll(tree, 'tablet-frame')[0].props.style).paddingLeft).toBe(88);
  });

  it('the rail sits outside the page scroll (fixed, full height)', () => {
    const tree = render(834, 1194);
    const scroller = pageScroller(tree);
    const railInScroller = scroller.findAll((node) => node.props?.testID === 'tablet-rail');
    expect(railInScroller).toHaveLength(0);
    expect(StyleSheet.flatten(hostAll(tree, 'tablet-rail')[0].props.style).alignSelf).toBe('stretch');
  });

  it('the v1 text sidebar is gone', () => {
    expect(has(render(1024, 768), 'desktop-sidebar')).toBe(false);
  });
});

describe('phones and small windows (< 768): the tab bar, no rail', () => {
  it.each([
    ['390 phone', 390, 844],
    ['744 iPad mini portrait', 744, 1133],
    ['767', 767, 1024],
    ['phone landscape 740', 740, 360],
  ])('%s', (_name, width, height) => {
    const tree = render(width, height);
    expect(has(tree, 'tablet-rail')).toBe(false);
    expect(has(tree, 'bottom-nav')).toBe(true);
  });
});

describe('content column beside the rail', () => {
  const column = (tree) => StyleSheet.flatten(hostAll(tree, 'shell-content-column')[0].props.style);

  it.each([
    [1280, 800],
    [1366, 1024],
  ])('≥ 1280 (%i): content capped at 1120 and centred, rail kept', (width, height) => {
    const tree = render(width, height);
    expect(column(tree)).toMatchObject({ maxWidth: 1120, alignSelf: 'center', width: '100%' });
    expect(has(tree, 'tablet-rail')).toBe(true);
  });

  it('tablet gutters: 24 beside the rail and 24 + the right inset; the rail takes the top inset', () => {
    const tree = render(834, 1194);
    const scroller = pageScroller(tree);
    expect(scroller.props.contentContainerStyle).toMatchObject({ paddingTop: 24, paddingLeft: 24, paddingRight: 24 });
    expect(StyleSheet.flatten(hostAll(tree, 'tablet-frame-column')[0].props.style).paddingTop).toBe(24);
  });

  it('T-56: a left inset (landscape notch) widens the rail and the reserved space alike', () => {
    Object.assign(mockInsets, { left: 44 });
    const tree = render(1194, 834);
    expect(StyleSheet.flatten(hostAll(tree, 'tablet-rail')[0].props.style).width).toBe(88 + 44);
    expect(StyleSheet.flatten(hostAll(tree, 'tablet-frame')[0].props.style).paddingLeft).toBe(88 + 44);
  });
});

describe('rail items follow the mode (shellRules.resolveMode)', () => {
  const labels = (tree) =>
    tree.root
      .findAll((node) => typeof node.props?.testID === 'string' && node.props?.testID.startsWith('rail-') && typeof node.props.style === 'function')
      .map((node) => node.props.accessibilityLabel);

  it('member: five items, Today active on /', () => {
    const tree = render(834, 1194);
    expect(labels(tree)).toEqual(['Today', 'Plans', 'Exercises', 'Progress', 'Profile']);
    const today = tree.root.find((node) => node.props?.testID === 'rail-Today' && typeof node.props.style === 'function');
    expect(today.props.accessibilityState.selected).toBe(true);
  });

  it('a trainer on a /trainer page gets the trainer items, Clients active', () => {
    mockUser.current = { roles: ['trainer'] };
    Object.assign(mockRoute, { name: 'TrainerClients', params: {} });
    // T-56: the overlay's rail reads the focused route from the tab state.
    const clientsState = { index: 0, routes: [{ name: 'TClients', state: { index: 0, routes: [{ name: 'TrainerClients', params: {} }] } }] };
    const tree = render(1194, 834, 1, clientsState);
    expect(labels(tree)).toEqual(['Today', 'Clients', 'Plans', 'Profile']);
    const clients = tree.root.find((node) => node.props?.testID === 'rail-TClients' && typeof node.props.style === 'function');
    expect(clients.props.accessibilityState.selected).toBe(true);
    act(() => clients.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/trainer/clients');
  });
});

describe('large text in the tablet shell', () => {
  it.each([2, 3.1])('fontScale %s: the rail stays (icons only) and the page still renders', (scale) => {
    const tree = render(834, 1194, scale);
    expect(has(tree, 'tablet-rail')).toBe(true);
    const railTexts = hostAll(tree, 'tablet-rail')[0].findAllByType(Text).map((node) => node.props.children);
    expect(railTexts).toEqual(['G']);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Page')).toBe(true);
  });
});
