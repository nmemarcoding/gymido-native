import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, NavigationRouteContext, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create } from 'react-test-renderer';

import { routes } from '../../navigation/routes';
import PinnedDock from '../../shared/components/PinnedDock';
import ToastHost, { toastPlacement } from '../../shared/components/ToastHost';
import { ToastTone, addToast, useToastStore } from '../../shared/components/toastStore';
import { usePhoneChromeStore } from './phoneChromeStore';
import ShellOverlay from './ShellOverlay';
import ShellPage from './ShellPage';
import { SHELL_SCREENS, ShellTab, getScreenPath, getScreenTab } from './shellNavigation';
import { PHONE_TAB_BAR_PATHS, showsPhoneTabBar } from './shellRules';
import { useShellUiStore } from './shellUiStore';

// T-65 "phone bottom nav on main pages only" (PHONE-NAV spec, owner decision
// 27 Oct 2026): phones (< 768) draw the tab bar on the nine main tab pages
// only (§1, an exact allowlist); every other page hides it from the first
// frame of the push (§2). Inner pages: docks end 12 + the inset above the
// edge, pages without a dock pad 24 + the inset, toasts sit 16 + the inset
// (above a dock: its height + 12) (§4). The tablet rail is unchanged.
jest.mock('./AppHeader', () => () => null);
jest.mock('./ModeSwitch', () => () => null);
jest.mock('./BottomNav', () => {
  const { View } = require('react-native');
  return function MockBottomNav() {
    return <View testID="bottom-nav" />;
  };
});
jest.mock('./TabletRail', () => {
  const { View } = require('react-native');
  return function MockRail() {
    return <View testID="tablet-rail" />;
  };
});
jest.mock('../notifications/NotificationPanel', () => () => null);
let mockUser = null;
let mockWorkspace = null;
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: mockUser, workspace: mockWorkspace }) }));
jest.mock('../workspace/workspacePreference', () => ({ setWorkspace: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-draggable-flatlist', () => ({ NestableScrollContainer: 'NestableScrollContainer' }));
jest.mock('../../shared/hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => 0, useKeyboardOverlap: () => 0 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn(() => mockWindow) }));
let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };

const MAIN = Object.freeze({
  member: ['/', '/plans', '/exercises', '/progress', '/profile'],
  trainer: ['/trainer', '/trainer/clients', '/trainer/plans', '/trainer/profile'],
});
// §2's inner pages, every one (the no-shell pages have no overlay at all).
const INNER = Object.freeze([
  '/workout',
  '/plans/7',
  '/plans/mine',
  '/plans/mine/new',
  '/plans/mine/7',
  '/plans/generate',
  '/plans/generate/preview',
  '/exercises/12',
  '/notifications',
  '/profile/edit',
  '/my-trainer',
  '/trainers',
  '/trainers/5',
  '/trainer/apply',
  '/trainer/clients/9',
  '/trainer/plans/new',
  '/trainer/plans/4',
]);

// A route for a §1 / §2 path, from the shell's own route table.
const SAMPLE_PARAMS = { planId: '7', exerciseId: '12', trainerUserId: '5', clientUserId: '9' };
function screenFor(path) {
  const params = { planId: path.split('/').pop(), exerciseId: path.split('/').pop(), trainerUserId: path.split('/').pop(), clientUserId: path.split('/').pop() };
  const name = SHELL_SCREENS.find((screen) => getScreenPath(screen, params) === path);
  return { name, params };
}
function overlayState({ name, params }) {
  return { index: 0, routes: [{ name: getScreenTab(name), state: { index: 0, routes: [{ name, params }] } }] };
}

const hosts = (tree, id) => tree.root.findAll((node) => node.props?.testID === id && typeof node.type === 'string');

function renderOverlay(state, width = 390) {
  mockWindow = { width, height: 844, scale: 3, fontScale: 1 };
  let tree;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}>
        <ShellOverlay state={state} />
      </SafeAreaProvider>,
    );
  });
  return tree;
}
const barShown = (path, width) => hosts(renderOverlay(overlayState(screenFor(path)), width), 'bottom-nav').length > 0;

const MODES = [
  ['member', () => ((mockUser = { roles: ['member'] }), (mockWorkspace = null))],
  ['trainer', () => ((mockUser = { roles: ['trainer'] }), (mockWorkspace = 'trainer'))],
];

