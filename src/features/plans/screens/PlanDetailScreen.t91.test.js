// T-91 (UX T91-end-plan-ruling + the PM amendment, 29 Oct 2026): End plan on
// Plan detail. The ⋯ (current plan only) → "Plan actions" → the confirm →
// POST /my-plans/{id}/cancel → Today + toast; 409 → TrainerLockBanner, 404 →
// re-read + toast, else inline; a workout in progress → "Go to workout".
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import PillButton from '../../../shared/components/PillButton';
import { ToastTone, addToast } from '../../../shared/components/toastStore';
import { SHEET_FOCUS_DELAY_MS, focusNode } from '../../../shared/hooks/useSheetFocus';
import { colors } from '../../../shared/theme/tokens';
import { handOffToToday, openShellPath } from '../../shell/shellLinks';
import { OVERFLOW_HANDOFF_MS } from '../../trainer/plans/components/PlanOverflowSheet';
import { getCurrentWorkout } from '../../workout/api/workoutApi';
import { cancelEnrollment, getCurrentPlan, getCurrentWeek, getPlan, listDayExercises, listPlanDays } from '../api/libraryApi';
import { endPlanTitle, sessionBlocksEnd } from '../endPlan';
import PlanDetailScreen from './PlanDetailScreen';

let mockWindow = { width: 390, height: 844, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ scale: 3, ...mockWindow }),
}));
const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}), canGoBack: jest.fn(() => true), goBack: jest.fn() };
const mockRoute = { key: 'PlanDetail-1', name: 'PlanDetail', params: { planId: '5' } };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock('../../shell/ShellPage', () => function MockShellPage({ children }) {
  return children;
});
jest.mock('../../shell/shellLinks', () => ({ openShellPath: jest.fn(), handOffToWorkout: jest.fn(), handOffToToday: jest.fn() }));
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../../shared/hooks/useSheetFocus', () => ({ ...jest.requireActual('../../../shared/hooks/useSheetFocus'), focusNode: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/components/toastStore', () => ({ ...jest.requireActual('../../../shared/components/toastStore'), addToast: jest.fn() }));
jest.mock('../../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../myPlans/api/myPlansApi', () => ({ copyToMyPlans: jest.fn() }));
jest.mock('../../workout/api/workoutApi', () => ({ getCurrentWorkout: jest.fn() }));
jest.mock('../api/libraryApi', () => ({
  getPlan: jest.fn(),
  listPlanDays: jest.fn(),
  listDayExercises: jest.fn(),
  getCurrentPlan: jest.fn(),
  getCurrentWeek: jest.fn(),
  cancelEnrollment: jest.fn(),
  enrollInPlan: jest.fn(),
  createSchedule: jest.fn(),
  replaceSchedule: jest.fn(),
}));

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const host = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const pressable = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const button = (root, id) => root.findAllByType(PillButton).find((node) => node.props.testID === id);
const dialog = (root) => root.findByType(ConfirmDialog);
const sheetOpen = (root) => root.find((node) => node.props.testID === 'plan-actions-sheet' && node.props.isOpen !== undefined).props.isOpen;
const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const pending = () => new Promise(() => {});
const apiError = (status, message) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: message ? { message } : {} } });

const PLAN = { id: 5, name: 'Upper / Lower Split', category: { name: 'Strength' }, difficulty_level: { name: 'Intermediate' } };
const DAYS = [{ id: 51, day_number: 1, title: 'Upper A' }];
const CURRENT = { enrollment: { id: 90, workout_plan_id: 5, plan: { id: 5, name: 'Upper / Lower Split' } }, schedule: [] };
const OTHER = { enrollment: { id: 77, workout_plan_id: 9, plan: { id: 9, name: 'Other' } }, schedule: [] };

const trees = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockWindow = { width: 390, height: 844, fontScale: 1 };
  getPlan.mockResolvedValue({ plan: PLAN });
  listPlanDays.mockResolvedValue(DAYS);
  listDayExercises.mockResolvedValue([]);
  getCurrentPlan.mockResolvedValue(CURRENT);
  getCurrentWeek.mockResolvedValue([]);
  getCurrentWorkout.mockResolvedValue(null);
});
afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
});

async function render() {
  let tree;
  await act(async () => {
    tree = create(<PlanDetailScreen />);
  });
  trees.push(tree);
  return tree.root;
}

// ⋯ → End plan → (handoff) the confirm.
async function openConfirm(root) {
  await act(async () => pressable(root, 'plan-actions-button').props.onPress());
  await act(async () => pressable(root, 'plan-actions-end').props.onPress());
  await wait(OVERFLOW_HANDOFF_MS + 10);
}

