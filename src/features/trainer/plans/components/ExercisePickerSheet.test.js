import { Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ExerciseImage from '../../../../shared/components/ExerciseImage';
import GradientFill from '../../../../shared/components/GradientFill';
import Select from '../../../../shared/components/Select';
import { colors, muscleText, shadows, textScale } from '../../../../shared/theme/tokens';
import ExercisePickerSheet, { CATALOG_UNAVAILABLE_TITLE, TABLET_DIALOG_FILL } from './ExercisePickerSheet';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../../shared/components/RemoteImage', () => () => null);
jest.mock('../../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('../../../../shared/hooks/useSheetFocus', () => ({ useSheetFocus: jest.fn() }));

const { useSheetFocus } = require('../../../../shared/hooks/useSheetFocus');

const catalog = [
  {
    id: 1,
    name: 'Bench Press',
    primary_muscle_group: { code: 'CHEST', name: 'Chest' },
    equipment_type: { id: 3, name: 'Barbell' },
    slug: 'bench-press',
  },
  {
    id: 2,
    name: 'Overhead Press',
    primary_muscle_group: { code: 'SHOULDERS', name: 'Shoulders' },
    equipment_type: { id: 3, name: 'Barbell' },
    slug: 'ohp',
  },
  { id: 3, name: 'Push-up', primary_muscle_group: { code: 'CHEST', name: 'Chest' }, equipment_type: null, slug: 'push-up' },
];

const texts = (root) =>
  root
    .findAll((node) => node.type === 'Text')
    .map((node) =>
      []
        .concat(node.props.children)
        .filter((c) => typeof c !== 'object' || c === null)
        .join(''),
    );
const host = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const styleOf = (node) => flat(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);

function setWidth(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale });
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
      expect.arrayContaining([
        'Add exercise',
        'Search and select exercises to add to this day.',
        'Search',
        '3 exercises',
        'Cancel',
        'Add Selected',
      ]),
    );
    expect(shown).not.toContain('bench-press');
    expect(host(tree.root, 'exercise-picker-handle')).toHaveLength(1);
    expect(host(tree.root, 'exercise-picker-close')).toHaveLength(0);
    const field = styleOf(host(tree.root, 'exercise-picker-search-field')[0]);
    expect(field).toMatchObject({ borderRadius: 999, backgroundColor: colors.surfaceWell, minHeight: 48 });
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
    expect(styleOf(host(tree.root, 'exercise-picker-search-field')[0])).toMatchObject({
      borderColor: colors.gold,
      outlineColor: colors.goldFocus,
    });
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
    act(() =>
      tree.root
        .find((node) => node.props.testID === 'exercise-picker-search' && node.props.onChangeText)
        .props.onChangeText('press'),
    );
    act(() => pressable(tree.root, 'exercise-picker-cancel').props.onPress());
    expect(props.onClose).toHaveBeenCalled();
    act(() => tree.update(<ExercisePickerSheet {...props} isOpen={false} />));
    act(() => tree.update(<ExercisePickerSheet {...props} isOpen />));
    expect(host(tree.root, 'exercise-picker-selected-pill')).toHaveLength(0);
    expect(tree.root.find((node) => node.props.testID === 'exercise-picker-search' && node.props.onChangeText).props.value).toBe(
      '',
    );
  });

  it('Android back (onRequestClose) closes', () => {
    const { tree, props } = render();
    const modal = tree.root.find((node) => typeof node.props.onRequestClose === 'function');
    act(() => modal.props.onRequestClose());
    expect(props.onClose).toHaveBeenCalled();
  });

  it('filters narrow the list; nothing left shows the no-match line', () => {
    const { tree } = render();
    act(() =>
      tree.root
        .find((node) => node.props.testID === 'exercise-picker-search' && node.props.onChangeText)
        .props.onChangeText('zzz'),
    );
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
    expect(styleOf(host(tree.root, 'exercise-picker-search-field')[0]).minHeight).toBe(52);
  });
});

// Phase 2 tokens pass: exact colours (UX §8.4/§8.5, state rule) and large text (§9).
function pressedChildren(element) {
  let inner;
  act(() => {
    inner = create(<>{element.props.children({ pressed: true })}</>);
  });
  mounted.push(inner);
  return inner;
}
const findHost = (root, id) => root.findAll((node) => node.props?.testID === id && typeof node.type === 'string');
const insideKit = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === ExerciseImage || parent.type === Select) {
      return true;
    }
  }
  return false;
};
const ownTexts = (root) => root.findAllByType(Text).filter((node) => !insideKit(node) && node.parent?.type !== Text);