beforeEach(() => {
  mockUser = null;
  mockWorkspace = null;
  mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
  useShellUiStore.setState({ panelOpen: false, isSessionActive: false });
  usePhoneChromeStore.setState({ phoneTabBar: true, pageDock: null });
});

describe('showsPhoneTabBar: the §1 allowlist (exact pathname, T-65)', () => {
  it('is exactly the nine main tab paths', () => {
    expect([...PHONE_TAB_BAR_PATHS].sort()).toEqual([...MAIN.member, ...MAIN.trainer].sort());
  });

  it.each([...MAIN.member, ...MAIN.trainer])('%s shows the bar', (path) => {
    expect(showsPhoneTabBar(path)).toBe(true);
  });

  it.each(INNER)('%s hides it', (path) => {
    expect(showsPhoneTabBar(path)).toBe(false);
  });

  it('a trailing slash is normalised; the query and the hash are ignored', () => {
    expect(showsPhoneTabBar('/plans/')).toBe(true);
    expect(showsPhoneTabBar('/plans?x=1')).toBe(true);
    expect(showsPhoneTabBar('/exercises?search=row&muscle=back')).toBe(true);
    expect(showsPhoneTabBar('/trainer/clients/#top')).toBe(true);
    expect(showsPhoneTabBar('/?tab=1')).toBe(true);
    expect(showsPhoneTabBar('/plans/mine/?x=1')).toBe(false);
    expect(showsPhoneTabBar('/workout?active=1')).toBe(false);
  });

  it('no prefix matching: the old "extra" prefixes (Today owns /workout, Profile owns /my-trainer) show no bar', () => {
    ['/workout', '/my-trainer', '/trainers', '/trainer/apply', '/plansX', '/profile/edit'].forEach((path) => expect(showsPhoneTabBar(path)).toBe(false));
  });
});

describe.each(MODES)('ShellOverlay on a phone, %s mode (T-65 §1 / §2)', (_mode, setMode) => {
  beforeEach(() => setMode());

  it.each([...MAIN.member, ...MAIN.trainer])('the main page %s draws the bar', (path) => {
    expect(barShown(path, 390)).toBe(true);
  });

  it.each(INNER)('the inner page %s draws no bar', (path) => {
    expect(barShown(path, 390)).toBe(false);
  });

  it('320 and 767 wide follow the same rule', () => {
    expect(barShown('/plans', 320)).toBe(true);
    expect(barShown('/plans/7', 320)).toBe(false);
    expect(barShown('/trainer/clients', 767)).toBe(true);
    expect(barShown('/trainer/clients/9', 767)).toBe(false);
  });
});

describe('ShellOverlay walks the whole shell route table (T-65 §2: anything off the allowlist hides the bar)', () => {
  it.each(SHELL_SCREENS)('%s', (name) => {
    const path = getScreenPath(name, SAMPLE_PARAMS);
    const tree = renderOverlay(overlayState({ name, params: SAMPLE_PARAMS }));
    expect(hosts(tree, 'bottom-nav').length > 0).toBe(PHONE_TAB_BAR_PATHS.includes(path));
  });

  it('exactly nine screens of the table are main pages', () => {
    expect(SHELL_SCREENS.filter((name) => showsPhoneTabBar(getScreenPath(name, SAMPLE_PARAMS)))).toHaveLength(9);
  });
});

describe('the rest of the overlay is unchanged', () => {
  it('tablets: never the bar, on a main page or an inner one; the rail stays', () => {
    const main = renderOverlay(overlayState(screenFor('/plans')), 834);
    expect(hosts(main, 'bottom-nav')).toHaveLength(0);
    expect(hosts(main, 'tablet-rail')).toHaveLength(1);
    const inner = renderOverlay(overlayState(screenFor('/plans/7')), 834);
    expect(hosts(inner, 'bottom-nav')).toHaveLength(0);
    expect(hosts(inner, 'tablet-rail')).toHaveLength(1);
  });

  it('a running session still hides it, even over a main page', () => {
    useShellUiStore.setState({ isSessionActive: true });
    expect(barShown('/', 390)).toBe(false);
  });

  it('mirrors the bar for the app-level toasts (phoneChromeStore)', () => {
    renderOverlay(overlayState(screenFor('/plans/7')));
    expect(usePhoneChromeStore.getState().phoneTabBar).toBe(false);
    renderOverlay(overlayState(screenFor('/plans')));
    expect(usePhoneChromeStore.getState().phoneTabBar).toBe(true);
  });
});

