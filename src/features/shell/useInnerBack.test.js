import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { act, create } from 'react-test-renderer';

import { openShellPath } from './shellLinks';
import { backOrReplace, useInnerBack } from './useInnerBack';

// T-65 "phone bottom nav on main pages only" (PHONE-NAV spec §3 / §5, 27 Oct
// 2026): an inner page's one back control goes back in history when there is
// an in-app previous entry, else REPLACES this screen with the §3 parent (no
// entry that loops back). Android hardware / gesture back = the same.
jest.mock('./shellLinks', () => ({ openShellPath: jest.fn() }));

let handlers;
beforeEach(() => {
  handlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((name, handler) => {
    handlers.push(handler);
    return { remove: () => (handlers = handlers.filter((item) => item !== handler)) };
  });
  openShellPath.mockClear();
});
afterEach(() => jest.restoreAllMocks());

function nav({ history = true, routeNames = [], focused = true } = {}) {
  return {
    canGoBack: jest.fn(() => history),
    goBack: jest.fn(),
    replace: jest.fn(),
    isFocused: jest.fn(() => focused),
    getState: jest.fn(() => ({ routeNames })),
  };
}

let pressBack;
const keepPress = (press) => {
  pressBack = press;
};
function Probe({ navigation, path }) {
  const press = useInnerBack(navigation, path);
  useEffect(() => keepPress(press), [press]);
  return null;
}
function mount(navigation, path) {
  let tree;
  act(() => {
    tree = create(<Probe navigation={navigation} path={path} />);
  });
  return tree;
}

describe('backOrReplace (the pill tap)', () => {
  it('with an in-app previous entry: goes back, opens nothing', () => {
    const navigation = nav({ history: true, routeNames: ['PlansLibrary', 'PlanDetail'] });
    backOrReplace(navigation, '/plans');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(openShellPath).not.toHaveBeenCalled();
  });

  it('no history, the parent in this stack: REPLACES this screen with it (no push, no loop)', () => {
    const navigation = nav({ history: false, routeNames: ['PlansLibrary', 'PlanDetail', 'MyPlans'] });
    backOrReplace(navigation, '/plans');
    expect(navigation.replace).toHaveBeenCalledWith('PlansLibrary');
    expect(navigation.goBack).not.toHaveBeenCalled();
    backOrReplace(navigation, '/plans/mine');
    expect(navigation.replace).toHaveBeenLastCalledWith('MyPlans');
  });

  it('no history, the parent in another tab: opens it by its path (its tab root)', () => {
    const navigation = nav({ history: false, routeNames: ['Notifications'] });
    backOrReplace(navigation, '/trainer');
    expect(openShellPath).toHaveBeenCalledWith('/trainer');
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

describe('useInnerBack: the pill and Android back are the same', () => {
  it('returns the pill press (backOrReplace to the path)', () => {
    const navigation = nav({ history: false, routeNames: ['TrainerClients', 'TrainerClient'] });
    mount(navigation, '/trainer/clients');
    act(() => pressBack());
    expect(navigation.replace).toHaveBeenCalledWith('TrainerClients');
  });

  it('Android back with history: left to the default pop (= the pill\'s goBack)', () => {
    const navigation = nav({ history: true });
    mount(navigation, '/plans');
    expect(handlers).toHaveLength(1);
    expect(handlers[0]()).toBe(false);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('Android back with no history (where it would close the app): replaces to the parent, as the pill', () => {
    const navigation = nav({ history: false, routeNames: ['PlansLibrary', 'PlanDetail'] });
    mount(navigation, '/plans');
    expect(handlers[0]()).toBe(true);
    expect(navigation.replace).toHaveBeenCalledWith('PlansLibrary');
  });

  it('a blurred screen below the focused one leaves Android back alone', () => {
    const navigation = nav({ history: false, focused: false, routeNames: ['PlansLibrary'] });
    mount(navigation, '/plans');
    expect(handlers[0]()).toBe(false);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('no path (no back control): no Android handler; unmount removes it', () => {
    mount(nav(), null);
    expect(handlers).toHaveLength(0);
    const tree = mount(nav(), '/plans');
    expect(handlers).toHaveLength(1);
    act(() => tree.unmount());
    expect(handlers).toHaveLength(0);
  });
});

// T-65 parity (RN-SPEC-app-shell §6.3 dated 27 Oct; web reviewer MEDIUM): "in-app
// history" is decided ONLY by a real back-stack entry, navigation.canGoBack()
// at tap time. A real navigator, as a sequence.
describe('useInnerBack in a real stack (land directly → replace; then back never returns)', () => {
  const { NavigationContainer, createNavigationContainerRef, useNavigation } = jest.requireActual('@react-navigation/native');
  const { createNativeStackNavigator } = jest.requireActual('@react-navigation/native-stack');
  const { Text } = jest.requireActual('react-native');
  const Stack = createNativeStackNavigator();
  let tapPill;
  const keepTap = (press) => {
    tapPill = press;
  };
  function Inner() {
    const press = useInnerBack(useNavigation(), '/plans');
    useEffect(() => keepTap(press), [press]);
    return <Text>Plan detail</Text>;
  }
  const Parent = () => <Text>Plans</Text>;

  async function mountAt(initialRouteName) {
    const navRef = createNavigationContainerRef();
    let tree;
    await act(async () => {
      tree = create(
        <NavigationContainer ref={navRef}>
          <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="PlansLibrary" component={Parent} />
            <Stack.Screen name="PlanDetail" component={Inner} />
          </Stack.Navigator>
        </NavigationContainer>,
      );
    });
    return { navRef, tree };
  }
  const names = (navRef) => navRef.getRootState().routes.map((route) => route.name);

  it('landed on the inner page with no history: the pill REPLACES it with the parent; back then has nothing to return to', async () => {
    const { navRef, tree } = await mountAt('PlanDetail');
    expect(names(navRef)).toEqual(['PlanDetail']);
    expect(navRef.canGoBack()).toBe(false);
    await act(async () => tapPill());
    expect(names(navRef)).toEqual(['PlansLibrary']);
    expect(openShellPath).not.toHaveBeenCalled();
    // Android back / the parent's back: no entry left, so the replaced inner page never comes back.
    expect(navRef.canGoBack()).toBe(false);
    await act(async () => navRef.goBack());
    expect(names(navRef)).toEqual(['PlansLibrary']);
    act(() => tree.unmount());
  });

  it('with history (pushed from the parent): the pill does goBack()', async () => {
    const { navRef, tree } = await mountAt('PlansLibrary');
    await act(async () => navRef.navigate('PlanDetail'));
    expect(names(navRef)).toEqual(['PlansLibrary', 'PlanDetail']);
    await act(async () => tapPill());
    expect(names(navRef)).toEqual(['PlansLibrary']);
    act(() => tree.unmount());
  });

  it('Android back on the directly landed page does the same replace (the pill\'s handler)', async () => {
    const { navRef, tree } = await mountAt('PlanDetail');
    // As React Native does: newest handler first (the container's own), until one returns true.
    let handled = false;
    await act(async () => {
      handled = [...handlers].reverse().some((handler) => handler());
    });
    expect(handled).toBe(true);
    expect(names(navRef)).toEqual(['PlansLibrary']);
    act(() => tree.unmount());
  });
});