describe('Exercise picker tokens (Phase 2 exact match)', () => {
  it('phone: surface-card-2 sheet and footer, hairline-bright handle, surface-well search and selects', () => {
    const { tree } = render();
    expect(styleOf(host(tree.root, 'exercise-picker')[0]).backgroundColor).toBe(colors.surfaceCard2);
    expect(styleOf(host(tree.root, 'exercise-picker-footer')[0]).backgroundColor).toBe(colors.surfaceCard2);
    expect(styleOf(host(tree.root, 'exercise-picker-handle')[0]).backgroundColor).toBe(colors.hairlineBright);
    const selects = tree.root.findAllByType(Select);
    selects.forEach((select) => expect(flat(select.props.boxStyle).backgroundColor).toBe(colors.surfaceWell));
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(0);
  });

  it('a typed search is an active filter: the gold-strong edge; focus still wins', () => {
    const { tree } = render();
    act(() =>
      tree.root
        .find((node) => node.props.testID === 'exercise-picker-search' && node.props.onChangeText)
        .props.onChangeText('press'),
    );
    expect(styleOf(host(tree.root, 'exercise-picker-search-field')[0]).borderColor).toBe(colors.goldStrong);
    act(() => tree.root.find((node) => node.props.testID === 'exercise-picker-search' && node.props.onFocus).props.onFocus());
    expect(styleOf(host(tree.root, 'exercise-picker-search-field')[0]).borderColor).toBe(colors.gold);
  });

  it('an active select: gold-line edge on gold-faint (the ladder)', () => {
    const { tree } = render();
    const muscleSelect = () => tree.root.findAllByType(Select).find((node) => node.props.testID === 'exercise-picker-muscle');
    expect(flat(muscleSelect().props.boxStyle).borderColor).toBe(colors.hairlineStrong);
    act(() => muscleSelect().props.onChange('Chest'));
    expect(flat(muscleSelect().props.boxStyle)).toMatchObject({
      borderColor: colors.goldLine,
      backgroundColor: colors.goldFaint,
    });
  });

  it('phone rows: selected = gold-faint + gold edge; idle pressed = rest + the 4 % overlay', () => {
    const { tree } = render();
    const row = () => pressable(tree.root, 'exercise-picker-row-2');
    expect(styleOf(row())).toMatchObject({ backgroundColor: colors.surface, borderColor: colors.hairline });
    const pressedStyle = flat(row().props.style({ pressed: true }));
    expect(pressedStyle).toMatchObject({ backgroundColor: colors.surface, borderColor: colors.hairline });
    const overlay = findHost(pressedChildren(row()).root, 'exercise-picker-row-2-pressed')[0];
    expect(flat(overlay.props.style).backgroundColor).toBe(colors.pressOverlay);
    act(() => row().props.onPress());
    expect(styleOf(row())).toMatchObject({ backgroundColor: colors.goldFaint, borderColor: colors.gold });
    expect(findHost(pressedChildren(row()).root, 'exercise-picker-row-2-pressed')).toHaveLength(0);
  });

  it('Cancel pressed = rest + white 4 %; Add pressed = gold + ink 4 % (state rule, no gold-deep)', () => {
    const { tree } = render();
    act(() => pressable(tree.root, 'exercise-picker-row-1').props.onPress());
    const cancel = pressable(tree.root, 'exercise-picker-cancel');
    expect(flat(cancel.props.style({ pressed: true })).backgroundColor).toBe(colors.fillSkeleton);
    expect(flat(findHost(pressedChildren(cancel).root, 'exercise-picker-cancel-pressed')[0].props.style).backgroundColor).toBe(
      colors.pressOverlay,
    );
    const add = pressable(tree.root, 'exercise-picker-add');
    expect(flat(add.props.style({ pressed: true })).backgroundColor).toBe(colors.gold);
    expect(flat(findHost(pressedChildren(add).root, 'exercise-picker-add-pressed')[0].props.style).backgroundColor).toBe(
      colors.pressOverlayInk,
    );
  });

  it('tablet: the 165° surface-raised → surface dialog, surface-card-2 cards, on-photo ring, large gold glow', () => {
    setWidth(834);
    const { tree } = render();
    const dialogFill = tree.root.findAllByType(GradientFill)[0].props;
    expect(dialogFill).toMatchObject({ angle: 165, colors: [colors.surfaceRaised, colors.surface] });
    expect(TABLET_DIALOG_FILL.colors).toEqual([colors.surfaceRaised, colors.surface]);
    expect(styleOf(host(tree.root, 'exercise-picker-handle')[0])).toMatchObject({ width: 44, height: 5 });
    expect(styleOf(pressable(tree.root, 'exercise-picker-row-1'))).toMatchObject({
      backgroundColor: colors.surfaceCard2,
      borderColor: colors.choiceBorder,
    });
    expect(styleOf(host(tree.root, 'exercise-picker-ring-1')[0])).toMatchObject({
      borderColor: colors.textSecondary,
      backgroundColor: colors.onPhoto,
    });
    act(() => pressable(tree.root, 'exercise-picker-row-1').props.onPress());
    expect(styleOf(pressable(tree.root, 'exercise-picker-row-1')).backgroundColor).toBe(colors.surfaceCard2);
    expect(styleOf(pressable(tree.root, 'exercise-picker-add')).boxShadow).toBe(shadows.goldGlowLarge);
  });

  it('tablet: the muscle chip text is the lighter muscle text on the 16 % tint', () => {
    setWidth(834);
    const { tree } = render();
    const chip = host(tree.root, 'exercise-picker-muscle-chip-1')[0];
    const label = chip.findByType(Text);
    expect(flat(label.props.style).color).toBe(muscleText.chest);
    expect(
      chip.findAll((node) => typeof node.type === 'string' && flat(node.props.style).backgroundColor === colors.chest),
    ).not.toHaveLength(0);
  });

  it('tablet added card: surface-sunk, on-photo-strong "Added" badge, text-secondary name and neutral chips', () => {
    setWidth(834);
    const { tree } = render();
    expect(styleOf(pressable(tree.root, 'exercise-picker-row-3'))).toMatchObject({
      backgroundColor: colors.surfaceSunk,
      borderColor: colors.hairline,
    });
    expect(styleOf(host(tree.root, 'exercise-picker-added-3')[0])).toMatchObject({
      backgroundColor: colors.onPhotoStrong,
      minHeight: 28,
    });
    const name = tree.root.findAllByType(Text).find((node) => node.props.children === 'Push-up');
    expect(flat(name.props.style).color).toBe(colors.textSecondary);
    const chip = host(tree.root, 'exercise-picker-muscle-chip-3')[0];
    expect(flat(chip.props.style).backgroundColor).toBe(colors.fillButton);
    expect(flat(chip.findByType(Text).props.style).color).toBe(colors.textSecondary);
  });

  it('tablet idle card pressed: the overlay; added card: none', () => {
    setWidth(834);
    const { tree } = render();
    expect(
      findHost(pressedChildren(pressable(tree.root, 'exercise-picker-row-1')).root, 'exercise-picker-row-1-pressed'),
    ).toHaveLength(1);
    expect(
      findHost(pressedChildren(pressable(tree.root, 'exercise-picker-row-3')).root, 'exercise-picker-row-3-pressed'),
    ).toHaveLength(0);
  });
});

