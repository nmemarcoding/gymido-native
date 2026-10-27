import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Keyboard, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create } from 'react-test-renderer';

import { REMOUNT_DELAY_MS, seedState, useFontScaleRemount } from './useFontScaleRemount';

// A live window: every subscriber re-renders on a change (as RN's Dimensions events).
const mockWindow = { value: { width: 390, height: 844, scale: 3, fontScale: 1 }, listeners: new Set() };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => {
  const { useSyncExternalStore } = require('react');
  return {
    __esModule: true,
    default: () =>
      // eslint-disable-next-line react-hooks/rules-of-hooks -- this mock IS the useWindowDimensions hook
      useSyncExternalStore(
        (listener) => {
          mockWindow.listeners.add(listener);
          return () => mockWindow.listeners.delete(listener);
        },
        () => mockWindow.value
      ),
  };
});

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
let navRef;
let tree;
const mockMounts = [];

function setFontScale(fontScale) {
  mockWindow.value = { ...mockWindow.value, fontScale };
  mockWindow.listeners.forEach((listener) => listener());
}

// QA T59-CRASH fix: the remount runs REMOUNT_DELAY_MS after the change (once
// RN has applied the new font multiplier to the surface), so a change is
// the event plus that wait (DECLARED: the remount used to be immediate).
const waitRemount = () => act(() => new Promise((resolve) => setTimeout(resolve, REMOUNT_DELAY_MS + 30)));
async function changeFontScale(fontScale) {
  await act(async () => {
    setFontScale(fontScale);
  });
  await waitRemount();
}

function screen(name) {
  return function Screen() {
    useEffect(() => {
      mockMounts.push(name);
    }, []);
    return <Text>{name}</Text>;
  };
}
const Home = screen('Home');
const Plans = screen('Plans');
const PlanDetail = screen('PlanDetail');

function PlansStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Plans" component={Plans} />
      <Stack.Screen name="PlanDetail" component={PlanDetail} />
    </Stack.Navigator>
  );
}

function Shell() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Today" component={Home} />
      <Tabs.Screen name="PlansTab" component={PlansStack} />
    </Tabs.Navigator>
  );
}

// The same wiring as App.js: the key and the seed state go on the container,
// and (as RootNavigator) the shell screen carries the landing link in its
// initialParams, which React Navigation merges back in on rehydration.
function App({ os }) {
  const navigation = useFontScaleRemount(navRef, os);
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets }}>
      <NavigationContainer key={navigation.key} ref={navRef} initialState={navigation.initialState}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="AppShell" component={Shell} initialParams={{ screen: 'Today' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

async function mountOnPlanDetail(os) {
  await act(async () => {
    tree = create(<App os={os} />);
  });
  // The list first, so the Plans stack holds [Plans, PlanDetail].
  await act(async () => {
    navRef.navigate('PlansTab');
  });
  await act(async () => {
    navRef.navigate('PlansTab', { screen: 'PlanDetail', params: { planId: 7 } });
  });
  expect(navRef.getCurrentRoute()).toMatchObject({ name: 'PlanDetail', params: { planId: 7 } });
}

const detailMounts = () => mockMounts.filter((name) => name === 'PlanDetail').length;

beforeEach(() => {
  navRef = createNavigationContainerRef();
  mockMounts.length = 0;
  mockWindow.value = { width: 390, height: 844, scale: 3, fontScale: 1 };
});

afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
});

