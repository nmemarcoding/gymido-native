import { act, create } from 'react-test-renderer';

import { apiClient } from '../../shared/api/client';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import { ToastTone, addToast } from '../../shared/components/toastStore';
import { localDateKey } from '../plans/libraryFormat';
import { resetProfileStore, setStoredProfile } from '../profile/profileStore';
import { deleteWorkout } from '../workout/api/workoutApi';
import { loadProgress } from './api/progressApi';
import ProgressScreen from './ProgressScreen';
import { OVERFLOW_HANDOFF_MS } from '../trainer/plans/components/PlanOverflowSheet';
import { deleteWorkoutBody, deleteWorkoutOutcome, isThisWeekRow, workoutActionsLabel, workoutWeekdayDate } from './progressFormat';

// T-82 (UX T82-delete-workout-ux): delete a finished workout from Progress →
// Recent workouts (⋯ on this week's rows → Menu → confirm → DELETE).

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 900, scale: 2, fontScale: 1 }),
}));
jest.mock('../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('../shell/ShellPage', () => function MockShellPage({ children }) {
  return children;
});
jest.mock('../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./api/progressApi', () => ({ loadProgress: jest.fn(), getWeightLogsInRange: jest.fn(() => Promise.resolve([])) }));
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'), addToast: jest.fn() }));

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const hosts = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const hostIds = (root, prefix) =>
  root.findAll((node) => typeof node.type === 'string' && String(node.props.testID ?? '').startsWith(prefix)).map((node) => node.props.testID);
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const press = (root, id) => act(() => pressable(root, id).props.onPress());
const flush = () => act(() => new Promise((resolve) => setImmediate(resolve)));
const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const dialog = (root) => root.findByType(ConfirmDialog);
const sheetOpen = (root) => root.find((node) => node.props.testID === 'workout-actions-sheet' && node.props.isOpen !== undefined).props.isOpen;

// This week (Mon-first) around today, in the device's local dates.
const today = new Date();
const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
const dayAt = (offset, hour = 12) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset, hour);
const WEEK = Array.from({ length: 7 }, (_, index) => ({ date: localDateKey(dayAt(index)), is_workout_day: index % 2 === 0, weekday: { id: index + 1 } }));
const iso = (date) => date.toISOString();

const THIS_WEEK_A = { id: 41, workout_plan_day: { title: 'Push A' }, started_at: iso(dayAt(0, 9)), completed_at: iso(dayAt(0, 10)), duration_seconds: 3000, total_volume_kg: 900 };
const THIS_WEEK_B = { id: 42, workout_plan_day: { title: 'Pull B' }, started_at: iso(dayAt(0, 7)), completed_at: iso(dayAt(0, 8)), duration_seconds: 2400, total_volume_kg: 800 };
const OLDER = { id: 30, workout_plan_day: { title: 'Legs' }, started_at: iso(dayAt(-3, 9)), completed_at: iso(dayAt(-3, 10)), duration_seconds: 3600, total_volume_kg: 1200 };

const DATA = {
  weightProgress: {},
  weightLogs: [],
  overview: null,
  history: null,
  frequency: [],
  missed: null,
  recentWorkouts: [THIS_WEEK_A, THIS_WEEK_B, OLDER],
  week: WEEK,
  planDaysPerWeek: null,
};
const RELOADED = { ...DATA, recentWorkouts: [THIS_WEEK_B, OLDER] };

const apiError = (status, body) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: body } });
const LOCKED = apiError(409, { errors: { reason: ['WORKOUT_DELETE_WEEK_LOCKED'] } });

const mounted = [];
beforeEach(() => {
  jest.clearAllMocks();
  resetProfileStore();
  setStoredProfile({ current_weight_unit: 'kg' });
  loadProgress.mockResolvedValue(DATA);
});
afterEach(() => act(() => mounted.splice(0).forEach((tree) => tree.unmount())));

async function renderActivity() {
  let tree;
  await act(async () => {
    tree = create(<ProgressScreen />);
  });
  await flush();
  mounted.push(tree);
  press(tree.root, 'progress-tab-activity');
  return tree;
}

// ⋯ → Menu → Delete workout → (hand-off) → the confirm is open.
async function openConfirm(tree, key = 'w41') {
  press(tree.root, `progress-recent-actions-${key}`);
  expect(sheetOpen(tree.root)).toBe(true);
  press(tree.root, 'workout-actions-delete');
  expect(sheetOpen(tree.root)).toBe(false);
  await wait(OVERFLOW_HANDOFF_MS + 20);
  expect(dialog(tree.root).props.isOpen).toBe(true);
}