describe('T-91 the ⋯ (§1)', () => {
  it.each([
    ['phone', { width: 390, height: 844, fontScale: 1 }, 'plan-summary'],
    ['tablet', { width: 834, height: 1194, fontScale: 1 }, 'plan-hero'],
  ])('%s: on the current plan, in the title block: a 36 glass circle, 44 target, "Plan actions, {name}"', async (_, size, parent) => {
    mockWindow = size;
    const root = await render();
    const trigger = pressable(root, 'plan-actions-button');
    expect([trigger.props.accessibilityRole, trigger.props.accessibilityLabel]).toEqual(['button', 'Plan actions, Upper / Lower Split']);
    const style = StyleSheet.flatten(trigger.props.style({ pressed: false }));
    expect(style).toEqual(expect.objectContaining({ width: 36, height: 36, borderColor: colors.hairlineButton, backgroundColor: colors.fillButton }));
    expect(style.width + 2 * trigger.props.hitSlop).toBeGreaterThanOrEqual(44);
    expect(host(root, parent).findAll((node) => node.props.testID === 'plan-actions-button')).not.toHaveLength(0);
    // Mounted on the first press only.
    expect(root.findAllByType(ConfirmDialog)).toHaveLength(0);
  });

  it('absent on a plan that is not the current one, and while loading', async () => {
    getCurrentPlan.mockResolvedValue(OTHER);
    let root = await render();
    expect(pressable(root, 'plan-actions-button')).toBeUndefined();
    getPlan.mockReturnValue(pending());
    listPlanDays.mockReturnValue(pending());
    root = await render();
    expect(pressable(root, 'plan-actions-button')).toBeUndefined();
  });
});

// T-91 UX (29 Oct): the phone "Current plan" pill is teal, as iPad/web.
describe('T-91 the phone Current plan pill', () => {
  it('phone: teal (tealTint fill, teal text), the tablet tokens', async () => {
    const root = await render();
    const pill = host(root, 'plan-detail-current');
    expect(StyleSheet.flatten(pill.props.style).backgroundColor).toBe(colors.tealTint);
    const label = pill.findAll((node) => node.type === 'Text' && textOf(node) === 'Current plan')[0];
    expect(StyleSheet.flatten(label.props.style).color).toBe(colors.teal);
  });
});

describe('T-91 the menu and the confirm (§1–§2)', () => {
  it('the menu: "Plan actions", one danger menuitem "End plan" (no trash), a footer Cancel that returns focus to the ⋯', async () => {
    const root = await render();
    await act(async () => pressable(root, 'plan-actions-button').props.onPress());
    expect(sheetOpen(root)).toBe(true);
    const sheet = root.find((node) => node.props.testID === 'plan-actions-sheet' && node.props.isOpen !== undefined);
    expect([sheet.props.title, sheet.props.footerDismiss]).toEqual(['Plan actions', true]);
    const item = pressable(root, 'plan-actions-end');
    expect([item.props.accessibilityRole, item.props.accessibilityLabel]).toEqual(['menuitem', 'End plan']);
    const label = item.findAll((node) => node.type === 'Text' && textOf(node) === 'End plan')[0];
    expect(StyleSheet.flatten(label.props.style).color).toBe(colors.dangerText);
    await act(async () => button(root, 'plan-actions-cancel').props.onPress());
    expect(sheetOpen(root)).toBe(false);
    await wait(SHEET_FOCUS_DELAY_MS + 10);
    expect(focusNode.mock.calls.at(-1)[0].current).toBeTruthy();
    expect(cancelEnrollment).not.toHaveBeenCalled();
  });

  it('the confirm: "End {name}?", the self-chosen body only (no trainer line), danger "End plan" + "Cancel", no ×; Cancel changes nothing', async () => {
    const root = await render();
    await openConfirm(root);
    const confirm = dialog(root);
    expect(confirm.props).toEqual(
      expect.objectContaining({
        isOpen: true,
        hideClose: true,
        title: 'End Upper / Lower Split?',
        description: "You'll stop getting workouts from this plan. Your workout history and progress are kept. You can start this or another plan any time.",
        confirmLabel: 'End plan',
        tone: 'danger',
      }),
    );
    expect(confirm.props.description).not.toMatch(/trainer/i);
    expect(button(root, 'end-plan-dialog-confirm').props.variant).toBe('danger');
    await act(async () => button(root, 'end-plan-dialog-cancel').props.onPress());
    expect(dialog(root).props.isOpen).toBe(false);
    expect(cancelEnrollment).not.toHaveBeenCalled();
  });

  it('the title cuts the name at 32 characters + "…"', () => {
    expect(endPlanTitle('A'.repeat(40))).toBe(`End ${'A'.repeat(32)}…?`);
    expect(endPlanTitle('Short')).toBe('End Short?');
  });

  it('sending: "Ending…", loading, not dismissible, Cancel disabled; a double tap sends ONE cancel', async () => {
    cancelEnrollment.mockReturnValue(pending());
    const root = await render();
    await openConfirm(root);
    await act(async () => {
      dialog(root).props.onConfirm();
      dialog(root).props.onConfirm();
    });
    expect(cancelEnrollment).toHaveBeenCalledTimes(1);
    expect(cancelEnrollment).toHaveBeenCalledWith(90);
    expect(dialog(root).props).toEqual(expect.objectContaining({ confirmLabel: 'Ending…', loading: true, dismissible: false, cancelDisabled: true }));
  });
});