describe('Exercise picker large text (UX §9)', () => {
  it.each([
    [390, 1],
    [390, 2],
    [834, 1],
    [834, 2],
  ])(
    'width %s, fontScale %s: every text capped by role, the title wraps and shrinks, nothing cut to one line',
    (width, scale) => {
      setWidth(width, scale);
      const { tree } = render();
      act(() => pressable(tree.root, 'exercise-picker-row-1').props.onPress());
      const all = ownTexts(tree.root);
      all.forEach((node) => {
        expect(node.props.maxFontSizeMultiplier).toBeGreaterThan(0);
        if (node.props.numberOfLines !== undefined) {
          expect(node.props.numberOfLines).toBeGreaterThanOrEqual(2);
        }
      });
      const title = tree.root.find((node) => node.props.testID === 'exercise-picker-title' && node.type === Text);
      expect(title.props).toMatchObject({
        maxFontSizeMultiplier: textScale.display,
        numberOfLines: 3,
        adjustsFontSizeToFit: true,
        minimumFontScale: 0.7,
        textBreakStrategy: 'simple',
      });
      const count = tree.root.find((node) => node.props.testID === 'exercise-picker-add-count');
      expect(count.findByType(Text).props.maxFontSizeMultiplier).toBe(textScale.badge);
      const search = tree.root.find((node) => node.props.testID === 'exercise-picker-search' && node.props.onChangeText);
      expect(search.props.maxFontSizeMultiplier).toBe(textScale.body);
      // No fixed heights on text holders.
      expect(styleOf(host(tree.root, 'exercise-picker-search-field')[0]).height).toBeUndefined();
      expect(styleOf(pressable(tree.root, 'exercise-picker-add')).height).toBeUndefined();
      expect(styleOf(pressable(tree.root, 'exercise-picker-cancel')).height).toBeUndefined();
    },
  );

  it('fontScale 1: Cancel · Add side by side (Cancel first); header above the list; rows keep the trailing mark', () => {
    setWidth(390, 1);
    const { tree } = render();
    const footer = host(tree.root, 'exercise-picker-footer')[0];
    expect(styleOf(footer).flexDirection).toBe('row');
    const ids = footer.findAll(
      (node) => typeof node.type === 'string' && /exercise-picker-(add|cancel)$/.test(node.props.testID ?? ''),
    );
    expect(ids.map((node) => node.props.testID)).toEqual(['exercise-picker-cancel', 'exercise-picker-add']);
    const list = tree.root.find(
      (node) => node.props.testID === 'exercise-picker-list' && node.props.ListHeaderComponent !== undefined,
    );
    expect(list.findAll((node) => node.props.testID === 'exercise-picker-title')).toHaveLength(0);
    act(() => pressable(tree.root, 'exercise-picker-row-1').props.onPress());
    expect(styleOf(host(tree.root, 'exercise-picker-trailing-1')[0]).marginTop).toBeUndefined();
  });

  it.each([2, 3.1])(
    'fontScale %s phone: Add stacks on top full width, filters one column, header scrolls, marks drop below',
    (scale) => {
      setWidth(390, scale);
      const { tree } = render();
      const footer = host(tree.root, 'exercise-picker-footer')[0];
      expect(styleOf(footer).flexDirection).toBe('column');
      const buttons = footer.findAll(
        (node) => typeof node.type === 'string' && /exercise-picker-(add|cancel)$/.test(node.props.testID ?? ''),
      );
      expect(buttons.map((node) => node.props.testID)).toEqual(['exercise-picker-add', 'exercise-picker-cancel']);
      buttons.forEach((node) => expect(flat(node.props.style)).toMatchObject({ width: '100%', flex: 0 }));
      const filters = host(tree.root, 'exercise-picker-filters')[0];
      filters.props.children.forEach((cell) => expect(flat(cell.props.style).width).toBe('100%'));
      const list = tree.root.find(
        (node) => node.props.testID === 'exercise-picker-list' && node.props.ListHeaderComponent !== undefined,
      );
      expect(list.findAll((node) => node.props.testID === 'exercise-picker-title' && node.type === Text)).toHaveLength(1);
      act(() => pressable(tree.root, 'exercise-picker-row-1').props.onPress());
      expect(styleOf(host(tree.root, 'exercise-picker-trailing-1')[0]).marginTop).toBe(8);
      expect(host(tree.root, 'exercise-picker-check-1')).toHaveLength(1);
      expect(texts(tree.root)).toContain('Added');
    },
  );

  it('fontScale 2 tablet: one card column and one filter column', () => {
    setWidth(834, 2);
    const { tree } = render();
    const list = tree.root.find((node) => node.props.testID === 'exercise-picker-list' && node.props.numColumns !== undefined);
    expect(list.props.numColumns).toBe(1);
    host(tree.root, 'exercise-picker-filters')[0].props.children.forEach((cell) =>
      expect(flat(cell.props.style).width).toBe('100%'),
    );
    setWidth(834, 1);
    const wide = render().tree;
    expect(
      wide.root.find((node) => node.props.testID === 'exercise-picker-list' && node.props.numColumns !== undefined).props
        .numColumns,
    ).toBe(2);
  });
});

// UX final audit X7 ruling (27 Oct 2026, §1.1): every name in a row, card or
// list is at most 2 lines then a tail ellipsis, no font shrink.
describe.each([390, 834])('X7 exercise picker rows (%i)', (width) => {
  const expectName = (node) => {
    expect(node.props).toMatchObject({ numberOfLines: 2, ellipsizeMode: 'tail' });
    expect(node.props.adjustsFontSizeToFit).toBeUndefined();
  };
  it('the row names: 2 lines + ellipsis', () => {
    setWidth(width, 3.1);
    const { tree } = render();
    const nodes = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Bench Press');
    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(expectName);
  });
});