describe('T-82 progressFormat helpers', () => {
  const row = { kind: 'done', workoutId: 41, title: 'Push A', startedAt: THIS_WEEK_A.started_at };

  it('isThisWeekRow: LOCAL started_at within week[0].date..week[6].date; never guessed', () => {
    expect(isThisWeekRow(row, WEEK)).toBe(true);
    expect(isThisWeekRow({ ...row, startedAt: iso(dayAt(6, 23)) }, WEEK)).toBe(true);
    expect(isThisWeekRow({ ...row, startedAt: OLDER.started_at }, WEEK)).toBe(false);
    expect(isThisWeekRow({ ...row, startedAt: iso(dayAt(7, 1)) }, WEEK)).toBe(false);
    expect(isThisWeekRow(row, null)).toBe(false);
    expect(isThisWeekRow(row, WEEK.slice(0, 3))).toBe(false);
    expect(isThisWeekRow({ ...row, startedAt: null }, WEEK)).toBe(false);
    expect(isThisWeekRow({ ...row, startedAt: 'junk' }, WEEK)).toBe(false);
    expect(isThisWeekRow({ ...row, workoutId: null }, WEEK)).toBe(false);
    expect(isThisWeekRow({ ...row, kind: 'missed' }, WEEK)).toBe(false);
  });

  it('copy: the ⋯ label, the confirm body ({Day name} on {Weekday, Mon D})', () => {
    expect(workoutActionsLabel(row)).toBe('Workout actions, Push A, Monday');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    expect(workoutWeekdayDate(row.startedAt)).toBe(`Monday, ${months[monday.getMonth()]} ${monday.getDate()}`);
    expect(deleteWorkoutBody(row)).toBe(
      `Push A on Monday, ${months[monday.getMonth()]} ${monday.getDate()} will be removed from your history, this week's progress and your exercise records. Personal records are recalculated. This can't be undone.`
    );
  });

  it('deleteWorkoutOutcome: 409 WORKOUT_DELETE_WEEK_LOCKED → locked, 404 → gone, else failed', () => {
    expect(deleteWorkoutOutcome(LOCKED)).toBe('locked');
    expect(deleteWorkoutOutcome(apiError(409, { errors: { reason: 'WORKOUT_DELETE_WEEK_LOCKED' } }))).toBe('locked');
    expect(deleteWorkoutOutcome(apiError(409, { errors: { reason: ['OTHER'] } }))).toBe('failed');
    expect(deleteWorkoutOutcome(apiError(404, {}))).toBe('gone');
    expect(deleteWorkoutOutcome(apiError(500, {}))).toBe('failed');
    expect(deleteWorkoutOutcome(new Error('Network Error'))).toBe('failed');
  });

  it('deleteWorkout: DELETE /workouts/{id}', async () => {
    apiClient.delete.mockResolvedValue({ data: { data: { session: { id: 41, status: 'deleted' } } } });
    await expect(deleteWorkout(41)).resolves.toEqual({ session: { id: 41, status: 'deleted' } });
    expect(apiClient.delete).toHaveBeenCalledWith('/workouts/41');
  });
});

