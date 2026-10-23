import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { routes } from '../../navigation/routes';
import ExerciseDetailScreen from '../exercises/screens/ExerciseDetailScreen';
import { unmountBell } from '../notifications/bellPolling';
import HomeScreen from '../home/HomeScreen';
import PlanDetailScreen from '../plans/screens/PlanDetailScreen';
import PlansLibraryScreen from '../plans/screens/PlansLibraryScreen';
import SettingsScreen from '../settings/SettingsScreen';
import TrainerDashboardScreen from '../trainer/TrainerDashboardScreen';
import CreatePlanScreen from '../trainer/plans/screens/CreatePlanScreen';
import PlanScreen from '../trainer/plans/screens/PlanScreen';
import ClientDetailScreen from '../trainer/clients/screens/ClientDetailScreen';
import ClientsListScreen from '../trainer/clients/screens/ClientsListScreen';
import PlansListScreen from '../trainer/plans/screens/PlansListScreen';
import ShellOverlay from './ShellOverlay';
import { ShellTab, TAB_ROOTS } from './shellNavigation';
import { closePanel } from './shellUiStore';
import { makeShellPlaceholder } from './ShellPlaceholderScreen';

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Screens whose specs haven't been built yet render a shell placeholder.
const SCREENS = {
  [routes.Home]: HomeScreen,
  [routes.Workout]: makeShellPlaceholder('Workout'),
  [routes.Exercises]: makeShellPlaceholder('Exercises'),
  [routes.PlansLibrary]: PlansLibraryScreen,
  [routes.PlanDetail]: PlanDetailScreen,
  [routes.ExerciseDetail]: ExerciseDetailScreen,
  [routes.Progress]: makeShellPlaceholder('Progress'),
  [routes.MyTrainer]: makeShellPlaceholder('Trainer'),
  [routes.Settings]: SettingsScreen,
  [routes.Notifications]: makeShellPlaceholder('Notifications'),
  [routes.TrainerDashboard]: TrainerDashboardScreen,
  [routes.TrainerClients]: ClientsListScreen,
  [routes.TrainerClient]: ClientDetailScreen,
  [routes.TrainerPlans]: PlansListScreen,
  [routes.TrainerPlanCreate]: CreatePlanScreen,
  [routes.TrainerPlan]: PlanScreen,
  [routes.TrainerProfile]: makeShellPlaceholder('Trainer profile'),
};

// Extra screens stacked above a tab's root (5-tab nav, 23 Oct): Workout only
// in the Today stack, the trainer hub only in the Profile stack.
const STACK_EXTRAS = {
  [ShellTab.Today]: [routes.Workout],
  [ShellTab.Plans]: [routes.PlanDetail, routes.ExerciseDetail],
  [ShellTab.Profile]: [routes.MyTrainer],
  [ShellTab.Exercises]: [routes.ExerciseDetail],
  [ShellTab.TClients]: [routes.TrainerClient],
  [ShellTab.TPlans]: [routes.TrainerPlanCreate, routes.TrainerPlan],
};

function makeTabStack(tab) {
  const screens = [TAB_ROOTS[tab], ...(STACK_EXTRAS[tab] ?? [])];
  function TabStack() {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {screens.map((name) => (
          <Stack.Screen key={name} name={name} component={SCREENS[name]} />
        ))}
      </Stack.Navigator>
    );
  }
  TabStack.displayName = `${tab}Stack`;
  return TabStack;
}

const TAB_STACKS = Object.fromEntries(Object.values(ShellTab).map((tab) => [tab, makeTabStack(tab)]));

// App-shell spec §3.4: bottom tabs with a custom tab bar, history back
// behaviour, and no navigator headers (each screen draws §6.1 itself).
export default function AppShell({ route }) {
  useEffect(
    () => () => {
      unmountBell();
      closePanel();
    },
    []
  );

  return (
    <Tabs.Navigator
      initialRouteName={route.params?.screen ?? ShellTab.Today}
      backBehavior="history"
      tabBar={(props) => <ShellOverlay {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {Object.values(ShellTab).map((tab) => (
        <Tabs.Screen key={tab} name={tab} component={TAB_STACKS[tab]} />
      ))}
    </Tabs.Navigator>
  );
}
