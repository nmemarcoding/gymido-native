import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';

import PlanDetailScreen from '../features/plans/screens/PlanDetailScreen';
import PlansListScreen from '../features/plans/screens/PlansListScreen';
import SettingsScreen from '../features/settings/SettingsScreen';
import WorkoutScreen from '../features/workout/WorkoutScreen';
import { colors } from '../shared/theme/tokens';
import { routes } from './routes';
import GymTabBar from './shell/GymTabBar';
import { openLibraryRoot } from './shell/libraryNavigation';
import { LargeTitleHeader } from './shell/PageHeaders';
import PageLayout from './shell/PageLayout';

const Tab = createBottomTabNavigator();
const LibraryStack = createNativeStackNavigator();

// Library tab = stack PlansList → PlanDetail{planId: string} (RN-SPEC-plans §9).
// Custom in-content headers only; iOS edge-swipe and Android back pop the stack.
function LibraryStackScreen() {
  return (
    <LibraryStack.Navigator screenOptions={{ headerShown: false }}>
      <LibraryStack.Screen name={routes.PlansList} component={PlansListScreen} />
      <LibraryStack.Screen name={routes.PlanDetail} component={PlanDetailScreen} />
    </LibraryStack.Navigator>
  );
}

// STUB tabs until their specs arrive.
function tabPlaceholder(title) {
  return function TabPlaceholderScreen() {
    return (
      <PageLayout testID={`placeholder-${title}`}>
        <LargeTitleHeader title={title} />
        <Text style={styles.placeholder}>{`${title} page placeholder until its spec arrives.`}</Text>
      </PageLayout>
    );
  };
}

const ExercisesScreen = tabPlaceholder('Exercises');
const ProgressScreen = tabPlaceholder('Progress');
const TrainerScreen = tabPlaceholder('My trainer');

// Member app shell. backBehavior="history" mirrors browser back through the
// tab history. Admins get the same tabs (no admin UI on mobile, owner O1).
export default function MemberTabs() {
  return (
    <Tab.Navigator
      backBehavior="history"
      tabBar={(props) => <GymTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name={routes.WorkoutTab} component={WorkoutScreen} />
      <Tab.Screen name={routes.ExercisesTab} component={ExercisesScreen} />
      <Tab.Screen
        name={routes.LibraryTab}
        component={LibraryStackScreen}
        listeners={({ navigation }) => ({
          // Always lands on a single fresh S1, even when already on the tab.
          tabPress: (event) => {
            event.preventDefault();
            openLibraryRoot(navigation);
          },
        })}
      />
      <Tab.Screen name={routes.ProgressTab} component={ProgressScreen} />
      <Tab.Screen name={routes.TrainerTab} component={TrainerScreen} />
      <Tab.Screen name={routes.SettingsTab} component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});
