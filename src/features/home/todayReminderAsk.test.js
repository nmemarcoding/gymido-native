import { act, create } from 'react-test-renderer';

import { useAuthStore } from '../auth/authStore';
import { resetProfileStore, setStoredProfile } from '../profile/profileStore';
import { askReminderPermissionOnTrainingDay } from '../reminders/reminderSignals';
import { getDashboard } from './api/homeApi';
import HomeScreen from './HomeScreen';

jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), openPlanDetailAlone: jest.fn() }));
jest.mock('./api/homeApi', () => ({ getDashboard: jest.fn(), logWeight: jest.fn(), getCurrentWeek: jest.fn(() => Promise.resolve(null)) }));
jest.mock('../plans/api/libraryApi', () => ({ getCurrentPlan: jest.fn(() => Promise.resolve(null)), listPlanDays: jest.fn() }));
jest.mock('../workout/api/workoutApi', () => ({ getCurrentWorkout: jest.fn(() => Promise.resolve(null)) }));
jest.mock('../planGenerator/api/generatorApi', () => ({ getGeneratorProfile: jest.fn(() => Promise.resolve({ available: true })) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ addListener: () => () => {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../workout/runtime/workoutSessionStore', () => ({ verifySessionState: jest.fn(() => Promise.resolve()) }));
jest.mock('../reminders/reminderSignals', () => ({ askReminderPermissionOnTrainingDay: jest.fn(() => Promise.resolve()) }));

const flush = () => act(() => new Promise((resolve) => setImmediate(resolve)));
const STATS = { completed_workouts_total: 0, completed_workouts_this_week: 0, planned_workouts_this_week: 3 };
const PLAN = { current_plan: { enrollment: { plan: { id: 4, name: 'Upper / Lower' } } }, quick_stats: STATS, recent_workouts: [] };

const mounted = [];
async function render(dashboard, route) {
  if (dashboard instanceof Error) {
    getDashboard.mockRejectedValue(dashboard);
  } else {
    getDashboard.mockResolvedValue(dashboard);
  }
  let tree;
  await act(async () => {
    tree = create(<HomeScreen route={route} />);
  });
  await flush();
  mounted.push(tree);
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetProfileStore();
  setStoredProfile({ first_name: 'Nima', last_name: 'Memar' });
  useAuthStore.setState({ user: { email: 'nima@example.com', roles: [] } });
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

// T-103 (UX ruling §4, owner 29 Oct 2026; amends T-50): the OS prompt once
// Today has loaded a training day (the asked-once rule lives in the call).
describe('T-103 Today permission moment', () => {
  test('a training day asks once, after the page loaded', async () => {
    const pending = new Promise(() => {});
    getDashboard.mockReturnValue(pending);
    let tree;
    await act(async () => {
      tree = create(<HomeScreen />);
    });
    expect(askReminderPermissionOnTrainingDay).not.toHaveBeenCalled();
    act(() => tree.unmount());

    await render({ ...PLAN, today_status: { is_workout_day: true, already_completed: false, plan_day: { title: 'Push' } } });
    expect(askReminderPermissionOnTrainingDay).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['a rest day', { ...PLAN, today_status: { is_workout_day: false } }],
    ['no plan', { current_plan: null, quick_stats: STATS, recent_workouts: [] }],
  ])('%s never asks', async (_name, dashboard) => {
    await render(dashboard);
    expect(askReminderPermissionOnTrainingDay).not.toHaveBeenCalled();
  });

  test('a failed load never asks', async () => {
    await render(new Error('500'));
    expect(askReminderPermissionOnTrainingDay).not.toHaveBeenCalled();
  });
});

// T-53 (onboarding ruling D): from "Pick your days" (Save) Today opens with
// the "Training days saved." toast; the prompt waits ~400 ms for its entrance.
describe('T-53 after Pick your days', () => {
  const TRAINING = { ...PLAN, today_status: { is_workout_day: true, already_completed: false, plan_day: { title: 'Push' } } };

  test('asks once the toast has come in, not stacked on it', async () => {
    jest.useFakeTimers();
    try {
      getDashboard.mockResolvedValue(TRAINING);
      let tree;
      await act(async () => {
        tree = create(<HomeScreen route={{ params: { askAfterToast: true } }} />);
      });
      mounted.push(tree);
      expect(askReminderPermissionOnTrainingDay).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(399);
      });
      expect(askReminderPermissionOnTrainingDay).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(askReminderPermissionOnTrainingDay).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('without the flag it asks at once (unchanged)', async () => {
    await render(TRAINING, { params: {} });
    expect(askReminderPermissionOnTrainingDay).toHaveBeenCalledTimes(1);
  });
});
