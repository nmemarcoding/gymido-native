import { StyleSheet, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import AppModal from '../../../shared/components/AppModal';
import ExerciseImage from '../../../shared/components/ExerciseImage';
import PillButton from '../../../shared/components/PillButton';
import StatusPill from '../../../shared/components/StatusPill';
import { colors, font, radii, textScale } from '../../../shared/theme/tokens';
import { getClientWorkout, inviteClient, listClientWeightLogs, searchMembers } from './api/clientsApi';
import InviteClientModal from './components/InviteClientModal';
import WeightHistoryChart from './components/WeightHistoryChart';
import WeightHistoryModal, { goalLabel, splitWeight } from './components/WeightHistoryModal';
import WorkoutDetailModal, {
  BAND_HEIGHT,
  setAccessibilityLabel,
  volumeUnit,
  workoutStatusPill,
  workoutVolumeText,
} from './components/WorkoutDetailModal';

// v2 Phase 5 M (p5l): the client workout / weight modals and the 4.1.0
// invite sheet: look, the VOLUME RULE, the goal label, teal change values,
// the tablet client-name eyebrow and large text.

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('./components/WeightHistoryChart', () => () => null);
jest.mock('./api/clientsApi', () => ({
  getClientWorkout: jest.fn(),
  listClientWeightLogs: jest.fn(),
  searchMembers: jest.fn(),
  inviteClient: jest.fn(),
}));
jest.mock('../../../shared/components/toastStore', () => ({ ...jest.requireActual('../../../shared/components/toastStore'), ToastTone: { success: 'success', error: 'error' }, addToast: jest.fn() }));

const flat = (node) => StyleSheet.flatten(node.props.style);
const hostAll = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const host = (tree, id) => hostAll(tree, id)[0];
const deepText = (node) =>
  []
    .concat(node.children ?? [])
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : deepText(child)))
    .join('');

function setWindow(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 1000, scale: 2, fontScale });
}

const mounted = [];
async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
});
beforeEach(() => setWindow(390));

const WORKOUT = {
  workout: {
    id: 3,
    status: 'completed',
    duration_seconds: 3120,
    total_volume: 99999,
    total_volume_kg: 1000,
    notes: 'Felt strong.',
    started_at: '2026-10-28T18:12:00Z',
    workout_plan_day: { title: 'Lower A' },
  },
  exercises: [
    {
      id: 11,
      exercise: { name: 'Back squat', thumbnail: { url: 'https://cdn.example.com/squat.jpg' }, primary_muscle_group: { code: 'quads' } },
      notes: 'Depth was good.',
      sets: [
        { id: 1, set_number: 1, actual_reps: 8, target_reps_min: 6, target_reps_max: 8, actual_weight_value: 185, actual_weight_unit: 'lb', is_completed: true },
        { id: 2, set_number: 2, actual_reps: null, target_reps_min: 10, target_reps_max: 10, actual_weight_value: null, is_completed: false },
      ],
    },
    { id: 12, exercise_name_snapshot: 'Lunge', sets: [] },
  ],
};

describe('client workout helpers', () => {
  it('the status pill: "completed" → success "Completed"; anything else as is on the neutral pill', () => {
    expect(workoutStatusPill('completed')).toEqual({ label: 'Completed', tone: 'completed' });
    expect(workoutStatusPill('in_progress')).toEqual({ label: 'In_progress', tone: 'neutral' });
    expect(workoutStatusPill(undefined)).toEqual({ label: '', tone: 'neutral' });
  });

  it('VOLUME RULE: total_volume_kg only, in the client unit (current → goal → kg); absent → hidden; never total_volume', () => {
    expect(volumeUnit({ current_weight_unit: 'lb', goal_weight_unit: 'kg' })).toBe('lb');
    expect(volumeUnit({ goal_weight_unit: 'lb' })).toBe('lb');
    expect(volumeUnit(null)).toBe('kg');
    expect(workoutVolumeText({ total_volume_kg: 1000 }, { current_weight_unit: 'lb' })).toBe(`${(2205).toLocaleString()} lb volume`);
    expect(workoutVolumeText({ total_volume_kg: 9840 }, null)).toBe(`${(9840).toLocaleString()} kg volume`);
    expect(workoutVolumeText({ total_volume: 9840 }, null)).toBeNull();
    expect(workoutVolumeText({ total_volume_kg: null }, null)).toBeNull();
    expect(workoutVolumeText({ total_volume_kg: 0 }, null)).toBe('0 kg volume');
  });

  it('a set row reads as one line, state in words', () => {
    expect(setAccessibilityLabel({ set_number: 1, actual_reps: 8, is_completed: true }, '6-8', '185 lb')).toBe('Set 1, 8 reps, target 6-8, 185 lb, done');
    expect(setAccessibilityLabel({ set_number: 2, actual_reps: null, is_completed: false }, null, '—')).toBe('Set 2, no reps, no weight, skipped');
  });
});

