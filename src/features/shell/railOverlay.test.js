import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create } from 'react-test-renderer';

import { routes } from '../../navigation/routes';
import ShellOverlay from './ShellOverlay';
import ShellPage from './ShellPage';
import { ShellTab } from './shellNavigation';
import { useShellUiStore } from './shellUiStore';

// T-56: the tablet rail is drawn ONCE by ShellOverlay (the bottom-tabs
// `tabBar`, above every tab stack), so a stack push/pop slides the page and
// never the rail (web: only the rail is sticky; the page scrolls). ShellPage
// only reserves the rail's 88 (+ the left inset). Real navigators: bottom tabs
// with ShellOverlay as the tab bar, a native stack per tab, ShellPage screens.
const mockRailMounts = [];
jest.mock('./TabletRail', () => {
  const { useEffect } = require('react');
  const Actual = jest.requireActual('./TabletRail').default;
  return function CountedRail(props) {
    useEffect(() => {
      mockRailMounts.push(props.path);
    }, []);
    return <Actual {...props} />;
  };
});
jest.mock('./AppHeader', () => () => null);
jest.mock('./ModeSwitch', () => () => null);
jest.mock('./BottomNav', () => {
  const { View } = require('react-native');
  return function MockBottomNav() {
    return <View testID="bottom-nav" />;
  };
});
jest.mock('../notifications/NotificationPanel', () => () => null);
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: null, workspace: null }) }));
jest.mock('./shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../workspace/workspacePreference', () => ({ setWorkspace: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-draggable-flatlist', () => ({ NestableScrollContainer: 'NestableScrollContainer' }));
jest.mock('../../shared/hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => 0 }));
// A live window: every subscriber re-renders on a resize (as RN's Dimensions events).
const mockWindow = { value: { width: 834, height: 1194, scale: 2, fontScale: 1 }, listeners: new Set() };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => {
  const { useSyncExternalStore } = require('react');
  return {
    __esModule: true,
    default: () =>
      useSyncExternalStore(
        (listener) => {
          mockWindow.listeners.add(listener);
          return () => mockWindow.listeners.delete(listener);
        },
        () => mockWindow.value
      ),
  };
});

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function page(label) {
  function Page() {
    return (
      <ShellPage>
        <Text>{label}</Text>
      </ShellPage>
    );
  }
  return Page;
}
const PlansRoot = page('Plans root');
const PlanDetail = page('Plan detail');
const ExercisesRoot = page('Exercises root');
const HomeRoot = page('Home root');

function PlansStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={routes.PlansLibrary} component={PlansRoot} />
      <Stack.Screen name={routes.PlanDetail} component={PlanDetail} />
    </Stack.Navigator>
  );
}
function ExercisesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={routes.Exercises} component={ExercisesRoot} />
    </Stack.Navigator>
  );
}
function TodayStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={routes.Home} component={HomeRoot} />
    </Stack.Navigator>
  );
}

const insets = { top: 24, bottom: 20, left: 0, right: 0 };
let navRef;
let tree;

function setWindow(width, height) {
  mockWindow.value = { width, height, scale: 2, fontScale: 1 };
  mockWindow.listeners.forEach((listener) => listener());
}

function app(width, height) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width, height }, insets }}>
      <NavigationContainer ref={navRef}>
        <Tabs.Navigator initialRouteName={ShellTab.Plans} tabBar={(props) => <ShellOverlay {...props} />} screenOptions={{ headerShown: false }}>
          <Tabs.Screen name={ShellTab.Today} component={TodayStack} />
          <Tabs.Screen name={ShellTab.Plans} component={PlansStack} />
          <Tabs.Screen name={ShellTab.Exercises} component={ExercisesStack} />
        </Tabs.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

async function mount(width, height) {
  setWindow(width, height);
  await act(async () => {
    tree = create(app(width, height));
  });
}

const hostAll = (id) => tree.root.findAll((node) => node.props?.testID === id && typeof node.type === 'string');
const railItem = (key) => tree.root.find((node) => node.props?.testID === `rail-${key}` && typeof node.props.style === 'function');
const selected = (key) => railItem(key).props.accessibilityState.selected;
const shownText = (label) => tree.root.findAllByType(Text).some((node) => node.props.children === label);
// The rail is never inside a page (ShellPage's root is `app-root`).
const railsInPages = () => hostAll('app-root').reduce((sum, root) => sum + root.findAll((node) => node.props?.testID === 'tablet-rail').length, 0);