describe('T-82 Recent workouts ⋯ → delete', () => {
  it('the ⋯ only on this week’s rows (labelled); none on older rows', async () => {
    const tree = await renderActivity();
    expect(hostIds(tree.root, 'progress-recent-actions-')).toEqual(['progress-recent-actions-w41', 'progress-recent-actions-w42']);
    expect(hosts(tree.root, 'progress-recent-w30')).toHaveLength(1);
    expect(hosts(tree.root, 'progress-recent-actions-w30')).toHaveLength(0);
    expect(pressable(tree.root, 'progress-recent-actions-w41').props.accessibilityLabel).toBe('Workout actions, Push A, Monday');
  });

  it('no /week (null or invalid) → no ⋯ at all', async () => {
    loadProgress.mockResolvedValue({ ...DATA, week: null });
    const tree = await renderActivity();
    expect(hosts(tree.root, 'progress-recent-w41')).toHaveLength(1);
    expect(hostIds(tree.root, 'progress-recent-actions-')).toEqual([]);
    loadProgress.mockResolvedValue({ ...DATA, week: WEEK.slice(0, 6) });
    const partial = await renderActivity();
    expect(hostIds(partial.root, 'progress-recent-actions-')).toEqual([]);
  });

  it('Menu → confirm → DELETE /workouts/{id} → "Workout deleted." toast + reload; the row goes', async () => {
    const tree = await renderActivity();
    await openConfirm(tree);
    const open = dialog(tree.root);
    expect(open.props).toMatchObject({ title: 'Delete this workout?', confirmLabel: 'Delete workout', tone: 'danger', dismissible: true });
    // Footer Cancel, so no × (ConfirmDialog's footerDismiss; the rows are phone-only, so no tablet Close either).
    expect(open.props.boardClose).toBeUndefined();
    expect(open.props.description).toBe(deleteWorkoutBody({ title: 'Push A', startedAt: THIS_WEEK_A.started_at }));
    expect(loadProgress).toHaveBeenCalledTimes(1);
    apiClient.delete.mockResolvedValue({ data: { data: { session: { id: 41, status: 'deleted' } } } });
    loadProgress.mockResolvedValue(RELOADED);
    await act(async () => {
      await dialog(tree.root).props.onConfirm();
    });
    await flush();
    expect(apiClient.delete).toHaveBeenCalledTimes(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/workouts/41');
    expect(addToast).toHaveBeenCalledWith(ToastTone.success, 'Workout deleted.');
    expect(loadProgress).toHaveBeenCalledTimes(2);
    expect(dialog(tree.root).props.isOpen).toBe(false);
    expect(hosts(tree.root, 'progress-recent-w41')).toHaveLength(0);
    expect(hostIds(tree.root, 'progress-recent-actions-')).toEqual(['progress-recent-actions-w42']);
    // The page stays on Activity (a quiet reload, no full-screen loader).
    expect(hosts(tree.root, 'progress-recent')).toHaveLength(1);
  });

  it('Menu Cancel and confirm Cancel send no request', async () => {
    const tree = await renderActivity();
    press(tree.root, 'progress-recent-actions-w41');
    press(tree.root, 'workout-actions-cancel');
    expect(sheetOpen(tree.root)).toBe(false);
    await wait(OVERFLOW_HANDOFF_MS + 20);
    expect(dialog(tree.root).props.isOpen).toBe(false);
    await openConfirm(tree);
    press(tree.root, 'delete-workout-dialog-cancel');
    expect(dialog(tree.root).props.isOpen).toBe(false);
    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalled();
    expect(loadProgress).toHaveBeenCalledTimes(1);
  });

  it('409 WORKOUT_DELETE_WEEK_LOCKED → the dialog closes, the locked toast, the list refreshes (⋯ gone)', async () => {
    const tree = await renderActivity();
    await openConfirm(tree);
    apiClient.delete.mockRejectedValue(LOCKED);
    loadProgress.mockResolvedValue({ ...DATA, week: null });
    await act(async () => {
      await dialog(tree.root).props.onConfirm();
    });
    await flush();
    expect(dialog(tree.root).props.isOpen).toBe(false);
    expect(addToast).toHaveBeenCalledWith(ToastTone.error, "Only this week's workouts can be deleted.");
    expect(loadProgress).toHaveBeenCalledTimes(2);
    expect(hostIds(tree.root, 'progress-recent-actions-')).toEqual([]);
  });

  it('409 with /week still listing the row → that row’s ⋯ still goes away (server refused it)', async () => {
    const tree = await renderActivity();
    await openConfirm(tree);
    apiClient.delete.mockRejectedValue(LOCKED);
    await act(async () => {
      await dialog(tree.root).props.onConfirm();
    });
    await flush();
    expect(addToast).toHaveBeenCalledWith(ToastTone.error, "Only this week's workouts can be deleted.");
    expect(hosts(tree.root, 'progress-recent-w41')).toHaveLength(1);
    expect(hostIds(tree.root, 'progress-recent-actions-')).toEqual(['progress-recent-actions-w42']);
  });

  it('404 → the dialog closes, the generic message as a toast, the list refreshes', async () => {
    const tree = await renderActivity();
    await openConfirm(tree);
    apiClient.delete.mockRejectedValue(apiError(404, { message: 'Not found' }));
    loadProgress.mockResolvedValue(RELOADED);
    await act(async () => {
      await dialog(tree.root).props.onConfirm();
    });
    await flush();
    expect(dialog(tree.root).props.isOpen).toBe(false);
    expect(addToast).toHaveBeenCalledWith(ToastTone.error, "Couldn't delete the workout. Please try again.");
    expect(loadProgress).toHaveBeenCalledTimes(2);
    expect(hosts(tree.root, 'progress-recent-w41')).toHaveLength(0);
  });

  it('network / other → the dialog stays open with the inline error; the button returns', async () => {
    const tree = await renderActivity();
    await openConfirm(tree);
    apiClient.delete.mockRejectedValue(apiError(500, {}));
    await act(async () => {
      await dialog(tree.root).props.onConfirm();
    });
    const open = dialog(tree.root);
    expect(open.props).toMatchObject({ isOpen: true, loading: false, confirmLabel: 'Delete workout', dismissible: true });
    expect(textOf(hosts(tree.root, 'delete-workout-error')[0])).toBe("Couldn't delete the workout. Please try again.");
    expect(addToast).not.toHaveBeenCalled();
    expect(loadProgress).toHaveBeenCalledTimes(1);
  });

  it('single-flight: a second tap while deleting does nothing; Cancel / dismissal are blocked; "Deleting…" + busy', async () => {
    const tree = await renderActivity();
    await openConfirm(tree);
    let resolve;
    apiClient.delete.mockReturnValue(new Promise((done) => (resolve = done)));
    let first;
    act(() => {
      first = dialog(tree.root).props.onConfirm();
    });
    act(() => {
      dialog(tree.root).props.onConfirm();
    });
    const busy = dialog(tree.root);
    expect(busy.props).toMatchObject({ loading: true, confirmLabel: 'Deleting…', dismissible: false });
    press(tree.root, 'delete-workout-dialog-cancel');
    act(() => busy.props.onClose());
    expect(dialog(tree.root).props.isOpen).toBe(true);
    expect(apiClient.delete).toHaveBeenCalledTimes(1);
    loadProgress.mockResolvedValue(RELOADED);
    await act(async () => {
      resolve({ data: { data: {} } });
      await first;
    });
    await flush();
    expect(apiClient.delete).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(dialog(tree.root).props.isOpen).toBe(false);
  });
});