describe('Client workout modal (UX M)', () => {
  it('phone: day title 28/30, success "Completed" pill, "52 min" split, the volume in the client unit; the raw total_volume is never shown', async () => {
    getClientWorkout.mockResolvedValue(WORKOUT);
    const tree = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} profile={{ current_weight_unit: 'lb' }} clientName="Sara Lopez" />);
    expect(tree.root.findByType(AppModal).props.eyebrow).toBeUndefined();
    expect(deepText(host(tree, 'workout-detail-day'))).toBe('Lower A');
    expect(flat(host(tree, 'workout-detail-day'))).toMatchObject({ fontSize: 28, lineHeight: 30 });
    const pill = tree.root.find((node) => node.type === StatusPill && node.props.testID === 'workout-detail-status');
    expect([pill.props.label, pill.props.tone]).toEqual(['Completed', 'completed']);
    expect(deepText(host(tree, 'workout-detail-duration'))).toBe('52 min');
    expect(deepText(host(tree, 'workout-detail-volume'))).toBe(`${(2205).toLocaleString()} lb volume`);
    expect(JSON.stringify(tree.toJSON())).not.toContain('99,999');
    expect(deepText(host(tree, 'workout-detail-notes'))).toContain('Their notes');
  });

  it('no workout_plan_day (off-plan) → no day title; no total_volume_kg → no volume', async () => {
    getClientWorkout.mockResolvedValue({ ...WORKOUT, workout: { ...WORKOUT.workout, workout_plan_day: undefined, total_volume_kg: undefined } });
    const tree = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} />);
    expect(hostAll(tree, 'workout-detail-day')).toHaveLength(0);
    expect(hostAll(tree, 'workout-detail-volume')).toHaveLength(0);
  });

  it('exercise cards: the photo band (104) from exercise.thumbnail, else the initials tile; "0 sets" + "No sets logged."', async () => {
    getClientWorkout.mockResolvedValue(WORKOUT);
    const tree = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} />);
    const images = tree.root.findAllByType(ExerciseImage);
    expect(images.map((image) => image.props.size)).toEqual([BAND_HEIGHT.phone, BAND_HEIGHT.phone]);
    expect(images[0].props.exercise.thumbnail.url).toBe('https://cdn.example.com/squat.jpg');
    expect(hostAll(tree, 'workout-detail-image-12-initials')).toHaveLength(1);
    expect(flat(host(tree, 'workout-detail-exercise-11'))).toMatchObject({ borderRadius: radii.xl, backgroundColor: colors.surface });
    const text = deepText(tree.root);
    expect(text).toContain('2 sets');
    expect(text).toContain('0 sets');
    expect(text).toContain('No sets logged.');
  });

  it('set rows: one accessible line; "#1", " / 6-8 target", Done green / Skipped secondary', async () => {
    getClientWorkout.mockResolvedValue(WORKOUT);
    const tree = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} />);
    const row = host(tree, 'workout-detail-set-1');
    expect(row.props.accessibilityLabel).toBe('Set 1, 8 reps, target 6-8, 185 lb, done');
    expect(flat(row)).toMatchObject({ minHeight: 40, borderRadius: radii.md, backgroundColor: colors.fillChip });
    expect(deepText(row)).toBe('#18 reps / 6-8 target185 lbDone');
    expect(host(tree, 'workout-detail-set-2').props.accessibilityLabel).toBe('Set 2, no reps, target 10, no weight, skipped');
    const done = row.find((node) => node.type === 'Text' && node.props.children === 'Done');
    expect(flat(done).color).toBe(colors.success);
  });

  it('tablet: the client-name eyebrow, the day chip, bands 130 / 110, result pills', async () => {
    setWindow(834);
    getClientWorkout.mockResolvedValue(WORKOUT);
    const tree = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} clientName="Sara Lopez" />);
    expect(tree.root.findByType(AppModal).props.eyebrow).toBe('Sara Lopez');
    expect(flat(host(tree, 'workout-detail-day'))).toMatchObject({ minHeight: 30, borderRadius: radii.full });
    expect(tree.root.findAllByType(ExerciseImage).map((image) => image.props.size)).toEqual([BAND_HEIGHT.tabletFirst, BAND_HEIGHT.tablet]);
    expect(flat(host(tree, 'workout-detail-set-1')).backgroundColor).toBe(colors.fillWell);
  });

  it.each([1, 2, 3.1])('large text %s×: set rows wrap past 1.3; every text capped', async (scale) => {
    setWindow(390, scale);
    getClientWorkout.mockResolvedValue(WORKOUT);
    const tree = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} />);
    expect(flat(host(tree, 'workout-detail-set-1')).flexWrap).toBe(scale > textScale.reflowAbove ? 'wrap' : undefined);
    // Own texts only (the kit ExerciseImage initials are fixed chrome).
    const kitTexts = new Set(tree.root.findAllByType(ExerciseImage).flatMap((image) => image.findAll((node) => node.type === 'Text' && node.props.allowFontScaling === false)));
    tree.root
      .findAll((node) => node.type === 'Text' && !kitTexts.has(node))
      .forEach((node) => expect(node.props.numberOfLines === undefined || node.props.numberOfLines >= 2).toBe(true));
  });
});

