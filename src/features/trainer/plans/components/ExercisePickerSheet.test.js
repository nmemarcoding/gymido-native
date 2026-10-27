import { useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, shadows } from '../../../../shared/theme/tokens';
import ExercisePickerSheet, { CATALOG_UNAVAILABLE_TITLE } from './ExercisePickerSheet';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../../shared/components/RemoteImage', () => () => null);
jest.mock('../../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('../../../../shared/hooks/useSheetFocus', () => ({ useSheetFocus: jest.fn() }));

const { useSheetFocus } = require('../../../../shared/hooks/useSheetFocus');

const catalog = [
  { id: 1, name: 'Bench Press', primary_muscle_group: { code: 'CHEST', name: 'Chest' }, equipment_type: { id: 3, name: 'Barbell' }, slug: 'bench-press' },
  { id: 2, name: 'Overhead Press', primary_muscle_group: { code: 'SHOULDERS', name: 'Shoulders' }, equipment_type: { id: 3, name: 'Barbell' }, slug: 'ohp' },
  { id: 3, name: 'Push-up', primary_muscle_group: { code: 'CHEST', name: 'Chest' }, equipment_type: null, slug: 'push-up' },
];

const texts = (root) =>
  root.findAll((node) => node.type === 'Text').map((node) => [].concat(node.props.children).filter((c) => typeof c !== 'object' || c === null).join(''));
const host = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const styleOf = (node) => flat(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);

function setWidth(width) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale: 1 });
}

const mounted = [];
function render(props = {}) {
  const all = {
    isOpen: true,
    onClose: jest.fn(),
    catalog,
    loading: false,
    muscleGroups: [{ id: 1, name: 'Chest' }],
    equipmentTypes: [{ id: 3, name: 'Barbell' }],
    addedIds: new Set([3]),
    onAddSelected: jest.fn(() => Promise.resolve()),
    ...props,
  };
  let tree;
  act(() => {
    tree = create(<ExercisePickerSheet {...all} />);
  });
  mounted.push(tree);
  return { tree, props: all };
}

