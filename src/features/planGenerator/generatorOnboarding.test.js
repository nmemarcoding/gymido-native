import { act, create } from 'react-test-renderer';

import { acceptGeneratedPlan, getGeneratorProfile, previewGeneratedPlan, saveGeneratorProfile } from './api/generatorApi';
import PlanGeneratorPreviewScreen from './screens/PlanGeneratorPreviewScreen';
import PlanGeneratorScreen from './screens/PlanGeneratorScreen';

// T-53 (onboarding ruling §1, 29 Oct 2026): the generator is unchanged
// except for the onboarding entry (`from: 'onboarding'`, from the bridge's
// "Build my plan"): step 1's Cancel and Android back REPLACE to Today, the
// preview keeps the flag, and Accept replaces to "Pick your days" (D).
// Outside onboarding Accept still hands off to Workout.

const mockNavigation = { push: jest.fn(), replace: jest.fn(), goBack: jest.fn(), reset: jest.fn(), canGoBack: jest.fn(() => true), addListener: jest.fn(() => () => {}) };
let mockParams = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'PlanGenerator-1', name: 'PlanGenerator', params: mockParams }),
  CommonActions: { reset: jest.fn() },
}));
jest.mock('../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), handOffToWorkout: jest.fn(), openOnboardingDays: jest.fn() }));
jest.mock('./generatorRoutes', () => ({
  generatorRoutes: { PlanGenerator: 'PlanGenerator', PlanGeneratorPreview: 'PlanGeneratorPreview' },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/components/BlurLayer', () => () => null);
jest.mock('../../shared/components/ConfirmDialog', () => () => null);
jest.mock('../../shared/components/Select', () => () => null);
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'), addToast: jest.fn() }));
jest.mock('./api/generatorApi', () => ({
  getGeneratorProfile: jest.fn(),
  saveGeneratorProfile: jest.fn(),
  previewGeneratedPlan: jest.fn(),
  acceptGeneratedPlan: jest.fn(),
  searchExercises: jest.fn(() => Promise.resolve([])),
}));

const ReactNative = require('react-native');
const { handOffToWorkout, openOnboardingDays, openShellPath } = require('../shell/shellLinks');

const OPTIONS = {
  goals: ['BUILD_MUSCLE'],
  experience_bands: ['2_PLUS_YEARS'],
  days_per_week: [3, 4],
  session_minutes: [45, 60],
  presets: [{ code: 'FULL_GYM', enabled: true, equipment: [{ id: 3 }] }],
  equipment: [{ id: 3, name: 'Barbell' }],
  focus_muscles: [{ id: 21, name: 'Chest' }],
  max_focus_muscles: 2,
  exclusion_reasons: ['DISLIKE', 'DISCOMFORT'],
  go_easy_areas: [],
  go_easy_notice: '',
};
const PROFILE = {
  goal: 'BUILD_MUSCLE',
  experience_band: '2_PLUS_YEARS',
  days_per_week: 4,
  session_minutes: 60,
  equipment_preset: 'FULL_GYM',
  equipment: [{ id: 3, name: 'Barbell' }],
  focus_muscles: [],
  preferred_split: null,
  exclusions: [],
  go_easy_area_ids: [],
};
const FEASIBLE = {
  feasible: true,
  preview_hash: 'abc',
  plan_name: 'Build Muscle · 4 Days',
  split: { code: 'UL', name: 'Upper / Lower' },
  split_options: [{ code: 'UL', name: 'Upper / Lower' }],
  notes: [],
  warnings: [],
  active_enrollment: null,
  days: [{ day_number: 1, title: 'Upper A', estimated_minutes: 55, exercises: [], skipped: [] }],
  weekly_volume: [],
};
const ACCEPTED = { plan_id: 9, generation_id: 3, cancelled_enrollment_id: null, enrollment: { id: 41, workout_plan_id: 9, plan: { name: 'Build Muscle · 4 Days' } } };

const one = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const mounted = [];
async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}

let backHandlers;
let backSpy;
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  backHandlers = [];
  backSpy = jest.spyOn(ReactNative.BackHandler, 'addEventListener').mockImplementation((name, handler) => {
    backHandlers.push(handler);
    return { remove: () => (backHandlers = backHandlers.filter((item) => item !== handler)) };
  });
  getGeneratorProfile.mockResolvedValue({ available: true, profile: PROFILE, options: OPTIONS });
});
afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  backSpy.mockRestore();
});

