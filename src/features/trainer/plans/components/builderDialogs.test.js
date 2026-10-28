let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: mockFontScale }),
}));

import { StyleSheet, Text, TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';

import FormField from '../../../../shared/components/FormField';
import PillButton from '../../../../shared/components/PillButton';
import SegmentedSwitch from '../../../../shared/components/SegmentedSwitch';
import { useSheetFocus } from '../../../../shared/hooks/useSheetFocus';
import { colors, textScale } from '../../../../shared/theme/tokens';
import { PlanAction } from '../planActions';
import { MEMBER_PLAN_TEXT } from '../../../myPlans/memberPlanAdapter';
import { TRAINER_PLAN_TEXT } from '../trainerPlanAdapter';
import AddDayModal from './AddDayModal';
import AddSetModal from './AddSetModal';
import { AffectsNoticeBox, ClientsBanner } from './AffectedClients';
import { BackLink, DangerTintButton, TextAction, WarningNotice } from './builderParts';
import DayListCard from './DayListCard';
import DayTabs, { SelectedDayStrip } from './DayTabs';
import EditPlanDetailsModal from './EditPlanDetailsModal';
import PlanActionDialog from './PlanActionDialog';
import PlanOverflowSheet, { OVERFLOW_HANDOFF_MS, overflowLabel } from './PlanOverflowSheet';
import SetList from './SetList';

// UX phase4 I §0.2-§0.4 and §4-13: the builder dialogs and small parts, per
// state (default, pressed, disabled, loading, error, phone vs tablet, §9).

jest.mock('../../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../../../shared/hooks/useSheetFocus', () => ({ useSheetFocus: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

const nodeMock = () => ({ focus: jest.fn() });

async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element, { createNodeMock: nodeMock });
  });
  return tree;
}

const hosts = (tree, id) => tree.root.findAll((node) => typeof node.type === 'string' && node.props.testID === id);
const host = (tree, id) => hosts(tree, id)[0];
const pill = (tree, id) => tree.root.findAll((node) => node.type === PillButton && node.props.testID === id)[0];
const tap = (tree, id) => host(tree, id);
const renderFn = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.children === 'function')[0];
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const allText = (tree) =>
  tree.root
    .findAll((node) => node.type === Text)
    .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string' || typeof part === 'number').join(''));
const input = (tree, id) => tree.root.findAll((node) => node.type === TextInput && node.props.testID === id)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  mockFontScale = 1;
});

