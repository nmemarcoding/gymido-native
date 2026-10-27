import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Line } from 'react-native-svg';
import { act, create } from 'react-test-renderer';

import AppModal from '../../../shared/components/AppModal';
import PillButton from '../../../shared/components/PillButton';
import { colors, radii, typography } from '../../../shared/theme/tokens';
import EndCoachingDialog, { END_COACHING_TILE } from '../../trainers/components/EndCoachingDialog';
import {
  endCoaching,
  getClientPlan,
  getClientProfile,
  getClientProfileAndEmail,
  getClientProgress,
  getClientWorkout,
  getClientWorkoutHistory,
  listClientAssignments,
  listClientWeightLogs,
} from './api/clientsApi';
import WeightHistoryChart from './components/WeightHistoryChart';
import WeightHistoryModal from './components/WeightHistoryModal';
import WorkoutDetailModal from './components/WorkoutDetailModal';
import ClientDetailContent from './screens/ClientDetailContent';
import ClientDetailScreen from './screens/ClientDetailScreen';
import { buildWeightSeries, goalInUnit } from './weightChartData';

// p5fix: review native-phase5-b65f8fc M1 (volume unit), M2 (client-name
// eyebrow via AppModal `eyebrow`), M6 (goal line, End coaching look).
// p56 merge: Phase 6 rebuilt Client detail; the page (phone / tablet) and the
// tablet Clients pane now render ClientDetailContent, which owns the modals,
// so the M1/M2/M6 Client-detail tests go through ClientDetailContent.

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ push: jest.fn(), navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) }),
  useRoute: () => ({ key: 'route-1', name: 'TrainerRoute', params: { clientUserId: 7 } }),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../shell/ShellPage', () => {
  const { View: MockView } = require('react-native');
  return ({ children }) => <MockView>{children}</MockView>;
});
jest.mock('../TrainerOnly', () => ({ children }) => children);
jest.mock('./clientLinks', () => ({ openClientDetail: jest.fn(), openAssignPlan: jest.fn() }));
jest.mock('./api/clientsApi', () => ({
  getClientProfileAndEmail: jest.fn(),
  endCoaching: jest.fn(),
  getClientPlan: jest.fn(),
  getClientProfile: jest.fn(),
  getClientProgress: jest.fn(),
  getClientWorkoutHistory: jest.fn(),
  listClientAssignments: jest.fn(),
  getClientWorkout: jest.fn(),
  listClientWeightLogs: jest.fn(),
}));
jest.mock('../../../shared/components/toastStore', () => ({ ...jest.requireActual('../../../shared/components/toastStore'), ToastTone: { success: 'success', error: 'error' }, addToast: jest.fn() }));

const flat = (node) => StyleSheet.flatten(node.props.style) ?? {};
const hostAll = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const textOf = (node) =>
  []
    .concat(node.props.children ?? [])
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
    .join('');
const allTexts = (tree) => tree.root.findAll((node) => node.type === 'Text').map(textOf);

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
  workout: { id: 3, status: 'completed', duration_seconds: 3120, total_volume: 99999, total_volume_kg: 1000, started_at: '2026-10-28T18:12:00Z' },
  exercises: [],
};

function loadClient(profile) {
  getClientPlan.mockResolvedValue(null);
  getClientProfile.mockResolvedValue(profile);
  getClientProfileAndEmail.mockResolvedValue({ profile, clientEmail: null });
  getClientProgress.mockResolvedValue(null);
  getClientWorkoutHistory.mockResolvedValue({ items: [{ id: 3, status: 'completed', started_at: '2026-10-28T18:12:00Z' }] });
  listClientAssignments.mockResolvedValue([]);
  getClientWorkout.mockResolvedValue(WORKOUT);
  listClientWeightLogs.mockResolvedValue([]);
}