describe('T-53 the generator entered from onboarding', () => {
  it('step 1 Cancel replaces to Today: the Plans stack reset to Plans alone, then Today', async () => {
    mockParams = { from: 'onboarding' };
    const tree = await render(<PlanGeneratorScreen />);
    await act(async () => one(tree, 'generator-cancel').props.onPress());
    expect(mockNavigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PlansLibrary' }] });
    expect(openShellPath).toHaveBeenCalledWith('/');
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('Android back leaves the same way (handled)', async () => {
    mockParams = { from: 'onboarding' };
    await render(<PlanGeneratorScreen />);
    let handled;
    act(() => {
      handled = backHandlers[backHandlers.length - 1]();
    });
    expect(handled).toBe(true);
    expect(openShellPath).toHaveBeenCalledWith('/');
  });

  it('outside onboarding Cancel is unchanged (back in history)', async () => {
    const tree = await render(<PlanGeneratorScreen />);
    await act(async () => one(tree, 'generator-cancel').props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(openShellPath).not.toHaveBeenCalled();
  });

  it('the review\'s save pushes the preview with the onboarding flag; without it, no params', async () => {
    saveGeneratorProfile.mockResolvedValue({});
    mockParams = { from: 'onboarding', step: 5 };
    const onboarding = await render(<PlanGeneratorScreen />);
    await act(async () => one(onboarding, 'generator-next').props.onPress());
    await act(async () => one(onboarding, 'generator-see-plan').props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlanGeneratorPreview', { from: 'onboarding' });

    mockNavigation.push.mockClear();
    mockParams = { step: 5 };
    const plain = await render(<PlanGeneratorScreen />);
    await act(async () => one(plain, 'generator-next').props.onPress());
    await act(async () => one(plain, 'generator-see-plan').props.onPress());
    expect(mockNavigation.push.mock.calls).toEqual([['PlanGeneratorPreview']]);
  });

  it('Accept replaces to "Pick your days" with the new enrolment (no Workout hand-off)', async () => {
    previewGeneratedPlan.mockResolvedValue(FEASIBLE);
    acceptGeneratedPlan.mockResolvedValue(ACCEPTED);
    mockParams = { from: 'onboarding' };
    const tree = await render(<PlanGeneratorPreviewScreen />);
    await act(async () => one(tree, 'generator-start').props.onPress());
    expect(openOnboardingDays).toHaveBeenCalledWith({ enrollmentId: 41, planId: 9, planName: 'Build Muscle · 4 Days' });
    expect(handOffToWorkout).not.toHaveBeenCalled();
  });

  it('outside onboarding Accept still hands off to Workout with "{plan} created."', async () => {
    previewGeneratedPlan.mockResolvedValue(FEASIBLE);
    acceptGeneratedPlan.mockResolvedValue(ACCEPTED);
    const tree = await render(<PlanGeneratorPreviewScreen />);
    await act(async () => one(tree, 'generator-start').props.onPress());
    expect(handOffToWorkout).toHaveBeenCalledTimes(1);
    expect(handOffToWorkout.mock.calls[0][2]).toBe('Build Muscle · 4 Days created.');
    expect(openOnboardingDays).not.toHaveBeenCalled();
  });

  it('an accept body without an enrolment falls back to the Workout hand-off', async () => {
    previewGeneratedPlan.mockResolvedValue(FEASIBLE);
    acceptGeneratedPlan.mockResolvedValue({});
    mockParams = { from: 'onboarding' };
    const tree = await render(<PlanGeneratorPreviewScreen />);
    await act(async () => one(tree, 'generator-start').props.onPress());
    expect(handOffToWorkout).toHaveBeenCalledTimes(1);
    expect(openOnboardingDays).not.toHaveBeenCalled();
  });
});
