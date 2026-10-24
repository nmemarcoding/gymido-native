import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { routes } from '../../navigation/routes';
import ExerciseDetailScreen from '../exercises/screens/ExerciseDetailScreen';
import ExercisesScreen from '../exercises/screens/ExercisesScreen';
import MyPlanCreateScreen from '../myPlans/MyPlanCreateScreen';
import MyPlanScreen from '../myPlans/MyPlanScreen';
import MyPlansScreen from '../myPlans/MyPlansScreen';
import TrainerHubScreen from '../myTrainer/TrainerHubScreen';
import { unmountBell } from '../notifications/bellPolling';
import NotificationsScreen from '../notifications/NotificationsScreen';
import HomeScreen from '../home/HomeScreen';
import PlanDetailScreen from '../plans/screens/PlanDetailScreen';
import PlanGeneratorPreviewScreen from '../planGenerator/screens/PlanGeneratorPreviewScreen';
import PlanGeneratorScreen from '../planGenerator/screens/PlanGeneratorScreen';
import PlansLibraryScreen from '../plans/screens/PlansLibraryScreen';
import EditProfileScreen from '../profile/screens/EditProfileScreen';
import ProfileSettingsScreen from '../profile/screens/ProfileSettingsScreen';
import ProgressScreen from '../progress/ProgressScreen';
import WorkoutScreen from '../workout/screens/WorkoutScreen';
import TrainerDashboardScreen from '../trainer/TrainerDashboardScreen';
import CreatePlanScreen from '../trainer/plans/screens/CreatePlanScreen';
import PlanScreen from '../trainer/plans/screens/PlanScreen';
import ClientDetailScreen from '../trainer/clients/screens/ClientDetailScreen';
import ClientsListScreen from '../trainer/clients/screens/ClientsListScreen';
import PlansListScreen from '../trainer/plans/screens/PlansListScreen';
import TrainerProfileScreen from '../trainer/profile/screens/TrainerProfileScreen';
import TrainerApplyScreen from '../trainers/screens/TrainerApplyScreen';
import TrainerDetailScreen from '../trainers/screens/TrainerDetailScreen';
import TrainersScreen from '../trainers/screens/TrainersScreen';
import ShellOverlay from './ShellOverlay';
import { ShellTab, TAB_ROOTS } from './shellNavigation';
import { closePanel } from './shellUiStore';

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Screens whose specs haven't been built yet render a shell placeholder.
const SCREENS = {
  [routes.Home]: HomeScreen,
  [routes.Workout]: WorkoutScreen,
  [routes.Exercises]: ExercisesScreen,
  [routes.PlansLibrary]: PlansLibraryScreen,
  [routes.PlanDetail]: PlanDetailScreen,
  [routes.MyPlans]: MyPlansScreen,
  [routes.MyPlanCreate]: MyPlanCreateScreen,
  [routes.MyPlan]: MyPlanScreen,
  [routes.PlanGenerator]: PlanGeneratorScreen,
  [routes.PlanGeneratorPreview]: PlanGeneratorPreviewScreen,
  [routes.ExerciseDetail]: ExerciseDetailScreen,
  [routes.Progress]: ProgressScreen,
  [routes.MyTrainer]: TrainerHubScreen,
  [routes.Trainers]: TrainersScreen,
  [routes.TrainerDetail]: TrainerDetailScreen,
  [routes.TrainerApply]: TrainerApplyScreen,
  [routes.Settings]: ProfileSettingsScreen,
  [routes.EditProfile]: EditProfileScreen,
  [routes.Notifications]: NotificationsScreen,
  [routes.TrainerDashboard]: TrainerDashboardScreen,
  [routes.TrainerClients]: ClientsListScreen,
  [routes.TrainerClient]: ClientDetailScreen,
  [routes.TrainerPlans]: PlansListScreen,
  [routes.TrainerPlanCreate]: CreatePlanScreen,
  [routes.TrainerPlan]: PlanScreen,
  [routes.TrainerProfile]: TrainerProfileScreen,
};

// Extra screens stacked above a tab's root (5-tab nav, 23 Oct): Workout only
// in the Today stack, the trainer hub only in the Profile stack.
const STACK_EXTRAS = {
  [ShellTab.Today]: [routes.Workout],
  [ShellTab.Plans]: [
    routes.PlanDetail,
    routes.ExerciseDetail,
    routes.MyPlans,
    routes.MyPlanCreate,
    routes.MyPlan,
    routes.PlanGenerator,
    routes.PlanGeneratorPreview,
  ],
  [ShellTab.Profile]: [routes.EditProfile, routes.MyTrainer, routes.Trainers, routes.TrainerDetail, routes.TrainerApply],
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