describe('PlanActionDialog (UX I §10-13)', () => {
  const deleteDay = { type: PlanAction.deleteDay, day: { id: 1, day_number: 2 }, running: false, error: null };

  it('danger tone: the solid danger action (60) after Cancel; focus starts on Cancel', async () => {
    const tree = await render(<PlanActionDialog action={deleteDay} text={MEMBER_PLAN_TEXT} affectedCount={null} onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(allText(tree)).toEqual(expect.arrayContaining(['Delete Day 2?', 'This removes the day with its exercises and sets. It can’t be undone.']));
    const confirm = pill(tree, 'plan-action-dialog-confirm');
    expect(confirm.props).toMatchObject({ title: 'Delete day', variant: 'danger', size: 'cta' });
    const cancel = pill(tree, 'plan-action-dialog-cancel');
    expect(cancel.props.size).toBe('default');
    const [open, options] = useSheetFocus.mock.calls.at(-1);
    expect(open).toBe(true);
    expect(options.initialRef).toBe(cancel.props.ref);
    // Cancel is first in the reading order (the phone column draws it last).
    const order = tree.root.findAll((node) => node.type === PillButton).map((node) => node.props.testID);
    expect(order).toEqual(['plan-action-dialog-cancel', 'plan-action-dialog-confirm']);
  });

  it('brand tone (deactivate): the gold action; the refused 409 line under the body', async () => {
    const action = { type: PlanAction.deactivateRefused, running: false, error: null, refusedMessage: 'It has history.' };
    const tree = await render(<PlanActionDialog action={action} text={TRAINER_PLAN_TEXT} affectedCount={2} onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(pill(tree, 'plan-action-dialog-confirm').props).toMatchObject({ title: 'Deactivate plan', variant: 'primary' });
    expect(allText(tree)).toEqual(expect.arrayContaining(['It has history.', 'This affects 2 clients. Changes apply from their next workout; past and in-progress workouts stay as they are.']));
  });

  it('loading: the action spins; Cancel / scrim / back do nothing', async () => {
    const onClose = jest.fn();
    const tree = await render(<PlanActionDialog action={{ ...deleteDay, running: true }} text={MEMBER_PLAN_TEXT} onClose={onClose} onConfirm={jest.fn()} />);
    expect(pill(tree, 'plan-action-dialog-confirm').props.loading).toBe(true);
    pill(tree, 'plan-action-dialog-cancel').props.onPress();
    tree.root.find((node) => node.props.testID === 'plan-action-dialog' && node.props.isOpen !== undefined).props.onClose();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('error box: phone = the 4 % well; tablet = the danger tint + icon; an alert', async () => {
    const error = { title: 'That didn’t work. Please try again.', message: 'Server text' };
    let tree = await render(<PlanActionDialog action={{ ...deleteDay, error }} text={MEMBER_PLAN_TEXT} onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(host(tree, 'plan-action-error').props.accessibilityRole).toBe('alert');
    expect(flat(host(tree, 'plan-action-error')).backgroundColor).toBe(colors.fillWell);
    mockWidth = 834;
    tree = await render(<PlanActionDialog action={{ ...deleteDay, error }} text={MEMBER_PLAN_TEXT} onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(flat(host(tree, 'plan-action-error'))).toMatchObject({ backgroundColor: colors.dangerFaint, borderColor: colors.dangerLine });
    expect(pill(tree, 'plan-action-dialog-cancel').props.size).toBe('cta');
  });

  it('closed: nothing open', async () => {
    const tree = await render(<PlanActionDialog action={null} text={MEMBER_PLAN_TEXT} onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(tree.root.find((node) => node.props.testID === 'plan-action-dialog' && node.props.isOpen !== undefined).props.isOpen).toBe(false);
  });
});

describe('AddDayModal (UX I §4-5)', () => {
  const context = { nextDayNumber: 4, dayLimit: 5, canAddDay: true };

  it('phone: the flat gold number card with the decorative numeral and the code sentence', async () => {
    const tree = await render(<AddDayModal isOpen onClose={jest.fn()} context={context} day={null} onSubmit={jest.fn()} />);
    expect(flat(host(tree, 'day-number-card')).backgroundColor).toBe(colors.gold);
    expect(allText(tree)).toEqual(expect.arrayContaining(['Day number:  will be assigned automatically.', '4']));
    expect(input(tree, 'plan-day-description').props.placeholder).toBe('What this day focuses on');
    expect(useSheetFocus).toHaveBeenCalledWith(true, expect.objectContaining({ initialRef: expect.any(Object) }));
  });

  it('tablet: the gold-tint card with the gold 72 tile; 60 buttons', async () => {
    mockWidth = 834;
    const tree = await render(<AddDayModal isOpen onClose={jest.fn()} context={context} day={null} onSubmit={jest.fn()} />);
    expect(flat(host(tree, 'day-number-card'))).toMatchObject({ backgroundColor: colors.goldTint, borderColor: colors.goldLine });
    expect(pill(tree, 'day-modal-submit').props.size).toBe('cta');
  });

  it('day limit: the flat card, the limit copy, Add day disabled', async () => {
    const tree = await render(<AddDayModal isOpen onClose={jest.fn()} context={{ nextDayNumber: 4, dayLimit: 3, canAddDay: false }} day={null} onSubmit={jest.fn()} />);
    expect(flat(host(tree, 'day-number-card')).backgroundColor).toBe(colors.fillWell);
    expect(allText(tree)).toEqual(expect.arrayContaining(['This plan already has all 3\u00a0days.']));
    expect(pill(tree, 'day-modal-submit').props.disabled).toBe(true);
  });

  it('blank name: the error under the field, focus moves to it, no request', async () => {
    const onSubmit = jest.fn();
    const tree = await render(<AddDayModal isOpen onClose={jest.fn()} context={context} day={null} onSubmit={onSubmit} />);
    await act(async () => pill(tree, 'day-modal-submit').props.onPress());
    expect(tree.root.findAll((node) => node.type === FormField && node.props.testID === 'plan-day-title')[0].props.error).toBe('Day title is required.');
    expect(input(tree, 'plan-day-title').instance.focus).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('saving: the action spins until the request settles; payload as v1', async () => {
    let resolve;
    const onSubmit = jest.fn(() => new Promise((done) => (resolve = done)));
    const tree = await render(<AddDayModal isOpen onClose={jest.fn()} context={context} day={null} onSubmit={onSubmit} />);
    await act(async () => input(tree, 'plan-day-title').props.onChangeText('Upper B'));
    await act(async () => {
      pill(tree, 'day-modal-submit').props.onPress();
    });
    expect(pill(tree, 'day-modal-submit').props.loading).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith({ day_number: 4, title: 'Upper B', description: '' });
    await act(async () => resolve());
    expect(pill(tree, 'day-modal-submit').props.loading).toBe(false);
  });

  it('edit mode: no number card, the notice first, Update day disabled until a change', async () => {
    const day = { id: 1, day_number: 2, title: 'Pull', description: '' };
    const tree = await render(<AddDayModal isOpen onClose={jest.fn()} context={context} day={day} affectedCount={1} onSubmit={jest.fn()} />);
    expect(hosts(tree, 'day-number-card')).toHaveLength(0);
    expect(host(tree, 'affects-notice')).toBeTruthy();
    expect(pill(tree, 'day-modal-submit').props).toMatchObject({ title: 'Update day', disabled: true });
    await act(async () => input(tree, 'plan-day-title').props.onChangeText('Pull B'));
    expect(pill(tree, 'day-modal-submit').props.disabled).toBe(false);
  });
});

describe('AddSetModal (UX I §6-7)', () => {
  it('phone: the gold numeral tile row, reps min | max side by side, the lb / kg radio switch', async () => {
    const tree = await render(<AddSetModal isOpen onClose={jest.fn()} nextSetNumber={3} set={null} onSubmit={jest.fn()} />);
    expect(host(tree, 'set-number-box')).toBeTruthy();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Set number:  will be assigned automatically.']));
    const unit = tree.root.findByType(SegmentedSwitch);
    expect(unit.props).toMatchObject({ value: 'lb', segmentRole: 'radio', accessibilityLabel: 'Unit' });
    await act(async () => unit.props.onChange('kg'));
    expect(tree.root.findByType(SegmentedSwitch).props.value).toBe('kg');
    const reps = input(tree, 'set-reps-min');
    expect(reps.props.keyboardType).toBe('number-pad');
    expect(input(tree, 'set-weight').props.keyboardType).toBe('decimal-pad');
  });

  it('errors under their own field and focus to the first invalid one', async () => {
    const tree = await render(<AddSetModal isOpen onClose={jest.fn()} nextSetNumber={1} set={null} onSubmit={jest.fn()} />);
    await act(async () => input(tree, 'set-rest').props.onChangeText('-4'));
    await act(async () => pill(tree, 'set-modal-submit').props.onPress());
    const errorOf = (id) => tree.root.findAll((node) => node.type === FormField && node.props.testID === id)[0].props.error;
    expect(errorOf('set-reps-min')).toBe('At least reps or weight must be specified.');
    expect(errorOf('set-rest')).toBe('Rest seconds must be a positive number.');
    expect(input(tree, 'set-reps-min').instance.focus).toHaveBeenCalled();
    // Editing a field clears its error.
    await act(async () => input(tree, 'set-rest').props.onChangeText('90'));
    expect(errorOf('set-rest')).toBeUndefined();
  });

  it('submits the v1 payload with the next set number', async () => {
    const onSubmit = jest.fn(() => Promise.resolve());
    const tree = await render(<AddSetModal isOpen onClose={jest.fn()} nextSetNumber={3} set={null} onSubmit={onSubmit} />);
    await act(async () => input(tree, 'set-reps-min').props.onChangeText('8'));
    await act(async () => input(tree, 'set-weight').props.onChangeText('82,5'));
    await act(async () => pill(tree, 'set-modal-submit').props.onPress());
    expect(onSubmit).toHaveBeenCalledWith({ set_number: 3, target_reps_min: 8, target_weight_value: 82.5, target_weight_unit: 'lb' });
  });

  it('edit mode: the Set number field replaces the box; Update set disabled until a change', async () => {
    const set = { id: 1, set_number: 2, target_reps_min: 5, rest_seconds: 90 };
    const tree = await render(<AddSetModal isOpen onClose={jest.fn()} nextSetNumber={3} set={set} affectedCount={4} onSubmit={jest.fn()} />);
    expect(hosts(tree, 'set-number-box')).toHaveLength(0);
    expect(input(tree, 'set-number').props.value).toBe('2');
    expect(pill(tree, 'set-modal-submit').props).toMatchObject({ title: 'Update set', disabled: true });
    expect(host(tree, 'affects-notice')).toBeTruthy();
  });

  it('tablet: the gold-tint set card and the 2×2 grid (weight | rest on one row)', async () => {
    mockWidth = 834;
    const tree = await render(<AddSetModal isOpen onClose={jest.fn()} nextSetNumber={3} set={null} onSubmit={jest.fn()} />);
    expect(flat(host(tree, 'set-number-box')).backgroundColor).toBe(colors.goldFaint);
    expect(flat(host(tree, 'set-weight-rest-row')).flexDirection).toBe('row');
  });

  it.each([1, 2, 3.1])('§9 at %s×: the reps pair stacks past 1.3×', async (scale) => {
    mockFontScale = scale;
    const tree = await render(<AddSetModal isOpen onClose={jest.fn()} nextSetNumber={3} set={null} onSubmit={jest.fn()} />);
    expect(flat(host(tree, 'set-reps-row')).flexDirection ?? 'column').toBe(scale > textScale.reflowAbove ? 'column' : 'row');
  });
});

describe('EditPlanDetailsModal (UX I §8-9)', () => {
  const plan = { name: 'Plan', category_id: 2, days_per_week: 4, description: '' };
  const props = { isOpen: true, onClose: jest.fn(), plan, dayCount: 3, categories: [{ id: 2, name: 'Strength' }], levels: [], description: 'Changes apply from your next workout.' };

  it('days per week = a radio group of 7 chips; below the day count disabled; the helper', async () => {
    const tree = await render(<EditPlanDetailsModal {...props} onSubmit={jest.fn()} />);
    expect(host(tree, 'edit-plan-days').props).toMatchObject({ accessibilityRole: 'radiogroup', accessibilityLabel: 'Days per week' });
    const chip = (n) => pressable(tree, `edit-plan-days-${n}`);
    expect(chip(2).props.accessibilityState).toEqual({ checked: false, disabled: true });
    expect(chip(4).props.accessibilityState).toEqual({ checked: true, disabled: false });
    expect(flat(chip(4))).toMatchObject({ backgroundColor: colors.gold });
    expect(allText(tree)).toEqual(expect.arrayContaining(['At least 3 — the plan already has that many days.']));
    expect(input(tree, 'edit-plan-description').props.placeholder).toBe('Who this plan is for');
  });

  it('Save changes enables after a change and sends only that field', async () => {
    const onSubmit = jest.fn(() => Promise.resolve(null));
    const tree = await render(<EditPlanDetailsModal {...props} onSubmit={onSubmit} />);
    expect(pill(tree, 'edit-plan-save').props.disabled).toBe(true);
    await act(async () => pressable(tree, 'edit-plan-days-6').props.onPress());
    expect(pill(tree, 'edit-plan-save').props.disabled).toBe(false);
    await act(async () => pill(tree, 'edit-plan-save').props.onPress());
    expect(onSubmit).toHaveBeenCalledWith({ days_per_week: 6 });
  });

  it('a blank name: "Name is required." and focus to Name; 422 field errors inline', async () => {
    const onSubmit = jest.fn(() => Promise.resolve({ category_id: 'Pick one.' }));
    const tree = await render(<EditPlanDetailsModal {...props} onSubmit={onSubmit} />);
    await act(async () => input(tree, 'edit-plan-name').props.onChangeText(' '));
    await act(async () => pill(tree, 'edit-plan-save').props.onPress());
    expect(input(tree, 'edit-plan-name').instance.focus).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () => input(tree, 'edit-plan-name').props.onChangeText('New'));
    await act(async () => pill(tree, 'edit-plan-save').props.onPress());
    const select = tree.root.findAll((node) => node.props.testID === 'edit-plan-category' && node.props.options)[0];
    expect(select.props.error).toBe('Pick one.');
  });

  it('tablet: 56 chips; reflow stacks Category | Difficulty', async () => {
    mockWidth = 834;
    let tree = await render(<EditPlanDetailsModal {...props} onSubmit={jest.fn()} />);
    expect(flat(tap(tree, 'edit-plan-days-4')).minHeight).toBe(56);
    mockFontScale = 3.1;
    tree = await render(<EditPlanDetailsModal {...props} onSubmit={jest.fn()} />);
    expect(flat(host(tree, 'edit-plan-select-row')).flexDirection).toBeUndefined();
  });
});

describe('PlanOverflowSheet', () => {
  it('lists the actions; a row closes the sheet, then runs after the exit', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const run = jest.fn();
    const items = [
      { key: 'edit-details', label: 'Edit details', onPress: run, testID: 'o-edit' },
      { key: 'delete', label: 'Delete plan', tone: 'danger', onPress: jest.fn(), testID: 'o-delete' },
      { key: 'make-copy', label: 'Make a copy', loading: true, onPress: jest.fn(), testID: 'o-copy' },
    ];
    expect(overflowLabel(items)).toBe('More plan actions: Edit details, Delete plan, Make a copy');
    const tree = await render(<PlanOverflowSheet isOpen onClose={onClose} items={items} />);
    expect(pressable(tree, 'o-copy').props.disabled).toBe(true);
    const danger = tree.root.find((node) => node.type === Text && node.props.children === 'Delete plan');
    expect(StyleSheet.flatten(danger.props.style).color).toBe(colors.dangerText);
    pressable(tree, 'o-edit').props.onPress();
    expect(onClose).toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(OVERFLOW_HANDOFF_MS);
    expect(run).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('review LOW: leaving the screen before the hand-off cancels the queued action (no late copy POST)', async () => {
    jest.useFakeTimers();
    const run = jest.fn();
    const tree = await render(<PlanOverflowSheet isOpen onClose={jest.fn()} items={[{ key: 'make-copy', label: 'Make a copy', onPress: run, testID: 'o-copy' }]} />);
    pressable(tree, 'o-copy').props.onPress();
    act(() => tree.unmount());
    jest.advanceTimersByTime(OVERFLOW_HANDOFF_MS);
    expect(run).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('UX R2-4: a Menu, a footer Cancel that closes it and no title-row ×', async () => {
    const onClose = jest.fn();
    const tree = await render(<PlanOverflowSheet isOpen onClose={onClose} items={[{ key: 'edit-details', label: 'Edit details', onPress: jest.fn(), testID: 'o-edit' }]} />);
    expect(tree.root.findAll((node) => node.props?.testID === 'app-modal-close' && typeof node.type === 'string')).toHaveLength(0);
    pressable(tree, 'plan-overflow-cancel').props.onPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('builder parts', () => {
  it('DangerTintButton: rest, pressed overlay, loading and disabled', async () => {
    const tree = await render(<DangerTintButton testID="d" title="Delete" onPress={jest.fn()} />);
    const button = tap(tree, 'd');
    expect(flat(button)).toMatchObject({ backgroundColor: colors.dangerDotTint, borderColor: colors.dangerDotBorder, minHeight: 44 });
    const pressedTree = await render(renderFn(tree, 'd').props.children({ pressed: true }));
    expect(hosts(pressedTree, 'd-pressed')).toHaveLength(1);
    const busy = await render(<DangerTintButton testID="d" title="Delete" loading onPress={jest.fn()} />);
    expect(tap(busy, 'd').props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    const off = await render(<DangerTintButton testID="d" title="Delete" disabled onPress={jest.fn()} />);
    expect(flat(tap(off, 'd')).opacity).toBe(0.5);
  });

  it('TextAction: 44 hit area, gold or danger text', async () => {
    const tree = await render(<TextAction testID="t" label="Delete" tone="danger" onPress={jest.fn()} />);
    const action = tap(tree, 't');
    expect(action.props.hitSlop.top + action.props.hitSlop.bottom + 32).toBeGreaterThanOrEqual(44);
    expect(StyleSheet.flatten(tree.root.findByType(Text).props.style).color).toBe(colors.dangerText);
  });

  it('BackLink: the gold link (member) and the glass pill (trainer)', async () => {
    const link = await render(<BackLink testID="b" label="My plans" onPress={jest.fn()} />);
    expect(tap(link, 'b').props).toMatchObject({ accessibilityRole: 'link', accessibilityLabel: 'My plans' });
    expect(flat(tap(link, 'b')).minHeight).toBe(44);
    // DECLARED (T-65, PHONE-NAV spec §3): was the trainer `pill` → backgroundColor colors.fillButton (its own 40 pill).
    // Both audiences draw the kit BackPill now (white 7 % fill, colors.hairline).
    const back = await render(<BackLink testID="b" label="All plans" onPress={jest.fn()} />);
    expect(flat(tap(back, 'b')).backgroundColor).toBe(colors.hairline);
  });

  it('WarningNotice / AffectedClients: hidden at null / 0; the amber card otherwise', async () => {
    expect((await render(<AffectsNoticeBox count={0} />)).toJSON()).toBeNull();
    expect((await render(<ClientsBanner count={null} />)).toJSON()).toBeNull();
    const tree = await render(<AffectsNoticeBox count={1} />);
    expect(allText(tree)).toEqual(['This affects 1 client. Changes apply from their next workout; past and in-progress workouts stay as they are.']);
    const banner = await render(<WarningNotice testID="w" title="T" body="B" />);
    expect(flat(host(banner, 'w'))).toMatchObject({ backgroundColor: colors.warningFill, borderColor: colors.warningBorder });
  });
});

describe('days and sets', () => {
  const days = [
    { id: 1, day_number: 1, title: 'Upper', description: 'Push', exercises_count: 3 },
    { id: 2, day_number: 2, title: '', exercises_count: 0 },
  ];
  const caps = { editDay: true, deleteDay: true, editSet: true, deleteSet: true };

  it('DayTabs trainer: the label, gold selected tab, the full-width dashed Add a day', async () => {
    const onAddDay = jest.fn();
    const tree = await render(<DayTabs days={days} selectedDayId={2} look="trainer" canAddDay onSelect={jest.fn()} onAddDay={onAddDay} />);
    expect(allText(tree)).toEqual(expect.arrayContaining(['Plan days', 'Day 1: Upper', 'Day 2: Untitled day', 'Add a day']));
    expect(flat(tap(tree, 'plan-day-2')).backgroundColor).toBe(colors.gold);
    // T-86: the gold selected tab is a chip, so no gold glow.
    expect(flat(tap(tree, 'plan-day-2')).boxShadow).toBeUndefined();
    expect(flat(tap(tree, 'plan-day-1')).backgroundColor).toBe(colors.surface);
    expect(flat(tap(tree, 'plan-add-day'))).toMatchObject({ minHeight: 48, borderStyle: 'dashed' });
    pressable(tree, 'plan-add-day').props.onPress();
    expect(onAddDay).toHaveBeenCalled();
  });

  it('DayTabs without addDay: no add control', async () => {
    const tree = await render(<DayTabs days={days} selectedDayId={1} onSelect={jest.fn()} />);
    expect(hosts(tree, 'plan-add-day')).toHaveLength(0);
  });

  it('SelectedDayStrip: nothing without a day or content; Edit / Delete act on the day', async () => {
    expect((await render(<SelectedDayStrip day={null} capabilities={caps} />)).toJSON()).toBeNull();
    expect((await render(<SelectedDayStrip day={days[1]} capabilities={{}} />)).toJSON()).toBeNull();
    const onDeleteDay = jest.fn();
    const tree = await render(<SelectedDayStrip day={days[0]} capabilities={caps} onEditDay={jest.fn()} onDeleteDay={onDeleteDay} />);
    pressable(tree, 'plan-day-delete-1').props.onPress();
    expect(onDeleteDay).toHaveBeenCalledWith(days[0]);
  });

  it('DayListCard: empty copy; trainer panel; the selected day gold-tint with its count gold', async () => {
    const empty = await render(<DayListCard days={[]} selectedDayId={null} capabilities={{}} onSelect={jest.fn()} />);
    expect(allText(empty)).toContain('No days yet. Add the first training day to start building the plan.');
    const tree = await render(<DayListCard days={days} look="trainer" selectedDayId={1} capabilities={caps} onSelect={jest.fn()} onEditDay={jest.fn()} onDeleteDay={jest.fn()} />);
    expect(allText(tree)).not.toContain('Structure');
    const count = tree.root.find((node) => node.type === Text && node.props.children === '3 exercises');
    expect(StyleSheet.flatten(count.props.style).color).toBe(colors.gold);
    expect(pressable(tree, 'plan-day-delete-2').props.accessibilityLabel).toBe('Delete day 2');
  });

  it('SetList: member text rows; nothing without sets; Edit / Delete call back with the set', async () => {
    const exercise = { id: 5, exercise: { name: 'Row' } };
    const sets = [{ id: 9, set_number: 1, target_reps_min: 8, target_reps_max: 10, rest_seconds: 60 }];
    expect((await render(<SetList exercise={exercise} sets={[]} capabilities={caps} />)).toJSON()).toBeNull();
    const onEditSet = jest.fn();
    const tree = await render(<SetList exercise={exercise} sets={sets} capabilities={caps} onEditSet={onEditSet} onDeleteSet={jest.fn()} />);
    expect(allText(tree)).toEqual(expect.arrayContaining(['Set 1', '8-10 reps · Open weight · 60s rest']));
    pressable(tree, 'plan-set-edit-9').props.onPress();
    expect(onEditSet).toHaveBeenCalledWith(exercise, sets[0]);
    const readOnly = await render(<SetList exercise={exercise} sets={sets} capabilities={{}} />);
    expect(hosts(readOnly, 'plan-set-edit-9')).toHaveLength(0);
  });
});

// Dated 27 Oct 2026 (RN-SPEC-MEMBER-PLANS + RN-SPEC-TRAINER-PLANS, audit b2, UX R2-3 / R2-4): the builder
// dialogs' Close (×) follows each actor's board per width.
describe('builder dialogs: the × per actor and width (audit b2)', () => {
  const closes = (tree) => hosts(tree, 'app-modal-close');
  const dayContext = { nextDayNumber: 4, dayLimit: 5, canAddDay: true };
  const planProps = { isOpen: true, onClose: jest.fn(), plan: { name: 'Plan', category_id: 2, days_per_week: 4, description: '' }, dayCount: 3, categories: [], levels: [], description: '', onSubmit: jest.fn() };

  it.each([
    [390, 'member'],
    [390, 'trainer'],
    [834, 'member'],
    [834, 'trainer'],
  ])('at %ipx (%s): Add / Edit set and Edit plan details show the × AND keep the footer Cancel', async (width, look) => {
    mockWidth = width;
    const set = await render(<AddSetModal isOpen onClose={jest.fn()} nextSetNumber={3} set={null} look={look} onSubmit={jest.fn()} />);
    expect(closes(set)).toHaveLength(1);
    expect(pill(set, 'set-modal-cancel')).toBeTruthy();
    const edit = await render(<AddSetModal isOpen onClose={jest.fn()} nextSetNumber={3} set={{ id: 1, set_number: 1 }} look={look} onSubmit={jest.fn()} />);
    expect(closes(edit)).toHaveLength(1);
    const details = await render(<EditPlanDetailsModal {...planProps} look={look} />);
    expect(closes(details)).toHaveLength(1);
    expect(pill(details, 'edit-plan-cancel')).toBeTruthy();
  });

  it.each([
    [390, 'member', 1],
    [390, 'trainer', 0],
    [834, 'member', 1],
    [834, 'trainer', 1],
  ])('Add / Edit day at %ipx (%s): %i ×; the footer Cancel always', async (width, look, count) => {
    mockWidth = width;
    const add = await render(<AddDayModal isOpen onClose={jest.fn()} context={dayContext} day={null} look={look} onSubmit={jest.fn()} />);
    expect(closes(add)).toHaveLength(count);
    expect(pill(add, 'day-modal-cancel')).toBeTruthy();
    const edit = await render(<AddDayModal isOpen onClose={jest.fn()} context={dayContext} day={{ id: 2, title: 'Push', description: '' }} look={look} onSubmit={jest.fn()} />);
    expect(closes(edit)).toHaveLength(count);
  });

  it('the × closes the dialog without saving', async () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn();
    const tree = await render(<AddSetModal isOpen onClose={onClose} nextSetNumber={3} set={null} look="trainer" onSubmit={onSubmit} />);
    await act(async () => pressable(tree, 'app-modal-close').props.onPress());
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('tablet: the set editor selected unit (lb / kg) is gold; the phone keeps the light switch', async () => {
    mockWidth = 834;
    let tree = await render(<AddSetModal isOpen onClose={jest.fn()} nextSetNumber={3} set={null} onSubmit={jest.fn()} />);
    expect(tree.root.findByType(SegmentedSwitch).props.selectedTone).toBe('gold');
    expect(flat(tap(tree, 'set-unit-lb'))).toMatchObject({ backgroundColor: colors.gold });
    mockWidth = 390;
    tree = await render(<AddSetModal isOpen onClose={jest.fn()} nextSetNumber={3} set={null} onSubmit={jest.fn()} />);
    expect(tree.root.findByType(SegmentedSwitch).props.selectedTone ?? 'light').toBe('light');
  });

  it('tablet: "Days per week" = the 7 day buttons, 56 tall, gap 8', async () => {
    mockWidth = 834;
    const tree = await render(<EditPlanDetailsModal {...planProps} />);
    expect(flat(host(tree, 'edit-plan-days')).gap).toBe(8);
    expect(flat(tap(tree, 'edit-plan-days-7')).minHeight).toBe(56);
  });
});
