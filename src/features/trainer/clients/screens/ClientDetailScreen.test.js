import { Linking, StyleSheet, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import GradientFill from '../../../../shared/components/GradientFill';
import PillButton from '../../../../shared/components/PillButton';
import StatusPill from '../../../../shared/components/StatusPill';
import { addToast } from '../../../../shared/components/toastStore';
import { colors, gradients, textScale } from '../../../../shared/theme/tokens';
import EndCoachingDialog from '../../../trainers/components/EndCoachingDialog';
import {
  endCoaching,
  getClientPlan,
  getClientProfileAndEmail,
  getClientProgress,
  getClientWorkoutHistory,
  listClientAssignments,
} from '../api/clientsApi';
import { openAssignPlan } from '../clientLinks';
import ClientAvatar from '../components/ClientAvatar';
import { StatTile, StatusLine, WeekRing } from '../components/ClientsUi';
import WeightHistoryModal from '../components/WeightHistoryModal';
import WorkoutDetailModal from '../components/WorkoutDetailModal';
import ClientDetailContent from './ClientDetailContent';
import ClientDetailScreen from './ClientDetailScreen';

// RN-SPEC-v2-phase6 §2 Client detail (UX N): phone + tablet page + pane,
// every state and action; Email (approved), VOLUME RULE, each action once.

// T-65 (declared mock change): a previous entry, so the back pill goes back.
const mockNavigation = { push: jest.fn(), popTo: jest.fn(), canGoBack: jest.fn(() => true), goBack: jest.fn() };
let mockParams = { clientUserId: 12 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation, useRoute: () => ({ params: mockParams }) }));
jest.mock('../../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shell/ShellPage', () => ({ children }) => children);
jest.mock('../../TrainerOnly', () => ({ children }) => children);
jest.mock('../clientLinks', () => ({ openClientDetail: jest.fn(), openAssignPlan: jest.fn() }));
jest.mock('../components/WorkoutDetailModal', () => jest.fn(() => null));
jest.mock('../components/WeightHistoryModal', () => jest.fn(() => null));
jest.mock('../../../trainers/components/EndCoachingDialog', () => jest.fn(() => null));
// T-121 H2 (setup only): the history's best-effort plan pool read; [] keeps the "Plan #id" fallback.
jest.mock('../../plans/api/plansApi', () => ({ listTrainerPlans: jest.fn(() => Promise.resolve([])) }));
jest.mock('../api/clientsApi', () => ({
  getClientProfileAndEmail: jest.fn(),
  endCoaching: jest.fn(),
  getClientPlan: jest.fn(),
  getClientProgress: jest.fn(),
  getClientWorkoutHistory: jest.fn(),
  listClientAssignments: jest.fn(),
}));
jest.mock('../../../../shared/components/toastStore', () => ({ ...jest.requireActual('../../../../shared/components/toastStore'),
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));

const PROFILE = {
  first_name: 'Sara',
  last_name: 'Lopez',
  age: 29,
  sex: 'female',
  height_value: 165,
  height_unit: 'cm',
  current_weight_value: 64.3,
  current_weight_unit: 'kg',
  goal_weight_value: 60,
  goal_weight_unit: 'kg',
};
const PLAN = { enrollment: { started_on: '2026-09-14', plan: { name: 'Upper / Lower Split', days_per_week: 4, category: { name: 'Strength' } } } };
const STATS = { total_workouts_completed: 21, workouts_this_week: 2, current_streak: 3, total_volume_last_30_days_kg: 18420, total_volume_last_30_days: 99999 };
const SESSIONS = [
  { id: 101, status: 'completed', completed_at: '2026-10-23T10:00:00Z', duration_seconds: 2940, total_volume_kg: 6240, total_volume: 1, workout_plan_day: { title: 'Upper A' } },
  { id: 102, status: 'in_progress', started_at: '2026-10-22T10:00:00Z', duration_seconds: 2640 },
];
const ASSIGNMENTS = [
  { id: 1, workout_plan_id: 12, status: 'active', created_at: '2026-09-14T00:00:00Z' },
  { id: 2, workout_plan_id: 7, status: 'replaced', created_at: '2026-07-02T00:00:00Z' },
];

const texts = (tree) =>
  tree.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).filter((part) => typeof part !== 'object').join(''));
