import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  ExercisesScreen,
  HomeScreen,
  ProgressScreen,
  SettingsTabScreen,
  TrainerClientsScreen,
  TrainerDashboardScreen,
  TrainerHubScreen,
  TrainerPlansScreen,
  TrainerProfileScreen,
} from '../features/placeholders/ComingSoonScreens';
import PlanDetailScreen from '../features/plans/screens/PlanDetailScreen';
import PlansListScreen from '../features/plans/screens/PlansListScreen';
import WorkoutScreen from '../features/workout/WorkoutScreen';
import { useResolvedMode } from '../features/workspace/useWorkspaceMode';
import { Workspace } from '../features/workspace/workspace';
import { routes } from './routes';
import GymTabBar from './shell/GymTabBar';

const Tab = createBottomTabNavigator();
const LibraryStack = createNativeStackNavigator();

// Library tab = stack PlansList → PlanDetail{planId: string} (RN-SPEC-plans §9).
function LibraryStackScreen() {
  return (
    <LibraryStack.Navigator screenOptions={{ headerShown: false }}>
      <LibraryStack.Screen name={routes.PlansList} component={PlansListScreen} />
      <LibraryStack.Screen name={routes.PlanDetail} component={PlanDetailScreen} />
    </LibraryStack.Navigator>
  );
}

// AppShell (RN-SPEC-app-shell §3.4): one bottom-tabs navigator holding every
// shell screen (Home hidden, member and Trainer-mode tabs), with the custom
// tab bar choosing the visible set from the current path. backBehavior
// "history" mirrors browser back. [O1] no admin screens.
// Landing (§3.3) replaces "/" with /trainer in Trainer mode. On sign-in the
// shell mounts fresh, and a navigate from Home's focus effect during that
// first mount is overwritten by the navigator's initial state, leaving a blank
// Home. So the initial route applies the rule itself; Home keeps its redirect
// for later visits to "/".
export default function AppShell() {
  const { mode } = useResolvedMode('/');
  return (
    <Tab.Navigator
      initialRouteName={mode === Workspace.trainer ? routes.TrainerDashboardTab : routes.HomeTab}
      backBehavior="history"
      tabBar={(props) => <GymTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name={routes.HomeTab} component={HomeScreen} />
      <Tab.Screen name={routes.WorkoutTab} component={WorkoutScreen} />
      <Tab.Screen name={routes.ExercisesTab} component={ExercisesScreen} />
      <Tab.Screen name={routes.LibraryTab} component={LibraryStackScreen} />
      <Tab.Screen name={routes.ProgressTab} component={ProgressScreen} />
      <Tab.Screen name={routes.TrainerTab} component={TrainerHubScreen} />
      <Tab.Screen name={routes.SettingsTab} component={SettingsTabScreen} />
      <Tab.Screen name={routes.TrainerDashboardTab} component={TrainerDashboardScreen} />
      <Tab.Screen name={routes.TrainerClientsTab} component={TrainerClientsScreen} />
      <Tab.Screen name={routes.TrainerPlansTab} component={TrainerPlansScreen} />
      <Tab.Screen name={routes.TrainerProfileTab} component={TrainerProfileScreen} />
    </Tab.Navigator>
  );
}
