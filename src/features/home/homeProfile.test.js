jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), openPlanDetailAlone: jest.fn() }));
jest.mock('./api/homeApi', () => ({ getDashboard: jest.fn(), logWeight: jest.fn(), getCurrentWeek: jest.fn(() => Promise.resolve(null)) }));
jest.mock('../plans/api/libraryApi', () => ({ getCurrentPlan: jest.fn(() => Promise.resolve(null)), listPlanDays: jest.fn() }));
jest.mock('../workout/api/workoutApi', () => ({ getCurrentWorkout: jest.fn(() => Promise.resolve(null)) }));
jest.mock('../profile/api/profileApi', () => ({ getProfile: jest.fn() }));
jest.mock('../planGenerator/api/generatorApi', () => ({ getGeneratorProfile: jest.fn(() => Promise.resolve({ available: false })) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ addListener: () => () => {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

import { act, create } from 'react-test-renderer';

import { useAuthStore } from '../auth/authStore';
import { getProfile } from '../profile/api/profileApi';
import { resetProfileStore, setCreatedProfile, useProfileStore } from '../profile/profileStore';
import { getDashboard } from './api/homeApi';
import HomeScreen from './HomeScreen';

const flush = () => act(() => new Promise((resolve) => setImmediate(resolve)));
const texts = (root) => root.findAll((node) => typeof node.children?.[0] === 'string').map((node) => node.children.join(''));

// T-24 follow-up (reviewer F1, 25 Oct 2026): first-time create → Home has the profile, with no request.
it('stores the created profile, so Home greets by name and labels the weight card with its units', async () => {
  resetProfileStore();
  useAuthStore.setState({ profileMissing: true });
  const created = { first_name: 'Sam', current_weight_value: 170, current_weight_unit: 'lb', goal_weight_value: 75, goal_weight_unit: 'kg' };
  setCreatedProfile(created);
  expect(useAuthStore.getState().profileMissing).toBe(false);
  expect(useProfileStore.getState().profile).toEqual(created);

  getDashboard.mockResolvedValue({ current_weight: 170, goal_progress: { goal_weight: 75, difference_to_goal: 2.1 } });
  let tree;
  await act(async () => {
    tree = create(<HomeScreen />);
  });
  await flush();
  const shown = texts(tree.root);
  expect(shown).toEqual(expect.arrayContaining(['Welcome back, Sam', '170 lb', '75 kg', '\u22122.1 kg']));
  expect(getProfile).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