const LOGS = [
  { id: 1, recorded_on: '2026-06-28', weight_value: 67.6, weight_unit: 'kg' },
  { id: 2, recorded_on: new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10), weight_value: 65.3, weight_unit: 'kg' },
  { id: 3, recorded_on: new Date(Date.now() - 864e5).toISOString().slice(0, 10), weight_value: 64.2, weight_unit: 'kg' },
];
const PROFILE = { current_weight_value: 64.2, current_weight_unit: 'kg', goal_weight_value: 60, goal_weight_unit: 'kg' };

describe('client weight helpers', () => {
  it('goalLabel: "Goal {n} {unit}"; no goal → null', () => {
    expect(goalLabel(PROFILE)).toBe('Goal 60 kg');
    expect(goalLabel({})).toBeNull();
    expect(goalLabel(null)).toBeNull();
  });

  it('splitWeight: the number and its unit; "—" whole', () => {
    expect(splitWeight('64.2 kg')).toEqual({ number: '64.2', unit: 'kg' });
    expect(splitWeight('—')).toEqual({ number: '—', unit: null });
  });
});

describe('Client weight modal (UX M)', () => {
  it('phone: Current hero (56/56 tabular), three tiles; change values TEAL with the code sign; the teal goal label', async () => {
    listClientWeightLogs.mockResolvedValue(LOGS);
    const tree = await render(<WeightHistoryModal isOpen clientUserId={7} profile={PROFILE} onClose={jest.fn()} clientName="Sara" />);
    expect(tree.root.findByType(AppModal).props.eyebrow).toBeUndefined();
    // T-64 (retires ⚠C-7): the list is newest first and the copy now says so.
    expect(tree.root.findByType(AppModal).props.description).toBe('Every weigh-in this client has logged, newest first.');
    const current = host(tree, 'weight-history-current');
    expect(current.props.accessibilityLabel).toBe('Current, 64.2 kg');
    expect(flat(current)).toMatchObject({ borderRadius: radii.xl });
    const value = current.findAll((node) => node.type === 'Text' && flat(node).fontSize === 56)[0];
    expect(flat(value).fontVariant).toEqual(['tabular-nums']);
    expect(deepText(host(tree, 'weight-history-30d-value'))).toBe('\u22121.1 kg');
    expect(flat(host(tree, 'weight-history-30d-value')).color).toBe(colors.teal);
    expect(deepText(host(tree, 'weight-history-total-value'))).toBe('\u22123.4 kg');
    expect(flat(host(tree, 'weight-history-total-value')).color).toBe(colors.teal);
    expect(host(tree, 'weight-history-goal').props.accessibilityLabel).toBe('Goal, 60 kg');
    expect(flat(host(tree, 'weight-history-goal-value')).color).toBe(colors.textPrimary);
    expect(deepText(host(tree, 'weight-history-goal-label'))).toBe('Goal 60 kg');
    expect(flat(host(tree, 'weight-history-goal-label')).color).toBe(colors.teal);
  });

  it('one log / no goal: deltas "—" in the neutral colour, no goal label, Goal "—"', async () => {
    listClientWeightLogs.mockResolvedValue([LOGS[2]]);
    const tree = await render(<WeightHistoryModal isOpen clientUserId={7} profile={{ current_weight_unit: 'kg' }} onClose={jest.fn()} />);
    expect(deepText(host(tree, 'weight-history-30d-value'))).toBe('—');
    expect(flat(host(tree, 'weight-history-30d-value')).color).toBe(colors.textPrimary);
    expect(deepText(host(tree, 'weight-history-goal-value'))).toBe('—');
    expect(hostAll(tree, 'weight-history-goal-label')).toHaveLength(0);
  });

  // Audit b1 PM decision (§C5.2, 27 Oct 2026): mixed kg/lb logs convert into
  // the chart unit (the profile's current unit) instead of "—".
  it('mixed lb → kg logs: the change tiles convert into the chart unit ("\u221212.2 kg"), never "—"', async () => {
    listClientWeightLogs.mockResolvedValue([
      { ...LOGS[2], id: 11, weight_value: 190, weight_unit: 'lb' },
      { ...LOGS[2], id: 12, weight_value: 74, weight_unit: 'kg' },
    ]);
    const tree = await render(<WeightHistoryModal isOpen clientUserId={7} profile={PROFILE} onClose={jest.fn()} />);
    expect(deepText(host(tree, 'weight-history-total-value'))).toBe('\u221212.2 kg');
    expect(deepText(host(tree, 'weight-history-30d-value'))).toBe('\u221212.2 kg');
  });

  // PM ruling (RN-SPEC TRAINER-CLIENTS, audit b4; exact web parity): the
  // CLIENT weight chart line is gold on the phone and teal on the tablet.
  it.each([
    [390, colors.gold],
    [834, colors.chartLine],
  ])('the client weight chart at %s draws its line in %s', async (width, color) => {
    setWindow(width);
    listClientWeightLogs.mockResolvedValue(LOGS);
    const tree = await render(<WeightHistoryModal isOpen clientUserId={7} profile={PROFILE} onClose={jest.fn()} />);
    expect(tree.root.findByType(WeightHistoryChart).props.lineColor).toBe(color);
  });

  it('positive change keeps the "+" (the sign carries the meaning)', async () => {
    listClientWeightLogs.mockResolvedValue([LOGS[2], { ...LOGS[2], id: 9, weight_value: 64.6 }]);
    const tree = await render(<WeightHistoryModal isOpen clientUserId={7} profile={PROFILE} onClose={jest.fn()} />);
    expect(deepText(host(tree, 'weight-history-total-value'))).toBe('+0.4 kg');
  });

  it('tablet: the eyebrow, Current left (72/72) beside Goal + Change, Total change as the wide row', async () => {
    setWindow(834);
    listClientWeightLogs.mockResolvedValue(LOGS);
    const tree = await render(<WeightHistoryModal isOpen clientUserId={7} profile={PROFILE} onClose={jest.fn()} clientName="Sara Lopez" />);
    // DECLARED change (FE batch 1 ruling, client weight modal ≥768): was
    // expect(tree.root.findByType(AppModal).props.eyebrow).toBe('Sara Lopez') (the gold 12/600 string eyebrow).
    // Now the client-name eyebrow is 13/600 secondary, ONE line + tail ellipsis, above "Weight history".
    const eyebrow = host(tree, 'weight-history-eyebrow');
    expect(deepText(eyebrow)).toBe('Sara Lopez');
    expect(eyebrow.props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' });
    expect(flat(eyebrow)).toMatchObject({ fontSize: 13, fontFamily: font(600).fontFamily, color: colors.textSecondary });
    const modalTexts = tree.root.findAll((node) => node.type === 'Text').map(deepText);
    expect(modalTexts.indexOf('Sara Lopez')).toBeLessThan(modalTexts.indexOf('Weight history'));
    const current = host(tree, 'weight-history-current');
    expect(current.findAll((node) => node.type === 'Text' && flat(node).fontSize === 72)).toHaveLength(1);
    expect(flat(host(tree, 'weight-history-total'))).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between' });
    expect(flat(host(tree, 'weight-history-goal'))).toMatchObject({ borderRadius: radii.lgPlus, backgroundColor: colors.fillWell });
  });

  it.each([1, 2, 3.1])('large text %s×: the three phone tiles stack past 1.3', async (scale) => {
    setWindow(390, scale);
    listClientWeightLogs.mockResolvedValue(LOGS);
    const tree = await render(<WeightHistoryModal isOpen clientUserId={7} profile={PROFILE} onClose={jest.fn()} />);
    expect(flat(host(tree, 'weight-history-tiles')).flexDirection).toBe(scale > textScale.reflowAbove ? 'column' : 'row');
    expect(host(tree, 'weight-history-current').findAll((node) => node.type === 'Text' && node.props.maxFontSizeMultiplier === textScale.display)).not.toHaveLength(0);
  });
});

describe('Invite client (UX M 4.1.0)', () => {
  const typeEmail = async (tree, text) => {
    jest.useFakeTimers();
    try {
      const input = tree.root.find((node) => node.type === 'TextInput');
      await act(async () => input.props.onChangeText(text));
      await act(async () => jest.advanceTimersByTime(350));
    } finally {
      jest.useRealTimers();
    }
    await act(async () => {});
  };

  it('phone: no eyebrow, the well field, Done default size; the match row (surface card, 15/600 email, compact Invite named "Invite {email}")', async () => {
    searchMembers.mockResolvedValue([{ id: 5, email: 'sara.lopez@example.com' }]);
    const tree = await render(<InviteClientModal isOpen onClose={jest.fn()} onInvited={jest.fn()} />);
    expect(tree.root.findByType(AppModal).props.eyebrow).toBeUndefined();
    expect(tree.root.find((node) => node.type === PillButton && node.props.testID === 'invite-done').props.size).toBe('default');
    await typeEmail(tree, 'sara.lopez@example.com');
    expect(flat(host(tree, 'invite-results'))).toMatchObject({ borderRadius: radii.lg, backgroundColor: colors.surface });
    const invite = tree.root.find((node) => node.type === PillButton && node.props.testID === 'invite-user-5');
    expect(invite.props).toMatchObject({ size: 'compact', variant: 'secondary', accessibilityLabel: 'Invite sara.lopez@example.com' });
  });

  it('after a successful invite the row shows "Invited" ✓ in success green (plain text)', async () => {
    searchMembers.mockResolvedValue([{ id: 5, email: 'sara.lopez@example.com' }]);
    inviteClient.mockResolvedValue({});
    const tree = await render(<InviteClientModal isOpen onClose={jest.fn()} onInvited={jest.fn()} />);
    await typeEmail(tree, 'sara.lopez@example.com');
    await act(async () => tree.root.find((node) => node.type === PillButton && node.props.testID === 'invite-user-5').props.onPress());
    const invited = host(tree, 'invite-invited-5');
    expect(deepText(invited)).toBe('Invited');
    expect(flat(invited.find((node) => node.type === 'Text')).color).toBe(colors.success);
  });

  it('tablet: the "Clients" eyebrow, Done at 60 (cta), the 24 list radius', async () => {
    setWindow(834);
    searchMembers.mockResolvedValue([{ id: 5, email: 'sara.lopez@example.com' }]);
    const tree = await render(<InviteClientModal isOpen onClose={jest.fn()} onInvited={jest.fn()} />);
    expect(tree.root.findByType(AppModal).props.eyebrow).toBe('Clients');
    expect(tree.root.find((node) => node.type === PillButton && node.props.testID === 'invite-done').props.size).toBe('cta');
    await typeEmail(tree, 'sara.lopez@example.com');
    expect(flat(host(tree, 'invite-results')).borderRadius).toBe(radii.xl);
  });
});

// P5 review M6: the Invite sheet's top gap is 50 (height − insets.top − 40 − 10).
describe('Invite sheet height (P5 review M6)', () => {
  it('asks AppModal for a 50 top gap', async () => {
    const tree = await render(<InviteClientModal isOpen onClose={jest.fn()} onInvited={jest.fn()} />);
    expect(tree.root.findByType(AppModal).props.sheetTopGap).toBe(50);
  });
});

// UX final audit X7 ruling (27 Oct 2026, §1.1): every name in a row, card or
// list is at most 2 lines then a tail ellipsis, no font shrink.
describe.each([390, 834])('X7 client workout modal (%i)', (width) => {
  const expectName = (node) => {
    expect(node.props).toMatchObject({ numberOfLines: 2, ellipsizeMode: 'tail' });
    expect(node.props.adjustsFontSizeToFit).toBeUndefined();
  };
  it('the exercise name: 2 lines + ellipsis', async () => {
    setWindow(width, 3.1);
    getClientWorkout.mockResolvedValue(WORKOUT);
    const tree = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} />);
    const nodes = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Back squat');
    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(expectName);
  });
});