beforeEach(() => {
  jest.useFakeTimers();
  setWidth(390);
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('Exercise picker v2 look (C2), phone', () => {
  it('renders the sheet: handle, title, sub, search pill with gold caret, filters, count, rows without slugs', () => {
    const { tree } = render();
    const shown = texts(tree.root);
    expect(shown).toEqual(
      expect.arrayContaining(['Add exercise', 'Search and select exercises to add to this day.', 'Search', '3 exercises', 'Cancel', 'Add Selected'])
    );
    expect(shown).not.toContain('bench-press');
    expect(host(tree.root, 'exercise-picker-handle')).toHaveLength(1);
    expect(host(tree.root, 'exercise-picker-close')).toHaveLength(0);
    const field = styleOf(host(tree.root, 'exercise-picker-search-field')[0]);
    expect(field).toMatchObject({ borderRadius: 999, backgroundColor: colors.surfaceSunk, height: 48 });
  });

  it('the search TextInput has a gold caret and selection (UX ruling)', () => {
    const { tree } = render();
    const input = tree.root.find((node) => node.props.testID === 'exercise-picker-search' && node.props.onChangeText);
    expect(input.props.selectionColor).toBe(colors.gold);
    expect(input.props.cursorColor).toBe(colors.gold);
  });

  it('search focus draws the gold border and ring', () => {
    const { tree } = render();
    const input = tree.root.find((node) => node.props.testID === 'exercise-picker-search' && node.props.onFocus);
    act(() => input.props.onFocus());
    expect(styleOf(host(tree.root, 'exercise-picker-search-field')[0])).toMatchObject({ borderColor: colors.gold, outlineColor: colors.goldFocus });
    act(() => input.props.onBlur());
    expect(styleOf(host(tree.root, 'exercise-picker-search-field')[0]).borderColor).toBe(colors.hairlineStrong);
  });

  it('selecting shows the gold count pill, the check bubble and the Add count; Add is disabled at 0', () => {
    const { tree } = render();
    expect(pressable(tree.root, 'exercise-picker-add').props.disabled).toBe(true);
    expect(host(tree.root, 'exercise-picker-selected-pill')).toHaveLength(0);
    expect(host(tree.root, 'exercise-picker-add-count')).toHaveLength(0);
    act(() => pressable(tree.root, 'exercise-picker-row-2').props.onPress());
    const pill = styleOf(host(tree.root, 'exercise-picker-selected-pill')[0]);
    expect(pill.backgroundColor).toBe(colors.goldTint);
    expect(texts(tree.root)).toContain('1 selected');
    expect(host(tree.root, 'exercise-picker-check-2')).toHaveLength(1);
    expect(pressable(tree.root, 'exercise-picker-row-2').props.accessibilityState).toEqual({ checked: true, disabled: false });
    const add = pressable(tree.root, 'exercise-picker-add');
    expect(add.props.disabled).toBe(false);
    expect(styleOf(add).boxShadow).toBe(shadows.goldGlow);
    expect(host(tree.root, 'exercise-picker-add-count')).toHaveLength(1);
    // The count line is a polite live region.
    expect(host(tree.root, 'exercise-picker-meta')[0].props.accessibilityLiveRegion).toBe('polite');
  });

  it('added rows are disabled and say "Added"', () => {
    const { tree } = render();
    const row = pressable(tree.root, 'exercise-picker-row-3');
    expect(row.props.disabled).toBe(true);
    expect(row.props.accessibilityState).toEqual({ checked: false, disabled: true });
    expect(texts(tree.root)).toContain('Added');
  });

  it('Add Selected passes the selection in catalog order, then closes', async () => {
    const { tree, props } = render();
    act(() => pressable(tree.root, 'exercise-picker-row-2').props.onPress());
    act(() => pressable(tree.root, 'exercise-picker-row-1').props.onPress());
    await act(async () => {
      await pressable(tree.root, 'exercise-picker-add').props.onPress();
    });
    expect(props.onAddSelected).toHaveBeenCalledWith([catalog[0], catalog[1]]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('Cancel closes; selection, search and filters reset on close', () => {
    const { tree, props } = render();
    act(() => pressable(tree.root, 'exercise-picker-row-1').props.onPress());
    act(() => tree.root.find((node) => node.props.testID === 'exercise-picker-search' && node.props.onChangeText).props.onChangeText('press'));
    act(() => pressable(tree.root, 'exercise-picker-cancel').props.onPress());
    expect(props.onClose).toHaveBeenCalled();
    act(() => tree.update(<ExercisePickerSheet {...props} isOpen={false} />));
    act(() => tree.update(<ExercisePickerSheet {...props} isOpen />));
    expect(host(tree.root, 'exercise-picker-selected-pill')).toHaveLength(0);
    expect(tree.root.find((node) => node.props.testID === 'exercise-picker-search' && node.props.onChangeText).props.value).toBe('');
  });

  it('Android back (onRequestClose) closes', () => {
    const { tree, props } = render();
    const modal = tree.root.find((node) => typeof node.props.onRequestClose === 'function');
    act(() => modal.props.onRequestClose());
    expect(props.onClose).toHaveBeenCalled();
  });

  it('filters narrow the list; nothing left shows the no-match line', () => {
    const { tree } = render();
    act(() => tree.root.find((node) => node.props.testID === 'exercise-picker-search' && node.props.onChangeText).props.onChangeText('zzz'));
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['0 exercises', 'No exercises match the current filters.']));
    expect(host(tree.root, 'exercise-picker-catalog-error')).toHaveLength(0);
  });

  it('loading shows "Loading exercises..."', () => {
    const { tree } = render({ loading: true, catalog: [] });
    expect(texts(tree.root)).toContain('Loading exercises...');
    expect(texts(tree.root)).not.toContain('No exercises match the current filters.');
  });
});

describe('§D4 catalog unavailable', () => {
  it('shows the alert with the message and Retry instead of the empty line', () => {
    const onRetryCatalog = jest.fn();
    const { tree } = render({ catalog: [], catalogError: 'Request failed with status code 500', onRetryCatalog });
    const alert = host(tree.root, 'exercise-picker-catalog-error')[0];
    expect(alert.props.accessibilityRole).toBe('alert');
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining([CATALOG_UNAVAILABLE_TITLE, 'Request failed with status code 500', 'Retry']));
    expect(shown).not.toContain('No exercises match the current filters.');
    act(() => tree.root.find((node) => node.props.title === 'Retry' && node.props.onPress).props.onPress());
    expect(onRetryCatalog).toHaveBeenCalledTimes(1);
  });

  it('while retrying shows the loading line, not the alert', () => {
    const { tree } = render({ catalog: [], loading: true, catalogError: 'x', onRetryCatalog: jest.fn() });
    expect(texts(tree.root)).toContain('Loading exercises...');
    expect(host(tree.root, 'exercise-picker-catalog-error')).toHaveLength(0);
  });

  it('keeps the rows gathered before the failing page under the alert', () => {
    const { tree } = render({ catalog: [catalog[0]], catalogError: 'x', onRetryCatalog: jest.fn() });
    expect(host(tree.root, 'exercise-picker-catalog-error')).toHaveLength(1);
    expect(texts(tree.root)).toContain('Bench Press');
  });
});

describe('focus (PM parity rule)', () => {
  it('focuses the title on open and returns focus to the opener (useSheetFocus wiring)', () => {
    const opener = { current: null };
    const { tree } = render({ returnFocusRef: opener });
    const [open, refs] = useSheetFocus.mock.calls.at(-1);
    expect(open).toBe(true);
    expect(refs.returnRef).toBe(opener);
    const title = tree.root.find((node) => node.props.testID === 'exercise-picker-title' && typeof node.type === 'string');
    expect(refs.initialRef.current).toBeTruthy();
    expect(title.props.accessibilityRole).toBe('header');
  });

  it('the sheet is modal for screen readers', () => {
    const { tree } = render();
    expect(host(tree.root, 'exercise-picker')[0].props.accessibilityViewIsModal).toBe(true);
  });
});

describe('Exercise picker v2 look (C2), tablet', () => {
  beforeEach(() => setWidth(834));

  it('is a centred 620 dialog with Close (same as Cancel), no handle hidden from layout, cards with rings', () => {
    const { tree, props } = render();
    expect(styleOf(host(tree.root, 'exercise-picker')[0])).toMatchObject({ maxWidth: 620, borderRadius: 36 });
    act(() => pressable(tree.root, 'exercise-picker-close').props.onPress());
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(host(tree.root, 'exercise-picker-ring-1')).toHaveLength(1);
    expect(host(tree.root, 'exercise-picker-selected-pill')).toHaveLength(0);
  });

  it('selection shows the check bubble on the card and the count as text', () => {
    const { tree } = render();
    act(() => pressable(tree.root, 'exercise-picker-row-1').props.onPress());
    expect(host(tree.root, 'exercise-picker-check-1')).toHaveLength(1);
    expect(host(tree.root, 'exercise-picker-ring-1')).toHaveLength(0);
    const meta = host(tree.root, 'exercise-picker-meta')[0];
    expect(meta.props.accessibilityLiveRegion).toBe('polite');
    expect(texts(tree.root)).toContain('1 selected');
  });

  it('search field is 52 tall on tablet', () => {
    const { tree } = render();
    expect(styleOf(host(tree.root, 'exercise-picker-search-field')[0]).height).toBe(52);
  });
});