// Real navigators: bottom tabs with ShellOverlay as the tab bar, a native
// stack per tab, ShellPage screens (one with a PinnedDock), the app's ToastHost.
const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
let dockHeight = null;

function Page({ label, docked = false }) {
  return (
    <ShellPage dockHeight={docked ? dockHeight : null}>
      <Text>{label}</Text>
    </ShellPage>
  );
}
function DockedPage({ label }) {
  return (
    <>
      <Page label={label} docked />
      <PinnedDock testID="page-dock" onHeight={(height) => (dockHeight = height)}>
        <Text>Buttons</Text>
      </PinnedDock>
    </>
  );
}
const PlansRoot = () => <DockedPage label="Plans root" />;
const PlanDetail = () => <Page label="Plan detail" />;
const Generator = () => <DockedPage label="Generator" />;

function PlansStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={routes.PlansLibrary} component={PlansRoot} />
      <Stack.Screen name={routes.PlanDetail} component={PlanDetail} />
      <Stack.Screen name={routes.PlanGenerator} component={Generator} />
    </Stack.Navigator>
  );
}

const INSETS = { top: 47, bottom: 34, left: 0, right: 0 };
let navRef;
let tree;

async function mount(width = 390) {
  mockWindow = { width, height: 844, scale: 3, fontScale: 1 };
  navRef = createNavigationContainerRef();
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width, height: 844 }, insets: INSETS }}>
        <NavigationContainer ref={navRef}>
          <Tabs.Navigator initialRouteName={ShellTab.Plans} tabBar={(props) => <ShellOverlay {...props} />} screenOptions={{ headerShown: false }}>
            <Tabs.Screen name={ShellTab.Plans} component={PlansStack} />
          </Tabs.Navigator>
        </NavigationContainer>
        <ToastHost />
      </SafeAreaProvider>,
    );
  });
}

const onScreen = (label) => tree.root.findAllByType(Text).some((node) => node.props.children === label);
const flat = (node) => StyleSheet.flatten(node.props.style) ?? {};
// The focused page's content column bottom padding (ShellPage: the tab-bar / inner-page room).
function focusedContentPad(label) {
  const text = tree.root.findAllByType(Text).find((node) => node.props.children === label);
  let node = text;
  while (node && node.type !== ScrollView) {
    node = node.parent;
  }
  const content = node.props.children.props.children;
  return [].concat(content.props.style).reduce((sum, part) => sum + (part?.paddingBottom ?? 0), 0);
}
const lastDockBody = () => hosts(tree, 'page-dock-body').slice(-1)[0];

afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
  dockHeight = null;
  act(() => useToastStore.setState({ toasts: [] }));
});

describe('a real push on a phone (T-65 §2 / §4)', () => {
  it('the bar is gone on the pushed inner page from its first render, and back on the main page after the pop', async () => {
    await mount();
    expect(hosts(tree, 'bottom-nav')).toHaveLength(1);
    await act(async () => navRef.navigate(routes.PlanDetail, { planId: 7 }));
    expect(onScreen('Plan detail')).toBe(true);
    expect(hosts(tree, 'bottom-nav')).toHaveLength(0);
    await act(async () => navRef.goBack());
    expect(hosts(tree, 'bottom-nav')).toHaveLength(1);
  });

  it('an inner page without a dock pads its content 24 + the inset; the main page keeps 104 + the inset', async () => {
    await mount();
    await act(async () => navRef.navigate(routes.PlanDetail, { planId: 7 }));
    expect(focusedContentPad('Plan detail')).toBe(24 + 34);
    // The main page below it (its dock height is not handed over in this harness): the tab-bar room, unchanged.
    expect(focusedContentPad('Plans root')).toBe(104 + 34);
  });

  it('an inner page dock: the buttons end 12 + the inset above the bottom edge (no tab bar under it)', async () => {
    await mount();
    await act(async () => navRef.navigate(routes.PlanGenerator));
    expect(onScreen('Generator')).toBe(true);
    expect(flat(lastDockBody()).paddingBottom).toBe(12 + 34);
    expect(flat(hosts(tree, 'page-dock').slice(-1)[0])).toMatchObject({ position: 'absolute', bottom: 0 });
  });

  it('a main page dock still sits 12 above the tab bar (86 + 12 + the inset), unchanged', async () => {
    await mount();
    expect(flat(lastDockBody()).paddingBottom).toBe(86 + 12 + 34);
  });

  it('tablets: the dock keeps its own rule (the inset + its bottomGap), as before', async () => {
    await mount(834);
    expect(flat(lastDockBody()).paddingBottom).toBe(34);
  });
});