async function openSession(tree) {
  const row = tree.root.find((node) => node.props.testID === 'client-session-3' && typeof node.props.onPress === 'function');
  await act(async () => row.props.onPress());
}

describe('AppModal `eyebrow` (M2)', () => {
  it('default: no eyebrow is rendered (other callers unchanged)', async () => {
    const tree = await render(<AppModal isOpen title="T" onClose={jest.fn()} />);
    expect(hostAll(tree, 'app-modal-eyebrow')).toHaveLength(0);
  });

  it.each([390, 834])('a string eyebrow (width %s): gold 12/600 text ABOVE the title, 6 above it', async (width) => {
    setWindow(width);
    const tree = await render(<AppModal isOpen title="Workout detail" onClose={jest.fn()} eyebrow="Sara Lopez" />);
    const [eyebrow] = hostAll(tree, 'app-modal-eyebrow');
    expect(textOf(eyebrow)).toBe('Sara Lopez');
    expect(flat(eyebrow)).toMatchObject({ fontSize: typography.eyebrow.fontSize, lineHeight: typography.eyebrow.lineHeight, color: colors.gold, marginBottom: 6 });
    expect(eyebrow.props.maxFontSizeMultiplier).toBeTruthy();
    const texts = tree.root.findAll((node) => node.type === 'Text').map(textOf);
    expect(texts.indexOf('Sara Lopez')).toBeLessThan(texts.indexOf('Workout detail'));
  });

  it('a node eyebrow is rendered as given, above the title', async () => {
    const tree = await render(<AppModal isOpen title="T" onClose={jest.fn()} eyebrow={<View testID="custom-eyebrow" />} />);
    expect(hostAll(tree, 'custom-eyebrow')).toHaveLength(1);
    expect(hostAll(tree, 'app-modal-eyebrow')).toHaveLength(1);
  });
});

describe('Client detail wires the client into its modals (M1 + M2), through ClientDetailContent', () => {
  const LB = { first_name: 'Sara', last_name: 'Lopez', current_weight_value: 150, current_weight_unit: 'lb' };
  const KG = { first_name: 'Ali', last_name: 'Reza', current_weight_value: 80, current_weight_unit: 'kg' };
  // The three ways in: the phone page, the tablet page, the tablet Clients pane.
  const PATHS = [
    ['phone page', 390, () => <ClientDetailScreen />],
    ['tablet page', 834, () => <ClientDetailScreen />],
    ['tablet pane', 834, () => <ClientDetailContent clientUserId={7} layout="pane" />],
  ];

  it.each(PATHS)('%s: the workout modal gets the client profile + the shown name; the weight modal the name too', async (_, width, element) => {
    setWindow(width);
    loadClient(LB);
    const tree = await render(element());
    expect(tree.root.findAllByType(ClientDetailContent)).toHaveLength(1);
    const workout = tree.root.findByType(WorkoutDetailModal);
    expect(workout.props.profile).toEqual(LB);
    expect(workout.props.clientName).toBe('Sara Lopez');
    expect(tree.root.findByType(WeightHistoryModal).props.clientName).toBe('Sara Lopez');
  });

  it.each(PATHS)('M1 (%s): an lb client reads the session volume in lb ("2,205 lb volume"), never kg or the raw total_volume', async (_, width, element) => {
    setWindow(width);
    loadClient(LB);
    const tree = await render(element());
    await openSession(tree);
    const [volume] = hostAll(tree, 'workout-detail-volume');
    expect(textOf(volume)).toBe('2,205 lb volume');
    expect(allTexts(tree).some((text) => /99,?999/.test(text))).toBe(false);
  });

  it.each(PATHS)('M1 (%s): a kg client reads it in kg ("1,000 kg volume")', async (_, width, element) => {
    setWindow(width);
    loadClient(KG);
    const tree = await render(element());
    await openSession(tree);
    expect(textOf(hostAll(tree, 'workout-detail-volume')[0])).toBe('1,000 kg volume');
    expect(allTexts(tree).some((text) => /99,?999/.test(text))).toBe(false);
  });

  it('M1: only a goal unit → that unit; the line is shown (never hidden while total_volume_kg exists)', async () => {
    loadClient({ first_name: 'Sam', goal_weight_value: 140, goal_weight_unit: 'lb' });
    const tree = await render(<ClientDetailScreen />);
    await openSession(tree);
    expect(textOf(hostAll(tree, 'workout-detail-volume')[0])).toBe('2,205 lb volume');
  });

  it('M2: on tablet (page and pane) the workout modal shows the client-name eyebrow; on phone it does not', async () => {
    setWindow(834);
    loadClient(LB);
    const tablet = await render(<ClientDetailScreen />);
    await openSession(tablet);
    expect(hostAll(tablet, 'app-modal-eyebrow').map(textOf)).toContain('Sara Lopez');
    loadClient(LB);
    const pane = await render(<ClientDetailContent clientUserId={7} layout="pane" />);
    await openSession(pane);
    expect(hostAll(pane, 'app-modal-eyebrow').map(textOf)).toContain('Sara Lopez');
    setWindow(390);
    loadClient(LB);
    const phone = await render(<ClientDetailScreen />);
    await openSession(phone);
    expect(hostAll(phone, 'app-modal-eyebrow')).toHaveLength(0);
  });
});