describe('T-91 after ending (§3)', () => {
  it('200: closes, the neutral toast "{name} ended. Your history is kept.", replace to Today', async () => {
    cancelEnrollment.mockResolvedValue({});
    const root = await render();
    await openConfirm(root);
    await act(async () => dialog(root).props.onConfirm());
    expect(dialog(root).props.isOpen).toBe(false);
    expect(addToast).toHaveBeenCalledWith(ToastTone.info, 'Upper / Lower Split ended. Your history is kept.');
    expect(handOffToToday).toHaveBeenCalledWith(mockNavigation, mockRoute);
  });

  it('409 (the trainer lock, PM decision 2): closes and shows the TrainerLockBanner', async () => {
    cancelEnrollment.mockRejectedValue(apiError(409, 'This plan is managed by your trainer and cannot be changed'));
    const root = await render();
    await openConfirm(root);
    await act(async () => dialog(root).props.onConfirm());
    expect(dialog(root).props.isOpen).toBe(false);
    expect(host(root, 'plan-trainer-lock')).toBeDefined();
    expect(handOffToToday).not.toHaveBeenCalled();
  });

  it('404 (already ended): closes, re-reads the page, the neutral toast', async () => {
    cancelEnrollment.mockRejectedValue(apiError(404));
    const root = await render();
    await openConfirm(root);
    getCurrentPlan.mockResolvedValue(null);
    await act(async () => dialog(root).props.onConfirm());
    expect(addToast).toHaveBeenCalledWith(ToastTone.info, 'This plan has already ended.');
    expect(getCurrentPlan).toHaveBeenCalledTimes(2);
    expect(pressable(root, 'plan-actions-button')).toBeUndefined();
  });

  it('another error: the dialog stays open with the server message inline (else the fallback), buttons enabled again', async () => {
    cancelEnrollment.mockRejectedValueOnce(apiError(500, 'Server is down')).mockRejectedValueOnce(apiError(500));
    const root = await render();
    await openConfirm(root);
    await act(async () => dialog(root).props.onConfirm());
    expect(dialog(root).props).toEqual(expect.objectContaining({ isOpen: true, loading: false, dismissible: true, cancelDisabled: false, confirmLabel: 'End plan' }));
    expect(textOf(host(root, 'end-plan-error'))).toBe('Server is down');
    await act(async () => dialog(root).props.onConfirm());
    expect(textOf(host(root, 'end-plan-error'))).toBe("Couldn't end this plan");
  });
});

describe('T-91 a workout in progress (§2, PM Q1)', () => {
  it('blocks: the body starts "Finish or discard…", a glass "Go to workout" opens the workout, no cancel', async () => {
    getCurrentWorkout.mockResolvedValue({ id: 3, status: 'in_progress', user_plan_enrollment_id: 90 });
    const root = await render();
    await openConfirm(root);
    expect(dialog(root).props.description).toMatch(/^Finish or discard your workout in progress first\. /);
    expect(dialog(root).props.confirmLabel).toBe('Go to workout');
    expect(button(root, 'end-plan-dialog-confirm').props.variant).toBe('secondary');
    await act(async () => dialog(root).props.onConfirm());
    expect(openShellPath).toHaveBeenCalledWith('/workout');
    expect(cancelEnrollment).not.toHaveBeenCalled();
  });

  it('which sessions block: this enrollment or none named; another enrollment or a closed one does not', () => {
    expect(sessionBlocksEnd({ status: 'in_progress', user_plan_enrollment_id: 90 }, 90)).toBe(true);
    expect(sessionBlocksEnd({ status: 'in_progress' }, 90)).toBe(true);
    expect(sessionBlocksEnd({ user_plan_enrollment_id: null }, 90)).toBe(true);
    expect(sessionBlocksEnd({ status: 'in_progress', user_plan_enrollment_id: 12 }, 90)).toBe(false);
    expect(sessionBlocksEnd({ status: 'completed', user_plan_enrollment_id: 90 }, 90)).toBe(false);
    expect(sessionBlocksEnd(null, 90)).toBe(false);
  });

  it('a failed GET /workouts/current does not block (the normal confirm)', async () => {
    getCurrentWorkout.mockRejectedValue(apiError(500));
    const root = await render();
    await openConfirm(root);
    expect(dialog(root).props.confirmLabel).toBe('End plan');
  });
});