describe('T-59 (QA BUG-N3): a live Android font-size change re-lays out every mounted view and keeps the screen', () => {
  it('Android: 1.0 → 2.0 remounts the open screen at the new scale and stays on it, params and back stack included', async () => {
    await mountOnPlanDetail('android');
    expect(detailMounts()).toBe(1);

    await changeFontScale(2);

    // A fresh mount is a fresh layout: no text keeps its 1.0 box.
    expect(detailMounts()).toBe(2);
    expect(navRef.getCurrentRoute()).toMatchObject({ name: 'PlanDetail', params: { planId: 7 } });
    // Back still goes to the Plans list, not out of the tab.
    await act(async () => {
      navRef.goBack();
    });
    expect(navRef.getCurrentRoute().name).toBe('Plans');
  });

  it('Android: every further change remounts again (2.0 → 1.3 → 1.0), always on the same screen', async () => {
    await mountOnPlanDetail('android');
    for (const scale of [2, 1.3, 1]) {
      await changeFontScale(scale);
      expect(navRef.getCurrentRoute().name).toBe('PlanDetail');
    }
    expect(detailMounts()).toBe(4);
  });

  it('Android: a window change that keeps the font scale (rotation) does not remount', async () => {
    await mountOnPlanDetail('android');
    await act(async () => {
      mockWindow.value = { ...mockWindow.value, width: 844, height: 390 };
      mockWindow.listeners.forEach((listener) => listener());
    });
    expect(detailMounts()).toBe(1);
  });

  it('iOS keeps the mounted tree (T-59 is the Android path)', async () => {
    await mountOnPlanDetail('ios');
    await changeFontScale(2);
    expect(detailMounts()).toBe(1);
    expect(navRef.getCurrentRoute().name).toBe('PlanDetail');
  });

  it('the seed drops the nested-navigation params of mounted navigators, so a landing or cross-tab link is not replayed', () => {
    const seed = seedState({
      index: 0,
      routes: [
        {
          name: 'AppShell',
          params: { screen: 'PlansTab', params: { screen: 'PlanDetail', params: { planId: 7 } } },
          state: {
            index: 1,
            routes: [
              { name: 'Today' },
              { name: 'PlansTab', params: { screen: 'PlanDetail', initial: false }, state: { index: 1, routes: [{ name: 'Plans' }, { name: 'PlanDetail', params: { planId: 7 } }] } },
              // A tab never opened keeps its pending link for its first visit.
              { name: 'ExercisesTab', params: { screen: 'ExerciseDetail', params: { exerciseId: 3 } } },
            ],
          },
        },
      ],
    });
    const shell = seed.routes[0];
    // Set to undefined, not deleted, so a screen's initialParams can't refill them.
    ['screen', 'params', 'initial'].forEach((key) => {
      expect(shell.params).toHaveProperty(key, undefined);
      expect(shell.state.routes[1].params).toHaveProperty(key, undefined);
    });
    expect(shell.state.routes[1].state.routes[1].params).toEqual({ planId: 7 });
    expect(shell.state.routes[2].params).toEqual({ screen: 'ExerciseDetail', params: { exerciseId: 3 } });
  });

  // QA T59-CRASH (ad2ba83): a live change right after typing a set weight
  // crashed Fabric ("Unable to find viewState for tag") — the remount tore
  // down a focused input mid-update, before RN had re-applied the font
  // multiplier. Now: blur + dismiss the keyboard first, remount after a delay.
  it('a focused input is blurred and the keyboard dismissed BEFORE the remount, which waits for the delay', async () => {
    await mountOnPlanDetail('android');
    const blur = jest.fn();
    const focused = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({ blur });
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    await act(async () => {
      setFontScale(2);
    });
    expect(blur).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(detailMounts()).toBe(1);
    await waitRemount();
    expect(detailMounts()).toBe(2);
    expect(navRef.getCurrentRoute().name).toBe('PlanDetail');
    focused.mockRestore();
    dismiss.mockRestore();
  });

  it('a change undone within the delay does not remount', async () => {
    await mountOnPlanDetail('android');
    await act(async () => {
      setFontScale(2);
    });
    await act(async () => {
      setFontScale(1);
    });
    await waitRemount();
    expect(detailMounts()).toBe(1);
  });

  it('a change before the container is ready remounts on its initial route', async () => {
    const seen = [];
    function Probe() {
      seen.push(useFontScaleRemount(navRef, 'android'));
      return null;
    }
    await act(async () => {
      tree = create(<Probe />);
    });
    await changeFontScale(2);
    expect(seen.at(-1).key).not.toBe(seen[0].key);
    expect(seen.at(-1).initialState).toBeUndefined();
  });
});