describe('Weight chart goal line (M6, UX M ruling 1 + §9a)', () => {
  const LOGS = [
    { recorded_on: '2026-09-01', weight_value: 80, weight_unit: 'kg' },
    { recorded_on: '2026-09-20', weight_value: 78, weight_unit: 'kg' },
  ];

  it('goalInUnit: the goal converted into the chart unit; no goal → null', () => {
    expect(goalInUnit({ goal_weight_value: 70, goal_weight_unit: 'kg' }, 'kg')).toBe(70);
    expect(goalInUnit({ goal_weight_value: 154, goal_weight_unit: 'lb' }, 'kg')).toBeCloseTo(69.85, 2);
    expect(goalInUnit({ goal_weight_value: null }, 'kg')).toBeNull();
    expect(goalInUnit({ goal_weight_value: '' }, 'kg')).toBeNull();
    expect(goalInUnit(null, 'kg')).toBeNull();
  });

  it('with the goal: the axis widens to keep the goal inside, whole-number ticks, ≤ 1 unit padding', () => {
    const series = buildWeightSeries(LOGS, { current_weight_value: 78, current_weight_unit: 'kg', goal_weight_value: 70, goal_weight_unit: 'kg' }, undefined, { withGoal: true });
    expect(series.goal).toBe(70);
    expect(series.min).toBeLessThanOrEqual(69);
    expect(series.max).toBeGreaterThanOrEqual(81);
    expect(series.ticks.every((tick) => Number.isInteger(tick))).toBe(true);
    // 69 … 81 → step 5 → 65 … 85.
    expect([series.min, series.max]).toEqual([65, 85]);
  });

  it('without the option (Progress) or without a goal: no goal and today\'s axis', () => {
    const profile = { current_weight_value: 78, current_weight_unit: 'kg', goal_weight_value: 70, goal_weight_unit: 'kg' };
    const plain = buildWeightSeries(LOGS, profile);
    expect(plain.goal).toBeNull();
    expect([plain.min, plain.max]).toEqual([77, 81]);
    const noGoal = buildWeightSeries(LOGS, { current_weight_value: 78, current_weight_unit: 'kg' }, undefined, { withGoal: true });
    expect(noGoal.goal).toBeNull();
    expect([noGoal.min, noGoal.max]).toEqual([77, 81]);
  });

  async function chart(props) {
    const tree = await render(<WeightHistoryChart logs={LOGS} {...props} />);
    const wrap = tree.root.find((node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function');
    await act(async () => wrap.props.onLayout({ nativeEvent: { layout: { width: 320 } } }));
    return tree;
  }

  it('the chart draws ONE dashed teal goal line (0.6, dash 4 5) across the plot when `showGoal`', async () => {
    const tree = await chart({ profile: { current_weight_value: 78, current_weight_unit: 'kg', goal_weight_value: 70, goal_weight_unit: 'kg' }, showGoal: true });
    const lines = tree.root.findAll((node) => node.type === Line && node.props.testID === 'weight-chart-goal-line');
    expect(lines).toHaveLength(1);
    expect(lines[0].props).toMatchObject({ stroke: colors.tealStrong, strokeDasharray: '4 5', x1: 44, x2: 308 });
    expect(lines[0].props.y1).toBe(lines[0].props.y2);
  });

  it('no goal line on Progress (no showGoal) or when the client has no goal', async () => {
    const progress = await chart({ unit: 'kg', profile: { goal_weight_value: 70, goal_weight_unit: 'kg' } });
    expect(progress.root.findAll((node) => node.props.testID === 'weight-chart-goal-line')).toHaveLength(0);
    const none = await chart({ profile: { current_weight_value: 78, current_weight_unit: 'kg' }, showGoal: true });
    expect(none.root.findAll((node) => node.props.testID === 'weight-chart-goal-line')).toHaveLength(0);
  });

  // T-61 C: the tooltip date reads like the board's chart dates
  // (TabletClientWeightModal: 13 px, muted, regular, sentence case).
  it('the tooltip label is sentence case 13 / muted / regular, not tracked caps', async () => {
    const tree = await chart({ unit: 'kg' });
    const wrap = tree.root.find((node) => typeof node.type === 'string' && typeof node.props.onResponderGrant === 'function');
    await act(async () => wrap.props.onResponderGrant({ nativeEvent: { locationX: 44 } }));
    const tooltip = tree.root.find((node) => typeof node.type === 'string' && node.props.pointerEvents === 'none' && typeof node.props.onLayout === 'function');
    const [label] = tooltip.findAll((node) => node.type === 'Text');
    const style = StyleSheet.flatten(label.props.style);
    expect(style).toMatchObject({ fontSize: 13, lineHeight: 18, fontWeight: '400', color: colors.textMuted });
    expect(style.textTransform).toBeUndefined();
    expect(style.letterSpacing ?? 0).toBe(0);
  });

  // UX ruling (T-61): the kit tooltip CONTAINER (one tooltip look app-wide,
  // as the rail tip) with the board's date label, then the value 15/600
  // primary tabular.
  it('the tooltip is the kit tooltip container; the value is 15/600 primary tabular', async () => {
    const { shadows } = require('../../../shared/theme/tokens');
    const tree = await chart({ unit: 'kg' });
    const wrap = tree.root.find((node) => typeof node.type === 'string' && typeof node.props.onResponderGrant === 'function');
    await act(async () => wrap.props.onResponderGrant({ nativeEvent: { locationX: 44 } }));
    const tooltip = tree.root.find((node) => typeof node.type === 'string' && node.props.pointerEvents === 'none' && typeof node.props.onLayout === 'function');
    expect(StyleSheet.flatten(tooltip.props.style)).toMatchObject({
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      boxShadow: shadows.float,
    });
    const [, value] = tooltip.findAll((node) => node.type === 'Text');
    expect(StyleSheet.flatten(value.props.style)).toMatchObject({ fontSize: 15, color: colors.textPrimary, fontVariant: ['tabular-nums'], fontFamily: 'Geist-SemiBold' });
  });

  it('the client weight modal asks for the goal line', async () => {
    listClientWeightLogs.mockResolvedValue(LOGS);
    const profile = { current_weight_value: 78, current_weight_unit: 'kg', goal_weight_value: 70, goal_weight_unit: 'kg' };
    const tree = await render(<WeightHistoryModal isOpen clientUserId={7} profile={profile} onClose={jest.fn()} />);
    expect(tree.root.findByType(WeightHistoryChart).props).toMatchObject({ showGoal: true, profile });
  });
});

describe('End coaching dialog look (M6, UX L End coaching / M End coaching client)', () => {
  const base = {
    testID: 'ecd',
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'End coaching?',
    description: 'You keep your current plan.',
    confirmLabel: 'End coaching',
  };
  const button = (tree, id) => tree.root.find((node) => node.type === PillButton && node.props.testID === id);

  it('phone (member): danger-text icon tile 56 r20 (board 18: no token) via the eyebrow slot (hidden from AT), danger 60 over Cancel 56', async () => {
    const tree = await render(<EndCoachingDialog {...base} variant="member" />);
    const [tile] = hostAll(tree, 'ecd-icon');
    expect(flat(tile)).toMatchObject({ width: 56, height: 56, borderRadius: radii.lg, backgroundColor: colors.dangerTint, marginBottom: 16 });
    expect(tile.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(tile.props.accessibilityElementsHidden).toBe(true);
    expect(hostAll(tree, 'app-modal-eyebrow')).toHaveLength(1);
    expect(button(tree, 'ecd-confirm').props).toMatchObject({ variant: 'danger', size: 'cta', fullWidth: true });
    expect(StyleSheet.flatten(button(tree, 'ecd-cancel').props.style)).toMatchObject({ minHeight: 56 });
    expect(button(tree, 'ecd-cancel').props).toMatchObject({ variant: 'secondary', fullWidth: true });
    // Verb first on the phone sheet: column-reverse with [Cancel, verb].
    const actions = hostAll(tree, 'ecd-actions')[0];
    expect(flat(actions)).toMatchObject({ flexDirection: 'column-reverse', gap: 10 });
  });

  it('phone (client): the 72 r24 tile; both buttons 56', async () => {
    const tree = await render(<EndCoachingDialog {...base} variant="client" />);
    expect(flat(hostAll(tree, 'ecd-icon')[0])).toMatchObject({ width: 72, height: 72, borderRadius: radii.xl });
    for (const id of ['ecd-confirm', 'ecd-cancel']) {
      expect(StyleSheet.flatten(button(tree, id).props.style)).toMatchObject({ minHeight: 56 });
    }
  });

  it.each([
    ['member', 64, radii.lg, 1.4],
    ['client', 76, radii.xl, 1.3],
  ])('tablet (%s): tile %s r%s, a row Cancel left (flex 1) · End coaching right (flex %s), both 60', async (variant, size, radius, grow) => {
    setWindow(834);
    const tree = await render(<EndCoachingDialog {...base} variant={variant} />);
    expect(flat(hostAll(tree, 'ecd-icon')[0])).toMatchObject({ width: size, height: size, borderRadius: radius });
    const actions = hostAll(tree, 'ecd-actions')[0];
    expect(flat(actions)).toMatchObject({ flexDirection: 'row', gap: 12 });
    const [cancelCell, confirmCell] = actions.children;
    expect([flat(cancelCell).flex, flat(confirmCell).flex]).toEqual([1, grow]);
    expect(button(tree, 'ecd-cancel').props.size).toBe('cta');
    expect(button(tree, 'ecd-confirm').props.size).toBe('cta');
    expect(cancelCell.findAll((node) => node.type === PillButton)[0].props.testID).toBe('ecd-cancel');
    // DECLARED (27 Oct 2026, RN-SPEC-my-trainer MT2 audit b2, UX R2-5): was 1 Close for the member. Now no ✕ on
    // either End coaching dialog at any width (the footer Cancel is the dismiss).
    expect(hostAll(tree, 'app-modal-close')).toHaveLength(0);
  });

  it('tablet at large text (> 1.3): the actions stack like the phone', async () => {
    setWindow(834, 2);
    const tree = await render(<EndCoachingDialog {...base} variant="member" />);
    expect(flat(hostAll(tree, 'ecd-actions')[0]).flexDirection).toBe('column-reverse');
  });

  it('actions: confirm calls onConfirm; Cancel calls onClose; loading → the verb is loading; no dismiss while not dismissible', async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    const tree = await render(<EndCoachingDialog {...base} onClose={onClose} onConfirm={onConfirm} loading />);
    expect(button(tree, 'ecd-confirm').props.loading).toBe(true);
    act(() => button(tree, 'ecd-confirm').props.onPress());
    act(() => button(tree, 'ecd-cancel').props.onPress());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType(AppModal).props).toMatchObject({ title: 'End coaching?', description: 'You keep your current plan.', size: 'md' });
    const locked = jest.fn();
    const busy = await render(<EndCoachingDialog {...base} onClose={locked} dismissible={false} />);
    act(() => button(busy, 'ecd-cancel').props.onPress());
    act(() => busy.root.findByType(AppModal).props.onClose());
    expect(locked).not.toHaveBeenCalled();
  });

  it('the icon tile Svg is explicitly sized; the tile size table is exported', async () => {
    const tree = await render(<EndCoachingDialog {...base} />);
    const svg = tree.root.findAll((node) => node.props.viewBox === '0 0 24 24')[0];
    expect([svg.props.width, svg.props.height]).toEqual([26, 26]);
    expect(END_COACHING_TILE.member.phone.size).toBe(56);
  });

  it.each([
    ['the page', () => <ClientDetailScreen />],
    ['the tablet pane', () => <ClientDetailContent clientUserId={7} layout="pane" />],
  ])('Client detail (%s, via ClientDetailContent) uses it (same testID as before; My trainer: TrainerHubScreen.test)', async (_, element) => {
    loadClient({ first_name: 'Sara' });
    getClientPlan.mockResolvedValue(null);
    endCoaching.mockResolvedValue({});
    const tree = await render(element());
    const dialog = tree.root.findByType(EndCoachingDialog);
    expect(dialog.props).toMatchObject({ testID: 'end-coaching-dialog', variant: 'client', title: 'End coaching with this client?', confirmLabel: 'End coaching' });
  });
});


describe('Phone footer buttons 56 (RN-SPEC-v2-phase5 §4; review LOW)', () => {
  const button = (tree, id) => tree.root.find((node) => node.type === PillButton && node.props.testID === id);

  it('phone: workout Close, weight Close and Invite Done are 56 tall', async () => {
    getClientWorkout.mockResolvedValue(WORKOUT);
    listClientWeightLogs.mockResolvedValue([]);
    const workout = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} />);
    expect(StyleSheet.flatten(button(workout, 'workout-detail-close').props.style)).toMatchObject({ minHeight: 56 });
    const weight = await render(<WeightHistoryModal isOpen clientUserId={7} profile={null} onClose={jest.fn()} />);
    expect(StyleSheet.flatten(button(weight, 'weight-history-close').props.style)).toMatchObject({ minHeight: 56 });
    const InviteClientModal = require('./components/InviteClientModal').default;
    const invite = await render(<InviteClientModal isOpen onClose={jest.fn()} />);
    expect(StyleSheet.flatten(button(invite, 'invite-done').props.style)).toMatchObject({ minHeight: 56 });
  });

  it('tablet: unchanged (Invite Done cta 60; the Close buttons have no phone height)', async () => {
    setWindow(834);
    getClientWorkout.mockResolvedValue(WORKOUT);
    const workout = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} />);
    expect(button(workout, 'workout-detail-close').props.style).toBeUndefined();
    const InviteClientModal = require('./components/InviteClientModal').default;
    const invite = await render(<InviteClientModal isOpen onClose={jest.fn()} />);
    expect(button(invite, 'invite-done').props).toMatchObject({ size: 'cta', style: undefined });
  });
});
