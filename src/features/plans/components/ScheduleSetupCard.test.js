jest.mock('../api/libraryApi', () => ({ createSchedule: jest.fn(), replaceSchedule: jest.fn() }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: 1 }),
}));

import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors } from '../../../shared/theme/tokens';
import { createSchedule, replaceSchedule } from '../api/libraryApi';
import ScheduleSetupCard, { daysSelectedLabel } from './ScheduleSetupCard';

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const texts = (root) => root.findAll((node) => node.type === 'Text').map(textOf);
const host = (root, id) => root.find((node) => node.props.testID === id && typeof node.type === 'string');
const queryHost = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const styleOf = (node, pressed = false) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed }) : node.props.style);
const chip = (tree, id) => pressable(tree.root, `schedule-setup-weekday-${id}`);
const isOn = (tree, id) => chip(tree, id).props.accessibilityState.selected;
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const DAYS = [{ id: 11 }, { id: 12 }, { id: 13 }, { id: 14 }];
const mounted = [];
let onSaved;
beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  onSaved = jest.fn(() => Promise.resolve());
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

function render(props = {}) {
  let tree;
  act(() => {
    tree = create(<ScheduleSetupCard planName="Upper / Lower Split" planDays={DAYS} enrollmentId={7} onSaved={onSaved} {...props} />);
  });
  mounted.push(tree);
  return tree;
}
const tap = (tree, id) =>
  act(() => {
    chip(tree, id).props.onPress();
  });
const save = (tree) => act(async () => pressable(tree.root, 'schedule-setup-save').props.onPress());

describe('B2 Schedule setup card: copy and default (v1)', () => {
  it('eyebrow, title, body with the plan name; first R weekdays pre-selected', () => {
    const tree = render();
    expect(texts(tree.root)).toEqual(
      expect.arrayContaining([
        'Set up your week',
        'Pick 4 training days',
        'Upper / Lower Split doesn’t have training days yet. Choose the weekdays you train and we’ll line up your sessions.',
        'Selected: Monday, Tuesday, Wednesday, Thursday',
        'Save training days',
      ])
    );
    [1, 2, 3, 4].forEach((id) => expect(isOn(tree, id)).toBe(true));
    [5, 6, 7].forEach((id) => expect(isOn(tree, id)).toBe(false));
  });

  it('singular for one day; "Your plan" when the plan has no name', () => {
    const tree = render({ planName: '', planDays: [{ id: 1 }] });
    expect(texts(tree.root)).toEqual(
      expect.arrayContaining(['Pick 1 training day', 'Your plan doesn’t have training days yet. Choose the weekdays you train and we’ll line up your sessions.'])
    );
  });

  it('chips are toggle buttons named by the full weekday, in a "Training days" group; the ✓ is hidden', () => {
    const tree = render();
    expect(chip(tree, 1).props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Monday' });
    const group = tree.root.find((node) => node.props.role === 'group' && typeof node.type === 'string');
    expect(group.props.accessibilityLabel).toBe('Training days');
    const checks = tree.root.findAll((node) => node.type === 'Text' && textOf(node) === '✓');
    expect(checks).toHaveLength(4);
    checks.forEach((check) => expect(check.props.accessibilityElementsHidden).toBe(true));
  });
});

describe('B2 phone (ND5 count badge)', () => {
  it('4 + 3 chips at 64 tall, radius 20; on = gold with onGold text, off = surface + hairline', () => {
    const tree = render();
    const on = styleOf(chip(tree, 1));
    expect(on).toMatchObject({ minHeight: 64, borderRadius: 20, backgroundColor: colors.gold });
    const off = styleOf(chip(tree, 5));
    expect(off).toMatchObject({ minHeight: 64, backgroundColor: colors.surface, borderColor: colors.hairlineStrong });
    expect(styleOf(chip(tree, 1), true).backgroundColor).toBe(colors.goldDeep);
    expect(styleOf(chip(tree, 5), true).backgroundColor).toBe(colors.fillButton);
    const label = chip(tree, 1).findAllByType('Text')[0];
    expect(StyleSheet.flatten(label.props.style).color).toBe(colors.onGold);
  });

  it('the badge matches the selected count and the Selected line is polite live text', () => {
    const tree = render();
    const badge = host(tree.root, 'schedule-setup-count');
    expect(textOf(badge.findByType('Text'))).toBe('4');
    expect(styleOf(badge)).toMatchObject({ width: 36, height: 36, backgroundColor: colors.goldTint });
    tap(tree, 2);
    expect(textOf(host(tree.root, 'schedule-setup-count').findByType('Text'))).toBe('3');
    expect(textOf(host(tree.root, 'schedule-setup-selected'))).toBe('Selected: Monday, Wednesday, Thursday');
    expect(host(tree.root, 'schedule-setup-selected').props.accessibilityLiveRegion).toBe('polite');
  });

  it('a tap past the limit does nothing (⚠14); none selected reads "None yet"', () => {
    const tree = render();
    tap(tree, 6);
    expect(isOn(tree, 6)).toBe(false);
    [1, 2, 3, 4].forEach((id) => tap(tree, id));
    expect(textOf(host(tree.root, 'schedule-setup-selected'))).toBe('Selected: None yet');
    expect(textOf(host(tree.root, 'schedule-setup-count').findByType('Text'))).toBe('0');
  });

  it('no tablet ring on the phone', () => {
    const tree = render();
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === daysSelectedLabel(4, 4))).toHaveLength(0);
  });
});