const byTestID = (tree, testID) => tree.root.findAll((node) => node.props.testID === testID && typeof node.type !== 'string')[0];
const host = (tree, testID) => tree.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string')[0];

function setWindow(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 1194, scale: 2, fontScale });
}

function load({ plan = PLAN, profile = PROFILE, email = 'sara@example.com', stats = STATS, sessions = SESSIONS, assignments = ASSIGNMENTS } = {}) {
  getClientPlan.mockResolvedValue(plan);
  getClientProfileAndEmail.mockResolvedValue({ profile, clientEmail: email });
  getClientProgress.mockResolvedValue({ summary: null, stats });
  getClientWorkoutHistory.mockResolvedValue({ items: sessions });
  listClientAssignments.mockResolvedValue(assignments);
}

async function render(element = <ClientDetailScreen />) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { clientUserId: 12 };
  setWindow(390);
  load();
});

// UX native final audit 27 Oct 2026, ruling 6, row D364 (MUST): Client
// detail's back control is the glass "‹ All clients" pill (RN-SPEC-TRAINER-
// CLIENTS dated 27 Oct), 44 phone / 40 tablet, not the gold text link.
describe('ruling 6 (D364): the "‹ All clients" glass back pill', () => {
  it.each([
    [390, 44],
    [834, 40],
  ])('width %i: a %i glass pill with the chevron and "All clients"; it pushes the Clients list', async (width, height) => {
    setWindow(width);
    load();
    const tree = await render();
    const pill = host(tree, 'client-all-clients');
    expect(StyleSheet.flatten(pill.props.style)).toMatchObject({ minHeight: height, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.hairline });
    expect(host(tree, 'client-all-clients-chevron')).toBeTruthy();
    expect(texts({ root: pill })).toEqual(['All clients']);
    expect(pill.props).toMatchObject({ accessibilityRole: 'link', accessibilityLabel: 'All clients' });
    // DECLARED (T-65, PHONE-NAV spec §3 / §5): was push('TrainerClients') (⚠C-5). Back in history, else replace.
    mockNavigation.goBack.mockClear();
    await act(async () => byTestID(tree, 'client-all-clients').props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('Client detail, phone', () => {
  it('identity: back link, the avatar (initials, person colour), the name as the page heading', async () => {
    const tree = await render();
    const avatar = tree.root.findAllByType(ClientAvatar)[0];
    expect([avatar.props.userId, avatar.props.initials, avatar.props.size]).toEqual([12, 'SL', 64]);
    const name = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Sara Lopez')[0];
    expect(name.props.accessibilityRole).toBe('header');
    expect(name.props.maxFontSizeMultiplier).toBe(textScale.title);
    // DECLARED (T-65, PHONE-NAV spec §3 / §5): was push('TrainerClients'). The back pill goes back in history.
    mockNavigation.goBack.mockClear();
    await act(async () => byTestID(tree, 'client-all-clients').props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('actions once: glass Email (mailto, "Email {name}") + gold Change plan; the plan card has no second button', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const tree = await render();
    const email = byTestID(tree, 'client-email');
    expect([email.props.variant, email.props.accessibilityLabel, email.props.title]).toEqual(['secondary', 'Email Sara Lopez', 'Email']);
    await act(async () => email.props.onPress());
    expect(open).toHaveBeenCalledWith('mailto:sara@example.com');
    const plan = tree.root.findAll((node) => node.props.testID === 'client-assign-plan' && node.type === PillButton);
    expect(plan).toHaveLength(1);
    expect([plan[0].props.title, plan[0].props.variant]).toEqual(['Change plan', undefined]);
    await act(async () => plan[0].props.onPress());
    // T-121 M10 (declared, addendum A1). Was: toHaveBeenCalledWith(12). The shown name rides along.
    expect(openAssignPlan).toHaveBeenCalledWith(12, 'Sara Lopez');
    open.mockRestore();
  });

  it('Email with no mail handler: the openURL rejection is caught (silent, as v1 TrainerHub), no toast, the screen stays', async () => {
    let caught;
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(() => {
      const rejected = Promise.reject(new Error('No Activity found to handle Intent'));
      caught = jest.spyOn(rejected, 'catch');
      return rejected;
    });
    const tree = await render();
    await act(async () => {
      await expect(Promise.resolve(byTestID(tree, 'client-email').props.onPress())).resolves.toBeUndefined();
    });
    expect(open).toHaveBeenCalledWith('mailto:sara@example.com');
    expect(caught).toHaveBeenCalledTimes(1);
    expect(addToast).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(byTestID(tree, 'client-email')).toBeTruthy();
    open.mockRestore();
  });

  it('no client_email → no Email action; no plan → "Assign a plan" + the No active plan EmptyState', async () => {
    load({ email: null, plan: null });
    const tree = await render();
    expect(byTestID(tree, 'client-email')).toBeUndefined();
    expect(byTestID(tree, 'client-assign-plan').props.title).toBe('Assign a plan');
    expect(texts(tree)).toEqual(expect.arrayContaining(['No active plan', 'This client isn’t enrolled in a plan. Assign one to get them started.']));
    expect(host(tree, 'client-plan-card')).toBeUndefined();
  });

  it('stats: Workouts, Volume (total_volume_last_30_days_kg in the client unit), This week, Streak (teal)', async () => {
    const tree = await render();
    const tiles = tree.root.findAllByType(StatTile).map((tile) => [tile.props.label, String(tile.props.value), tile.props.sub]);
    expect(tiles).toEqual([
      ['Workouts', '21', 'completed'],
      ['Volume', (18420).toLocaleString(), 'kg · last 30 days'],
      ['This week', '2', 'workouts'],
      ['Streak', '3', 'days'],
    ]);
    expect(tree.root.findAllByType(StatTile)[3].props.valueColor).toBe(colors.teal);
    expect(texts(tree)).not.toContain((99999).toLocaleString());
  });

  // Dated 27 Oct 2026 (§C4.4 audit b2): the phone "This week" shows a 32 gold week ring (done / planned this
  // week) before its number; the phone "Client details" heading sits inside its card.
  it('phone This week: the 32 week ring before the number, from the row activity, else stats + plan days', async () => {
    mockParams = { clientUserId: 12, clientActivity: { current_plan: { name: 'X' }, week: { planned: 3, done: 1, missed: 0, days: [] } } };
    let tree = await render();
    const week = () => tree.root.findAllByType(StatTile).find((tile) => tile.props.label === 'This week');
    let ring = week().findAllByType(WeekRing);
    expect(ring.map((node) => [node.props.size, node.props.done, node.props.planned])).toEqual([[32, 1, 3]]);
    mockParams = { clientUserId: 12 };
    tree = await render();
    ring = week().findAllByType(WeekRing);
    expect(ring.map((node) => [node.props.size, node.props.done, node.props.planned])).toEqual([[32, 2, 4]]);
    const others = tree.root.findAllByType(StatTile).filter((tile) => tile.props.label !== 'This week');
    others.forEach((tile) => expect(tile.findAllByType(WeekRing)).toHaveLength(0));
    expect(host(tree, 'client-details').findAll((node) => node.type === 'Text' && node.props.children === 'Client details')).toHaveLength(1);
  });

  it('volume in lb for an lb client; the tile hides when the _kg field is absent', async () => {
    load({ profile: { ...PROFILE, current_weight_unit: 'lb' } });
    let tree = await render();
    const volume = tree.root.findAllByType(StatTile).find((tile) => tile.props.label === 'Volume');
    expect([volume.props.value, volume.props.sub]).toEqual([(40609).toLocaleString(), 'lb · last 30 days']);
    load({ stats: { ...STATS, total_volume_last_30_days_kg: undefined } });
    tree = await render();
    expect(tree.root.findAllByType(StatTile).map((tile) => tile.props.label)).toEqual(['Workouts', 'This week', 'Streak']);
  });

  it('no stats → no tiles', async () => {
    load({ stats: null });
    const tree = await render();
    expect(tree.root.findAllByType(StatTile)).toHaveLength(0);
  });

  it('Client details: Age, Sex, Height, Current weight (a gold button → weight history), Goal weight; no Name cell', async () => {
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Client details', 'Age', '29', 'Sex', 'Female', 'Height', '165 cm', 'Current weight', '64.3 kg', 'Goal weight', '60 kg']));
    expect(texts(tree)).not.toContain('Name');
    const weight = byTestID(tree, 'client-current-weight');
    expect(weight.props.accessibilityLabel).toBe('Current weight, 64.3 kg, opens weight history');
    await act(async () => weight.props.onPress());
    expect(WeightHistoryModal.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({ isOpen: true, clientUserId: 12, profile: PROFILE, clientName: 'Sara Lopez' }));
  });

  it('no profile: "No profile yet", heading "Unnamed client", avatar "?"; no weight button', async () => {
    load({ profile: null });
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Unnamed client', 'No profile yet']));
    expect(tree.root.findAllByType(ClientAvatar)[0].props.initials).toBe('?');
    expect(byTestID(tree, 'client-current-weight')).toBeUndefined();
  });

  // T-121 H2 + L2 (declared #9/#10). Was: 'Assigned plan' eyebrow + `Started ${toLocaleDateString()}`. The fixture's
  // enrolled plan has no id, so no assignment matches: "Chosen by client".
  it('Current plan: the gold-gradient card, the origin chip, name, short start date, days/week · category', async () => {
    const tree = await render();
    const card = host(tree, 'client-plan-card');
    const fill = card.findAll((node) => node.type === GradientFill)[0];
    expect(fill.props.colors).toEqual(gradients.gold.colors);
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Chosen by client',
        'Upper / Lower Split',
        `Started ${new Date('2026-09-14').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        '4\u00a0days / week · Strength',
      ])
    );
    load({ plan: { enrollment: { plan: {} } } });
    const bare = await render();
    expect(texts(bare)).toEqual(expect.arrayContaining(['Current plan', 'Active enrollment']));
  });

  it('Recent workouts: initials tile of the workout name, kg volume only from total_volume_kg, sentence-case pills; a row opens the workout', async () => {
    const tree = await render();
    expect(texts(tree)).toContain('UA');
    expect(texts(tree)).toEqual(expect.arrayContaining([`49 min · ${(6240).toLocaleString()} kg volume`, '44 min']));
    const pills = tree.root.findAllByType(StatusPill).map((pill) => [pill.props.label, pill.props.tone]);
    expect(pills.slice(0, 2)).toEqual([
      ['Completed', 'completed'],
      ['In_progress', 'gold'],
    ]);
    expect(byTestID(tree, 'client-session-101').props.accessibilityLabel).toMatch(/^Upper A, .*, 49 min · .* kg volume, Completed$/);
    await act(async () => byTestID(tree, 'client-session-101').props.onPress());
    // p56 merge (P5 M1/M2): the client's profile (VOLUME RULE unit) + the shown name (eyebrow).
    expect(WorkoutDetailModal.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({ clientUserId: 12, workoutId: 101, profile: PROFILE, clientName: 'Sara Lopez' }));
  });

  // T-121 H2 (declared #11): kept as the fallback; the pool mock is [] so ids 12 and 7 have no name.
  it('Assignment history: "Plan #id", Active = teal, replaced = neutral', async () => {
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Plan #12', 'Plan #7']));
    const pills = tree.root.findAllByType(StatusPill).map((pill) => [pill.props.label, pill.props.tone]);
    expect(pills.slice(2)).toEqual([
      ['Active', 'active'],
      ['Replaced', 'neutral'],
    ]);
  });

  // T-121 H2 (declared #12). Was: 'Nothing assigned yet'.
  it('empty sections: No workouts yet / You haven’t assigned a plan yet', async () => {
    load({ sessions: [], assignments: [] });
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['No workouts yet', 'You haven’t assigned a plan yet']));
  });

  it('status line from the row activity: amber Missed, green On track, none without the data', async () => {
    let tree = await render();
    expect(tree.root.findAllByType(StatusLine)).toHaveLength(0);
    mockParams = { clientUserId: 12, clientActivity: { current_plan: { name: 'X' }, week: { planned: 3, done: 1, missed: 2, days: [] } } };
    tree = await render();
    expect(tree.root.findAllByType(StatusLine).map((line) => [line.props.tone, line.props.text])).toEqual([['warning', 'Missed 2 this week']]);
    mockParams = {
      clientUserId: 12,
      clientActivity: { current_plan: { name: 'X' }, week: { planned: 3, done: 1, missed: 0, days: [{ date: '2026-10-26', status: 'done' }, { date: '2026-10-27', status: 'rest' }] } },
    };
    tree = await render();
    expect(tree.root.findAllByType(StatusLine).map((line) => [line.props.tone, line.props.text])).toEqual([['success', 'On track']]);
    // ND-11 weekday chips only with the data.
    expect(texts(tree)).toContain('Mon');
  });

  // DECLARED (T-79): was "…and pushes Clients" (push('TrainerClients'), whose Back returned to this
  // ended client as "Not your client"). Now popTo: the list already in the stack, never a push.
  it('End coaching: the danger-outline button opens the dialog; success toasts and pops to Clients', async () => {
    endCoaching.mockResolvedValue({});
    const tree = await render();
    const dialog = () => EndCoachingDialog.mock.calls.at(-1)[0];
    // p56 merge (P5 M6): the End coaching dialog, client variant.
    expect(dialog()).toEqual(expect.objectContaining({ isOpen: false, title: 'End coaching with this client?', confirmLabel: 'End coaching', variant: 'client' }));
    const button = host(tree, 'client-end-coaching');
    expect(StyleSheet.flatten(button.props.style)).toEqual(expect.objectContaining({ borderColor: colors.dangerLine, minHeight: 44 }));
    await act(async () => byTestID(tree, 'client-end-coaching').props.onPress());
    expect(dialog().isOpen).toBe(true);
    await act(async () => dialog().onConfirm());
    expect(endCoaching).toHaveBeenCalledWith(12);
    expect(addToast).toHaveBeenCalledWith('success', 'Coaching ended', 'They keep their plan, schedule and history — it just isn’t managed by you now.');
    expect(mockNavigation.popTo).toHaveBeenCalledWith('TrainerClients');
    expect(mockNavigation.push).not.toHaveBeenCalledWith('TrainerClients');
  });

  it('End coaching failure: error toast, the dialog closes, no navigation', async () => {
    endCoaching.mockRejectedValue({ response: { status: 500, data: { message: 'Busy' } } });
    const tree = await render();
    await act(async () => byTestID(tree, 'client-end-coaching').props.onPress());
    await act(async () => EndCoachingDialog.mock.calls.at(-1)[0].onConfirm());
    expect(addToast).toHaveBeenCalledWith('error', 'Could not end coaching', 'Busy');
    expect(EndCoachingDialog.mock.calls.at(-1)[0].isOpen).toBe(false);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('a non-404 failure: "Could not load this client" + the server text; Retry reloads to the page', async () => {
    getClientPlan.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server down' } } });
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Could not load this client', 'Server down']));
    expect(byTestID(tree, 'client-email')).toBeUndefined();
    const retry = tree.root.findAll((node) => typeof node.props.onRetry === 'function')[0];
    await act(async () => retry.props.onRetry());
    expect(getClientPlan).toHaveBeenCalledTimes(2);
    expect(byTestID(tree, 'client-email')).toBeTruthy();
  });

  // Web parity (review f403f6f, §6.1 + §C4.2): loading / not found / error keep ONE h1 "Client" (registered as
  // the hero, so the shell header shows no "Coaching").
  it('loading keeps the heading "Client" (and no "Coaching"); a 404 is Not your client', async () => {
    getClientPlan.mockReturnValue(new Promise(() => {}));
    let tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Client', 'Loading client']));
    expect(texts(tree)).not.toContain('Coaching');
    getClientPlan.mockRejectedValue({ response: { status: 404, data: {} } });
    tree = await render();
    expect(texts(tree)).toContain('Not your client');
  });
});

describe('Client detail, tablet page', () => {
  beforeEach(() => {
    setWindow(1194);
  });

  it('hero card (gradient-card, avatar 80, "Client details", 5 cells), 4 tiles, the ink plan pill once, wide coaching', async () => {
    const tree = await render();
    expect(host(tree, 'client-detail-tablet')).toBeTruthy();
    const hero = host(tree, 'client-hero');
    expect(hero.findAll((node) => node.type === GradientFill)[0].props.colors).toEqual(gradients.card.colors);
    expect(tree.root.findAllByType(ClientAvatar)[0].props.size).toBe(80);
    const tiles = tree.root.findAllByType(StatTile).map((tile) => [tile.props.label, tile.props.valueColor]);
    // DECLARED (27 Oct 2026, §C4.4 audit b2): was Workouts · Volume · This week · Streak. Tablet keeps the web
    // order Workouts · This week · Streak · Volume (gold / green / amber numbers).
    expect(tiles).toEqual([
      ['Workouts', colors.gold],
      ['This week', colors.success],
      ['Streak', colors.warning],
      ['Volume', colors.textPrimary],
    ]);
    expect(tree.root.findAllByType(WeekRing)).toHaveLength(0);
    const plan = tree.root.findAll((node) => node.props.testID === 'client-assign-plan' && typeof node.type !== 'string');
    expect(plan.every((node) => node.type !== PillButton)).toBe(true);
    expect(host(tree, 'client-plan-card').findAll((node) => node.props.testID === 'client-assign-plan').length).toBeGreaterThan(0);
    expect(byTestID(tree, 'client-email')).toBeTruthy();
    expect(StyleSheet.flatten(host(tree, 'client-coaching').props.style).flexDirection).toBe('row');
  });

  it('the pane layout (inside tablet Clients) is one column with the 60 avatar and calls onEnded', async () => {
    endCoaching.mockResolvedValue({});
    const onEnded = jest.fn();
    const tree = await render(<ClientDetailContent clientUserId={12} layout="pane" onEnded={onEnded} />);
    expect(tree.root.findAllByType(ClientAvatar)[0].props.size).toBe(60);
    await act(async () => byTestID(tree, 'client-end-coaching').props.onPress());
    await act(async () => EndCoachingDialog.mock.calls.at(-1)[0].onConfirm());
    expect(onEnded).toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });
});

describe('Client detail, large text (§9)', () => {
  it.each([1, 2, 3.1])('fontScale %s: past 1.3 the action pair stacks (plan first, full width) and tiles become rows', async (fontScale) => {
    setWindow(390, fontScale);
    const tree = await render();
    const reflow = fontScale > textScale.reflowAbove;
    const order = tree.root.findAllByType(PillButton).map((button) => button.props.testID).filter((id) => ['client-email', 'client-assign-plan'].includes(id));
    expect(order).toEqual(reflow ? ['client-assign-plan', 'client-email'] : ['client-email', 'client-assign-plan']);
    expect(byTestID(tree, 'client-assign-plan').props.fullWidth).toBe(reflow);
    tree.root.findAllByType(StatTile).forEach((tile) => expect(tile.props.row).toBe(reflow));
  });
});

// T-65 "phone bottom nav on main pages only" (PHONE-NAV spec §3 / §5, 27 Oct
// 2026): Client detail "‹ All clients". Back in history when there is a previous entry, else REPLACE
// this screen with the parent (no push, no loop).
describe('T-65 back control (client detail)', () => {
  const saved = { ...mockNavigation };
  afterEach(() => {
    Object.keys(mockNavigation).forEach((key) => delete mockNavigation[key]);
    Object.assign(mockNavigation, saved);
  });
  const press = (tree) => tree.root.findAll((node) => node.props.testID === 'client-all-clients' && typeof node.props.onPress === 'function')[0];

  it('"All clients": with history it goes back; with none it replaces to TrainerClients', async () => {
    Object.assign(mockNavigation, { canGoBack: jest.fn(() => true), goBack: jest.fn(), replace: jest.fn(), getState: jest.fn(() => ({ routeNames: ['TrainerClients', 'TrainerClient'] })) });
    const tree = await render();
    expect(press(tree).props.accessibilityLabel ?? press(tree).props.label).toBe('All clients');
    await act(async () => press(tree).props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    mockNavigation.canGoBack.mockReturnValue(false);
    await act(async () => press(tree).props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).toHaveBeenCalledWith('TrainerClients');
    expect(mockNavigation.push).not.toHaveBeenCalledWith('TrainerClients');
  });
});

// T-121 H2 (web 2.1.10 + the UX must-fix on 430de8c7), built from the real wire shape: GET
// /trainer/clients/{id}/plan → data.plan.enrollment { id, user_id, workout_plan_id, status, started_on, created_at,
// updated_at, plan }, GET …/assignments → data.items { id, workout_plan_id, status, created_at }.
describe('T-121 H2 Current plan + history names', () => {
  const { listTrainerPlans } = require('../../plans/api/plansApi');
  const { assignmentTitle, planOriginLabel } = require('../clientFormat');
  const WIRE_PLAN = {
    enrollment: {
      id: 5,
      user_id: 12,
      workout_plan_id: 12,
      status: 'active',
      started_on: '2026-10-26',
      created_at: '2026-10-26T09:00:00Z',
      updated_at: '2026-10-26T09:00:00Z',
      plan: { id: 12, name: 'Upper / Lower Split', days_per_week: 4, category: { name: 'Strength' } },
    },
  };

  it('"Assigned by you" when an ACTIVE assignment is for the enrolled plan', async () => {
    load({ plan: WIRE_PLAN });
    const tree = await render();
    expect(host(tree, 'client-plan-origin').props.children).toBe('Assigned by you');
  });

  it('"Chosen by client" when the active assignment is for another plan, or only a replaced one matches', async () => {
    load({ plan: WIRE_PLAN, assignments: [{ id: 1, workout_plan_id: 9, status: 'active', created_at: '2026-10-01T00:00:00Z' }] });
    let tree = await render();
    expect(host(tree, 'client-plan-origin').props.children).toBe('Chosen by client');
    load({ plan: WIRE_PLAN, assignments: [{ id: 1, workout_plan_id: 12, status: 'replaced', created_at: '2026-10-01T00:00:00Z' }] });
    tree = await render();
    expect(host(tree, 'client-plan-origin').props.children).toBe('Chosen by client');
  });

  it('no enrollment: the section is "Current plan" with its existing empty state', async () => {
    load({ plan: null });
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Current plan', 'No active plan']));
    expect(texts(tree)).not.toContain('Assigned plan');
  });

  it('history rows: the pool name, else "Plan #id"; the pool loads once and only with history', async () => {
    listTrainerPlans.mockResolvedValueOnce([{ id: 12, name: 'Upper / Lower Split' }]);
    load({ plan: WIRE_PLAN });
    const tree = await render();
    expect(listTrainerPlans).toHaveBeenCalledTimes(1);
    const rowText = (id) => host(tree, `client-assignment-${id}`).findAll((node) => node.type === 'Text').map((node) => node.props.children);
    expect(rowText(1)).toContain('Upper / Lower Split');
    expect(rowText(2)).toContain('Plan #7');
    listTrainerPlans.mockClear();
    load({ assignments: [] });
    await render();
    expect(listTrainerPlans).not.toHaveBeenCalled();
  });

  it('a failed pool read keeps "Plan #id" (no error shown)', async () => {
    listTrainerPlans.mockRejectedValueOnce(new Error('down'));
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Plan #12', 'Plan #7']));
  });

  it('helpers: never "Plan #undefined"; chip needs a real enrolled id', () => {
    expect(assignmentTitle({ workout_plan_id: undefined }, new Map())).toBe('A plan');
    expect(assignmentTitle({ workout_plan_id: null })).toBe('A plan');
    expect(assignmentTitle({ workout_plan_id: 7 }, new Map([['7', '  ']]))).toBe('Plan #7');
    expect(assignmentTitle({ workout_plan_id: '7' }, new Map([['7', 'PPL']]))).toBe('PPL');
    expect(planOriginLabel({ enrollment: { plan: {} } }, [{ status: 'active', workout_plan_id: undefined }])).toBe('Chosen by client');
    expect(planOriginLabel({ enrollment: { workout_plan_id: 3 } }, [{ status: 'active', workout_plan_id: '3' }])).toBe('Assigned by you');
  });

  it('L2: "Started Oct 26, 2026" (the short app date)', async () => {
    load({ plan: WIRE_PLAN });
    const tree = await render();
    const expected = new Date('2026-10-26').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    expect(texts(tree)).toContain(`Started ${expected}`);
    expect(expected).toMatch(/^Oct 2[56], 2026$/);
  });
});
