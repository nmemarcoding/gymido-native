import { AccessibilityInfo, BackHandler } from 'react-native';
import { act, create } from 'react-test-renderer';

import { addToast } from '../../shared/components/toastStore';
import { createSchedule, listPlanDays, replaceSchedule } from '../plans/api/libraryApi';
import OnboardingDaysScreen, { shortPlanName } from './OnboardingDaysScreen';

jest.mock('../plans/api/libraryApi', () => ({ listPlanDays: jest.fn(), createSchedule: jest.fn(), replaceSchedule: jest.fn() }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'), addToast: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));

// T-53 D (onboarding ruling, 29 Oct 2026): "Pick your days" as a full page.

const DAYS = [
  { id: 11, title: 'Upper' },
  { id: 12, title: 'Lower' },
];
const PARAMS = { enrollmentId: 41, planId: 9, planName: 'Build Muscle · 4 Days' };
const navigation = { reset: jest.fn(), isFocused: () => true };

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
// The count and its word are joined by a no-break space (formatCount).
const texts = (root) => root.findAll((node) => node.type === 'Text').map((node) => textOf(node).replace(/\u00a0/g, ' '));
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const resetTarget = () => navigation.reset.mock.calls[0][0].routes[0].params.params;

const mounted = [];
async function render(params = PARAMS) {
  let tree;
  await act(async () => {
    tree = create(<OnboardingDaysScreen navigation={navigation} route={{ params }} />);
  });
  mounted.push(tree);
  return tree;
}

let backHandlers;
beforeEach(() => {
  jest.clearAllMocks();
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((name, handler) => {
    backHandlers.push(handler);
    return { remove: () => (backHandlers = backHandlers.filter((item) => item !== handler)) };
  });
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.restoreAllMocks();
});

describe('T-53 D Pick your days', () => {
  it('loads the new enrolment\'s plan days behind "Loading your plan"', async () => {
    listPlanDays.mockReturnValue(new Promise(() => {}));
    const tree = await render();
    expect(listPlanDays).toHaveBeenCalledWith(9);
    expect(texts(tree.root)).toContain('Loading your plan');
  });

  it('shows the success pill, the "Set up your week" card with R days pre-selected, Save and Later', async () => {
    listPlanDays.mockResolvedValue(DAYS);
    const tree = await render();
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Build Muscle · 4 Days created.', 'Set up your week', 'Pick 2 training days', 'Save training days', 'Later']));
    expect(pressable(tree.root, 'schedule-setup-weekday-1').props.accessibilityState.selected).toBe(true);
    expect(pressable(tree.root, 'schedule-setup-weekday-2').props.accessibilityState.selected).toBe(true);
    expect(pressable(tree.root, 'schedule-setup-weekday-3').props.accessibilityState.selected).toBe(false);
  });

  it('cuts a long plan name at 32 characters + "…"', () => {
    expect(shortPlanName('A'.repeat(40))).toBe(`${'A'.repeat(32)}…`);
    expect(shortPlanName('Short')).toBe('Short');
  });

  it.each([
    ['no days', () => listPlanDays.mockResolvedValue([])],
    ['a failed load', () => listPlanDays.mockRejectedValue(new Error('500'))],
  ])('%s skips D to Workout with "{plan} created." (today\'s Accept)', async (_name, setup) => {
    setup();
    await render();
    expect(navigation.reset).toHaveBeenCalledTimes(1);
    expect(resetTarget()).toMatchObject({ screen: 'Workout', params: { message: 'Build Muscle · 4 Days created.' }, initial: false });
  });

  it('Save: POST the schedule, then replace to Today with "Training days saved." (the prompt waits for it)', async () => {
    listPlanDays.mockResolvedValue(DAYS);
    createSchedule.mockResolvedValue({});
    const tree = await render();
    await act(async () => pressable(tree.root, 'schedule-setup-save').props.onPress());
    expect(createSchedule).toHaveBeenCalledWith(41, [
      { workout_plan_day_id: 11, weekday_id: 1 },
      { workout_plan_day_id: 12, weekday_id: 2 },
    ]);
    expect(addToast).toHaveBeenCalledWith('success', 'Training days saved.');
    expect(resetTarget()).toEqual({ screen: 'Home', params: { askAfterToast: true } });
  });

  it('a 409 on save → PUT', async () => {
    listPlanDays.mockResolvedValue(DAYS);
    createSchedule.mockRejectedValue({ response: { status: 409, data: {} } });
    replaceSchedule.mockResolvedValue({});
    const tree = await render();
    await act(async () => pressable(tree.root, 'schedule-setup-save').props.onPress());
    expect(replaceSchedule).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledTimes(1);
  });

  it('Later and Android back replace to Today with no toast', async () => {
    listPlanDays.mockResolvedValue(DAYS);
    const tree = await render();
    act(() => pressable(tree.root, 'schedule-setup-cancel').props.onPress());
    expect(resetTarget()).toEqual({ screen: 'Home', params: undefined });
    let handled;
    act(() => {
      handled = backHandlers[backHandlers.length - 1]();
    });
    expect(handled).toBe(true);
    expect(navigation.reset).toHaveBeenCalledTimes(2);
    expect(addToast).not.toHaveBeenCalled();
  });
});