describe('toasts on a phone (T-65 §4)', () => {
  const stackBottom = () => flat(hosts(tree, 'toast-stack')[0]).paddingBottom;
  const toast = () => act(() => {
      addToast(ToastTone.success, 'Saved', '', 0);
    });

  it('on an inner page without a dock: 16 + the inset from the bottom edge', async () => {
    await mount();
    await act(async () => navRef.navigate(routes.PlanDetail, { planId: 7 }));
    toast();
    expect(stackBottom()).toBe(16 + 34);
  });

  it('on an inner page with a dock: above the dock, its height + 12', async () => {
    await mount();
    await act(async () => navRef.navigate(routes.PlanGenerator));
    const dock = hosts(tree, 'page-dock').slice(-1)[0];
    await act(async () => dock.props.onLayout({ nativeEvent: { layout: { height: 150 } } }));
    toast();
    expect(stackBottom()).toBe(150 + 12);
  });

  it('a blurred dock below the focused page does not count', async () => {
    await mount();
    await act(async () => navRef.navigate(routes.PlanDetail, { planId: 7 }));
    expect(usePhoneChromeStore.getState().pageDock).toBe(null);
  });

  it('main pages keep today\'s place above the tab bar (86 + 12 + the inset)', async () => {
    await mount();
    act(() => usePhoneChromeStore.setState({ pageDock: null }));
    toast();
    expect(stackBottom()).toBe(86 + 12 + 34);
  });

  it('toastPlacement: the rule as numbers', () => {
    const insets = { bottom: 34, left: 0, right: 0 };
    expect(toastPlacement({ width: 390, insets }).bottom).toBe(86 + 12 + 34);
    expect(toastPlacement({ width: 390, insets, tabBar: false }).bottom).toBe(16 + 34);
    expect(toastPlacement({ width: 390, insets, tabBar: false, dockHeight: 140 }).bottom).toBe(140 + 12);
    expect(toastPlacement({ width: 834, insets, tabBar: false, dockHeight: 140 }).bottom).toBe(24 + 34);
  });
});

// §4 + D365: every inner screen of the route table docks at the bottom edge
// (12 + the inset), the trainer Create plan included; the nine main pages keep
// the dock above the bar. An explicit overTabBar (the session dock) still wins.
describe('PinnedDock follows its screen\'s route (T-65 §4, D365)', () => {
  function dockPad(name, props = {}) {
    let rendered;
    act(() => {
      rendered = create(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: INSETS }}>
          <NavigationRouteContext.Provider value={{ key: name, name, params: SAMPLE_PARAMS }}>
            <PinnedDock testID="route-dock" {...props}>
              <Text>Buttons</Text>
            </PinnedDock>
          </NavigationRouteContext.Provider>
        </SafeAreaProvider>,
      );
    });
    return flat(hosts(rendered, 'route-dock-body')[0]).paddingBottom;
  }

  it.each(SHELL_SCREENS.filter((name) => !showsPhoneTabBar(getScreenPath(name, SAMPLE_PARAMS))))('%s: 12 + the inset', (name) => {
    expect(dockPad(name)).toBe(12 + 34);
  });

  it('trainer Create plan (D365): at the bottom edge, as its board draws', () => {
    expect(dockPad(routes.TrainerPlanCreate)).toBe(12 + 34);
  });

  it.each(SHELL_SCREENS.filter((name) => showsPhoneTabBar(getScreenPath(name, SAMPLE_PARAMS))))('%s (main page): above the bar, 86 + 12 + the inset', (name) => {
    expect(dockPad(name)).toBe(86 + 12 + 34);
  });

  it('an explicit overTabBar={false} + bottomGap (the session dock) keeps its own gap', () => {
    expect(dockPad(routes.Workout, { overTabBar: false, bottomGap: 28 })).toBe(28 + 34);
  });
});
