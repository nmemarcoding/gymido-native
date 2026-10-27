import { StyleSheet, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ShellOverlay from './ShellOverlay';

const mockUi = { panelOpen: false, isSessionActive: false };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('./BottomNav', () => {
  const { View } = require('react-native');
  return function MockBottomNav() {
    return <View testID="bottom-nav" />;
  };
});
jest.mock('./TabletRail', () => {
  const { View } = require('react-native');
  return function MockRail({ mode, path }) {
    return <View testID="tablet-rail" mode={mode} path={path} />;
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../notifications/NotificationPanel', () => () => null);
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: null, workspace: null }) }));
jest.mock('./shellUiStore', () => ({ closePanel: jest.fn(), useShellUiStore: (select) => select(mockUi) }));

const state = { index: 0, routes: [{ name: 'Today', state: { index: 0, routes: [{ name: 'Home', params: {} }] } }] };

function hasTabBar(width) {
  useWindowDimensions.mockReturnValue({ width, height: 844, scale: 3, fontScale: 1 });
  let tree;
  act(() => {
    tree = create(<ShellOverlay state={state} />);
  });
  return tree.root.findAll((node) => node.props.testID === 'bottom-nav').length > 0;
}

afterEach(() => {
  Object.assign(mockUi, { panelOpen: false, isSessionActive: false });
});

describe('ShellOverlay tab bar visibility (v1 rules kept)', () => {
  it('shows the floating tab bar on phones (< 768)', () => {
    expect(hasTabBar(390)).toBe(true);
    expect(hasTabBar(767)).toBe(true);
  });

  it('hides it on tablets (≥ 768: the rail navigates)', () => {
    expect(hasTabBar(768)).toBe(false);
    expect(hasTabBar(1024)).toBe(false);
  });

  it('hides it during a running workout session', () => {
    mockUi.isSessionActive = true;
    expect(hasTabBar(390)).toBe(false);
  });
});

// T-56: the overlay (one instance above every tab stack) draws the tablet rail.
describe('ShellOverlay tablet rail', () => {
  function renderAt(width, height = 1024, navState = state) {
    useWindowDimensions.mockReturnValue({ width, height, scale: 2, fontScale: 1 });
    let tree;
    act(() => {
      tree = create(<ShellOverlay state={navState} />);
    });
    return tree;
  }
  const rails = (tree) => tree.root.findAll((node) => node.props.testID === 'tablet-rail' && typeof node.type === 'string');

  it.each([
    [768, 1024],
    [1024, 768],
    [834, 1194],
    [1194, 834],
    [1366, 1024],
  ])('%i × %i: one rail, no tab bar', (width, height) => {
    const tree = renderAt(width, height);
    expect(rails(tree)).toHaveLength(1);
    expect(tree.root.findAll((node) => node.props.testID === 'bottom-nav')).toHaveLength(0);
  });

  it('phones (< 768): no rail', () => {
    expect(rails(renderAt(390, 844))).toHaveLength(0);
    expect(rails(renderAt(767, 1024))).toHaveLength(0);
  });

  it('hidden during a running workout session (as the tab bar)', () => {
    mockUi.isSessionActive = true;
    expect(rails(renderAt(834, 1194))).toHaveLength(0);
  });

  it('the rail gets the focused leaf route path (a pushed screen keeps its tab active)', () => {
    const pushed = {
      index: 0,
      routes: [{ name: 'PlansTab', state: { index: 1, routes: [{ name: 'PlansLibrary', params: {} }, { name: 'PlanDetail', params: { planId: 7 } }] } }],
    };
    expect(rails(renderAt(834, 1194, pushed))[0].props.path).toBe('/plans/7');
  });

  it('fixed at the left, full height, outside the touch layer; below the notification scrim', () => {
    mockUi.panelOpen = true;
    const tree = renderAt(834, 1194);
    const layer = tree.root.find((node) => node.props.testID === 'shell-rail-layer' && typeof node.type === 'string');
    expect(StyleSheet.flatten(layer.props.style)).toMatchObject({ position: 'absolute', top: 0, bottom: 0, left: 0 });
    expect(layer.props.pointerEvents).toBe('box-none');
    const ids = tree.root.findAll((node) => typeof node.type === 'string' && ['shell-rail-layer', 'notification-scrim'].includes(node.props.testID)).map((node) => node.props.testID);
    expect(ids).toEqual(['shell-rail-layer', 'notification-scrim']);
  });
});