describe('B2 tablet (ND5 ring)', () => {
  beforeEach(() => {
    mockWidth = 834;
  });

  it('7 chips in one row at 84 tall; the 120 ring labelled "{n} of {R} days selected"', () => {
    const tree = render();
    expect(styleOf(chip(tree, 7))).toMatchObject({ minHeight: 84, backgroundColor: colors.fillChip });
    const ring = tree.root.find((node) => node.props.accessibilityLabel === '4 of 4 days selected' && typeof node.type === 'string');
    expect(ring.props.accessibilityRole).toBe('image');
    expect(textOf(host(tree.root, 'schedule-setup-ring-count'))).toBe('4');
    tap(tree, 1);
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === '3 of 4 days selected' && typeof node.type === 'string')).toHaveLength(1);
    expect(queryHost(tree.root, 'schedule-setup-count')).toHaveLength(0);
    expect(texts(tree.root)).toContain('Selected: Tuesday, Wednesday, Thursday');
  });

  it('draws the gold glow from the first render', () => {
    const tree = render();
    expect(queryHost(tree.root, 'schedule-setup-glow')).toHaveLength(1);
  });
});

describe('B2 save (v1 behaviour)', () => {
  it('fewer than R: the error alert, nothing sent', async () => {
    const tree = render();
    tap(tree, 4);
    await save(tree);
    expect(createSchedule).not.toHaveBeenCalled();
    const alert = host(tree.root, 'schedule-setup-error');
    expect(alert.props.accessibilityRole).toBe('alert');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Couldn’t save your days', 'Pick 4 training days to continue.']));
  });

  it('sends day i → the i-th selected weekday, then onSaved', async () => {
    createSchedule.mockResolvedValueOnce({});
    const tree = render();
    tap(tree, 2);
    tap(tree, 6);
    await save(tree);
    expect(createSchedule).toHaveBeenCalledWith(7, [
      { workout_plan_day_id: 11, weekday_id: 1 },
      { workout_plan_day_id: 12, weekday_id: 3 },
      { workout_plan_day_id: 13, weekday_id: 4 },
      { workout_plan_day_id: 14, weekday_id: 6 },
    ]);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(queryHost(tree.root, 'schedule-setup-error')).toHaveLength(0);
  });

  it('409 → replaces the schedule', async () => {
    createSchedule.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    replaceSchedule.mockResolvedValueOnce({});
    const tree = render();
    await save(tree);
    expect(replaceSchedule).toHaveBeenCalledWith(7, expect.any(Array));
    expect(onSaved).toHaveBeenCalled();
  });

  it('a server error shows its text in the alert; the error clears on the next save', async () => {
    createSchedule.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Failed to save your training days.' } } });
    const tree = render();
    await save(tree);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Couldn’t save your days', 'Failed to save your training days.']));
    expect(onSaved).not.toHaveBeenCalled();
    createSchedule.mockResolvedValueOnce({});
    await save(tree);
    expect(queryHost(tree.root, 'schedule-setup-error')).toHaveLength(0);
  });

  it('saving: the CTA is busy and disabled (one request)', async () => {
    const pending = deferred();
    createSchedule.mockReturnValueOnce(pending.promise);
    const tree = render();
    act(() => {
      pressable(tree.root, 'schedule-setup-save').props.onPress();
    });
    const button = host(tree.root, 'schedule-setup-save');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(styleOf(button).minHeight).toBe(60);
    await act(async () => pending.resolve({}));
    expect(host(tree.root, 'schedule-setup-save').props.accessibilityState).toEqual({ disabled: false, busy: false });
  });
});