beforeEach(() => {
  mockRailMounts.length = 0;
  navRef = createNavigationContainerRef();
  useShellUiStore.setState({ panelOpen: false, isSessionActive: false });
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
});

describe('one rail across stack pushes (tablet)', () => {
  it.each([
    ['834 portrait', 834, 1194],
    ['1194 landscape', 1194, 834],
  ])('%s: push and pop keep the same, single rail instance outside every page', async (_name, width, height) => {
    await mount(width, height);
    expect(hostAll('tablet-rail')).toHaveLength(1);
    expect(railsInPages()).toBe(0);
    expect(mockRailMounts).toHaveLength(1);

    await act(async () => navRef.navigate(routes.PlanDetail, { planId: 7 }));
    expect(shownText('Plan detail')).toBe(true);
    expect(hostAll('tablet-rail')).toHaveLength(1);
    expect(railsInPages()).toBe(0);
    expect(mockRailMounts).toHaveLength(1);

    await act(async () => navRef.goBack());
    expect(hostAll('tablet-rail')).toHaveLength(1);
    expect(mockRailMounts).toHaveLength(1);
    expect(hostAll('bottom-nav')).toHaveLength(0);
  });

  it('the active item follows the focused route (push, then another tab)', async () => {
    await mount(834, 1194);
    expect(selected('Plans')).toBe(true);
    await act(async () => navRef.navigate(routes.PlanDetail, { planId: 7 }));
    expect(selected('Plans')).toBe(true);
    expect(selected('Today')).toBe(false);
    await act(async () => navRef.navigate(ShellTab.Exercises));
    expect(selected('Exercises')).toBe(true);
    expect(selected('Plans')).toBe(false);
    await act(async () => navRef.navigate(ShellTab.Today));
    expect(selected('Today')).toBe(true);
    expect(mockRailMounts).toHaveLength(1);
  });

  it('every tablet page reserves the rail width: 88 + the left inset', async () => {
    await mount(1194, 834);
    const frames = hostAll('tablet-frame');
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame) => expect(StyleSheet.flatten(frame.props.style).paddingLeft).toBe(88));
  });
});

describe('orientation and size changes', () => {
  it('portrait ↔ landscape keeps one rail; below 768 the tab bar comes back, no rail', async () => {
    await mount(834, 1194);
    await act(async () => setWindow(1194, 834));
    expect(hostAll('tablet-rail')).toHaveLength(1);
    expect(mockRailMounts).toHaveLength(1);
    await act(async () => setWindow(390, 844));
    expect(hostAll('tablet-rail')).toHaveLength(0);
    expect(hostAll('bottom-nav')).toHaveLength(1);
    expect(hostAll('tablet-frame')).toHaveLength(0);
  });
});

describe('phones (< 768): the floating tab bar, unchanged', () => {
  it.each([390, 767])('%i: tab bar, no rail, across a push', async (width) => {
    await mount(width, 844);
    expect(hostAll('bottom-nav')).toHaveLength(1);
    await act(async () => navRef.navigate(routes.PlanDetail, { planId: 7 }));
    expect(hostAll('bottom-nav')).toHaveLength(1);
    expect(hostAll('tablet-rail')).toHaveLength(0);
    expect(hostAll('tablet-frame')).toHaveLength(0);
  });
});

describe('the live workout keeps its rule: no rail, no tab bar', () => {
  it('tablet: the rail hides while a session runs and comes back after', async () => {
    await mount(834, 1194);
    act(() => useShellUiStore.setState({ isSessionActive: true }));
    expect(hostAll('tablet-rail')).toHaveLength(0);
    expect(hostAll('bottom-nav')).toHaveLength(0);
    // No rail, so no reserved gap either.
    hostAll('tablet-frame').forEach((frame) => expect(StyleSheet.flatten(frame.props.style).paddingLeft).toBe(0));
    act(() => useShellUiStore.setState({ isSessionActive: false }));
    expect(hostAll('tablet-rail')).toHaveLength(1);
  });
});
