import { APP_SHELL_SCREENS } from './AppShell';
import { SHELL_SCREENS } from './shellNavigation';

// The screens are stubbed: this checks the route names only.
jest.mock('../exercises/screens/ExerciseDetailScreen', () => () => null);
jest.mock('../exercises/screens/ExercisesScreen', () => () => null);
jest.mock('../myPlans/MyPlanCreateScreen', () => () => null);
jest.mock('../myPlans/MyPlanScreen', () => () => null);
jest.mock('../myPlans/MyPlansScreen', () => () => null);
jest.mock('../myTrainer/TrainerHubScreen', () => () => null);
jest.mock('../notifications/NotificationsScreen', () => () => null);
jest.mock('../home/HomeScreen', () => () => null);
jest.mock('../plans/screens/PlanDetailScreen', () => () => null);
jest.mock('../planGenerator/screens/PlanGeneratorPreviewScreen', () => () => null);
jest.mock('../planGenerator/screens/PlanGeneratorScreen', () => () => null);
jest.mock('../plans/screens/PlansLibraryScreen', () => () => null);
jest.mock('../profile/screens/EditProfileScreen', () => () => null);
jest.mock('../profile/screens/ProfileSettingsScreen', () => () => null);
jest.mock('../progress/ProgressScreen', () => () => null);
jest.mock('../workout/screens/WorkoutScreen', () => () => null);
jest.mock('../trainer/TrainerDashboardScreen', () => () => null);
jest.mock('../trainer/plans/screens/CreatePlanScreen', () => () => null);
jest.mock('../trainer/plans/screens/PlanScreen', () => () => null);
jest.mock('../trainer/clients/screens/ClientDetailScreen', () => () => null);
jest.mock('../trainer/clients/screens/ClientsListScreen', () => () => null);
jest.mock('../trainer/plans/screens/PlansListScreen', () => () => null);
jest.mock('../trainer/profile/screens/TrainerProfileScreen', () => () => null);
jest.mock('../trainers/screens/TrainerApplyScreen', () => () => null);
jest.mock('../trainers/screens/TrainerDetailScreen', () => () => null);
jest.mock('../trainers/screens/TrainersScreen', () => () => null);
jest.mock('./ShellOverlay', () => () => null);
jest.mock('@react-navigation/bottom-tabs', () => ({ createBottomTabNavigator: () => ({ Navigator: () => null, Screen: () => null }) }));
jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: () => ({ Navigator: () => null, Screen: () => null }) }));
jest.mock('../notifications/bellPolling', () => ({ unmountBell: jest.fn() }));
jest.mock('./shellUiStore', () => ({ closePanel: jest.fn() }));

// Reviewer carry (native-t65-5f53f3d): AppShell's SCREENS (name → component)
// and shellNavigation's SCREENS (name → [tab, path]) are two hand-kept maps.
// They must name the same screens, so the route walk over SHELL_SCREENS stays
// complete and every registered screen has a tab and a path.
describe('AppShell SCREENS ↔ shellNavigation SCREENS', () => {
  it('the two maps have exactly the same key set (no duplicates)', () => {
    expect([...APP_SHELL_SCREENS].sort()).toEqual([...SHELL_SCREENS].sort());
    expect(new Set(APP_SHELL_SCREENS).size).toBe(APP_SHELL_SCREENS.length);
    expect(APP_SHELL_SCREENS.length).toBe(26);
  });
});
