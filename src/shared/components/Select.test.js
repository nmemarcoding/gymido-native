import { Keyboard, Platform, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, font, radii } from '../theme/tokens';
import Select, { SelectChevron } from './Select';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-picker/picker', () => {
  const Picker = ({ children }) => children ?? null;
  Picker.Item = () => null;
  return { Picker };
});

describe('Select', () => {
  it('closes the keyboard when it opens, like a browser <select> taking focus (#17)', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    let tree;
    act(() => {
      tree = create(<Select testID="unit" accessibilityLabel="Unit" value="lb" options={[{ value: 'lb', label: 'lb' }]} onChange={() => {}} />);
    });
    const opener = tree.root.findAll((node) => node.props.testID === 'unit' && typeof node.props.onPress === 'function')[0];
    act(() => opener.props.onPress());
    expect(dismiss).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    dismiss.mockRestore();
  });
});

// RN-SPEC-v2-foundation §4.5 Select: the input style + a chevron; the
// platform picker stays (v1 rule).
describe('Select (v2 look)', () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Platform.OS = realOS;
  });

  const OPTIONS = [
    { value: '', label: 'No difficulty set' },
    { value: 'beginner', label: 'Beginner' },
  ];
  const flat = (style) => StyleSheet.flatten(style) ?? {};
  // The styled box is the pointerEvents="none" View.
  const box = (tree) => flat(tree.root.find((node) => node.type === 'View' && node.props.pointerEvents === 'none').props.style);
  const opener = (tree) => tree.root.findAll((node) => node.props.testID === 'difficulty' && typeof node.props.onPress === 'function')[0];

  function render(props = {}) {
    let tree;
    act(() => {
      tree = create(<Select testID="difficulty" label="Difficulty (optional)" value="" options={OPTIONS} onChange={() => {}} {...props} />);
    });
    return tree;
  }

  it('default (iOS): 52 tall input box with the 16 px chevron and 16/400 value text', () => {
    Platform.OS = 'ios';
    const tree = render();
    const b = box(tree);
    expect(b.minHeight).toBe(52);
    expect(b.borderRadius).toBe(20);
    expect(b.borderColor).toBe(colors.hairlineStrong);
    expect(b.backgroundColor).toBe(colors.surface);
    expect(tree.root.findAllByType(SelectChevron)).toHaveLength(1);
    const value = tree.root.findAll((node) => node.type === Text && node.props.children === 'No difficulty set')[0];
    expect(flat(value.props.style).fontSize).toBe(16);
    expect(flat(value.props.style).fontFamily).toBe(font(400).fontFamily);
  });

  it('open = focus ring (gold border + 4 px ring); Done closes it', () => {
    Platform.OS = 'ios';
    const tree = render();
    act(() => opener(tree).props.onPress());
    expect(box(tree).borderColor).toBe(colors.gold);
    expect(box(tree).outlineWidth).toBe(4);
    const done = tree.root.findAll((node) => node.props.testID === 'difficulty-done' && typeof node.props.onPress === 'function')[0];
    act(() => done.props.onPress());
    expect(box(tree).borderColor).toBe(colors.hairlineStrong);
    expect(box(tree).outlineWidth).toBeUndefined();
  });

  it('error: danger-text border and the announced message', () => {
    Platform.OS = 'ios';
    const tree = render({ error: 'Select a category' });
    expect(box(tree).borderColor).toBe(colors.dangerText);
    const message = tree.root.findAll((node) => node.type === Text && node.props.children === 'Select a category')[0];
    expect(message.props.accessibilityRole).toBe('alert');
  });

  it('disabled: opacity 0.5, not pressable, disabled state exposed', () => {
    Platform.OS = 'ios';
    const tree = render({ disabled: true });
    expect(box(tree).opacity).toBe(0.5);
    expect(opener(tree).props.disabled).toBe(true);
    expect(opener(tree).props.accessibilityState).toEqual({ disabled: true });
  });

  it('a caller trailing replaces the chevron; a caller boxStyle owns its size and trailing (set-row unit)', () => {
    Platform.OS = 'ios';
    const custom = render({ trailing: <Text>v</Text> });
    expect(custom.root.findAllByType(SelectChevron)).toHaveLength(0);
    const sized = render({ boxStyle: { width: 40, height: 48 } });
    expect(sized.root.findAllByType(SelectChevron)).toHaveLength(0);
    expect(box(sized).minHeight).toBeUndefined();
    expect(box(sized).height).toBe(48);
  });

  // UX NATIVE-P4 N1 (a352a2d): Android no longer opens the white system
  // dialog; it uses the app's dark select sheet (see "Select sheet (Android)").
  it('Android: the app select sheet over the styled box, with the chevron (no dialog-mode Picker)', () => {
    Platform.OS = 'android';
    const tree = render({ disabled: true });
    expect(tree.root.findAllByType(SelectChevron)).toHaveLength(1);
    expect(tree.root.findAll((node) => node.props.mode === 'dialog')).toHaveLength(0);
    expect(opener(tree).props.disabled).toBe(true);
    expect(opener(tree).props.accessibilityState).toEqual({ disabled: true });
    expect(opener(tree).props.accessibilityLabel).toBe('Difficulty (optional)');
  });
});

// UX NATIVE-P4 N1: every Android select opens the app's dark select sheet
// (surface-raised, hairline, 52 rows, gold check on the selected one, scrim
// 0.6), never the light system dialog.
describe('Select sheet (Android)', () => {
  const realOS = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'android';
  });
  afterEach(() => {
    Platform.OS = realOS;
  });

  const OPTIONS = [
    { value: '', label: 'Select a category' },
    { value: 'strength', label: 'Strength' },
    { value: 'cardio', label: 'Cardio' },
  ];
  const flat = (style) => StyleSheet.flatten(style) ?? {};
  const modal = (tree) => tree.root.findAll((node) => node.props.testID === 'category-modal' && typeof node.props.onRequestClose === 'function')[0];
  const opener = (tree) => tree.root.findAll((node) => node.props.testID === 'category' && typeof node.props.onPress === 'function')[0];
  const sheet = (tree) => tree.root.findAll((node) => node.props.testID === 'category-sheet' && node.props.style);
  const scrimOf = (tree) => tree.root.findAll((node) => node.props.testID === 'category-scrim' && typeof node.props.onPress === 'function')[0];
  const row = (tree, value) =>
    tree.root.findAll((node) => node.props.testID === `category-option-${value}` && typeof node.props.onPress === 'function')[0];

  function render(props = {}) {
    let tree;
    act(() => {
      tree = create(<Select testID="category" label="Category" value="strength" options={OPTIONS} onChange={() => {}} {...props} />);
    });
    return tree;
  }

  it('renders no native Picker at all on Android', () => {
    const { Picker } = jest.requireMock('@react-native-picker/picker');
    const tree = render();
    act(() => opener(tree).props.onPress());
    expect(tree.root.findAllByType(Picker)).toHaveLength(0);
    expect(tree.root.findAll((node) => node.props.mode === 'dialog')).toHaveLength(0);
  });

  it('closed by default; the tap opens the kit sheet (testID) and closes the keyboard', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    const tree = render();
    expect(modal(tree).props.visible).toBe(false);
    act(() => opener(tree).props.onPress());
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(modal(tree).props.visible).toBe(true);
    expect(sheet(tree).length).toBeGreaterThan(0);
    dismiss.mockRestore();
  });

  it('the sheet look: surface-raised, hairline edge, scrim 0.6, the label as its title', () => {
    const tree = render();
    act(() => opener(tree).props.onPress());
    const s = flat(sheet(tree)[0].props.style);
    expect(s.backgroundColor).toBe(colors.surfaceRaised);
    expect(s.borderColor).toBe(colors.hairline);
    expect(flat(scrimOf(tree).props.style).backgroundColor).toBe(colors.scrim);
    const title = sheet(tree)[0].findAll((node) => node.type === Text && node.props.children === 'Category')[0];
    expect(title.props.accessibilityRole).toBe('header');
  });

  it('a11y: a radiogroup named by the label; each row a radio with checked state; 52 tall rows', () => {
    const tree = render();
    act(() => opener(tree).props.onPress());
    const group = tree.root.findAll((node) => node.props.accessibilityRole === 'radiogroup')[0];
    expect(group.props.accessibilityLabel).toBe('Category');
    OPTIONS.forEach((option) => {
      const r = row(tree, option.value);
      expect(r.props.accessibilityRole).toBe('radio');
      expect(r.props.accessibilityLabel).toBe(option.label);
      expect(r.props.accessibilityState).toEqual({ checked: option.value === 'strength' });
      expect(flat(typeof r.props.style === 'function' ? r.props.style({ pressed: false }) : r.props.style).minHeight).toBe(52);
    });
  });

  it('the selected row shows the gold check and gold text; others show none', () => {
    const tree = render();
    act(() => opener(tree).props.onPress());
    expect(tree.root.findAll((node) => node.props.testID === 'category-check-strength')).not.toHaveLength(0);
    expect(tree.root.findAll((node) => node.props.testID === 'category-check-cardio')).toHaveLength(0);
    const selectedText = row(tree, 'strength').findAll((node) => node.type === Text && node.props.children === 'Strength')[0];
    expect(flat(selectedText.props.style).color).toBe(colors.gold);
    expect(selectedText.props.maxFontSizeMultiplier).toBe(2);
    const otherText = row(tree, 'cardio').findAll((node) => node.type === Text && node.props.children === 'Cardio')[0];
    expect(flat(otherText.props.style).color).toBe(colors.textPrimary);
  });

  it('selecting an option calls onChange with its value and closes the sheet', () => {
    const onChange = jest.fn();
    const tree = render({ onChange });
    act(() => opener(tree).props.onPress());
    act(() => row(tree, 'cardio').props.onPress());
    expect(onChange).toHaveBeenCalledWith('cardio');
    expect(modal(tree).props.visible).toBe(false);
  });

  it('the scrim and Android back close it without a change', () => {
    const onChange = jest.fn();
    const tree = render({ onChange });
    act(() => opener(tree).props.onPress());
    act(() => scrimOf(tree).props.onPress());
    expect(modal(tree).props.visible).toBe(false);
    act(() => opener(tree).props.onPress());
    act(() => modal(tree).props.onRequestClose());
    expect(modal(tree).props.visible).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a value matching no option checks the first, like a browser <select>', () => {
    const tree = render({ value: 'nope' });
    act(() => opener(tree).props.onPress());
    expect(row(tree, '').props.accessibilityState).toEqual({ checked: true });
  });

  it('disabled: the opener is disabled and the sheet stays closed', () => {
    const tree = render({ disabled: true });
    expect(opener(tree).props.disabled).toBe(true);
    expect(modal(tree).props.visible).toBe(false);
  });
});

describe('Select variants (kit 2: FormField FIELD_VARIANTS)', () => {
  const OPTS = [
    { value: 'a', label: 'Strength' },
    { value: 'b', label: 'A very long option label that wraps at large text' },
  ];
  const flat = (style) => StyleSheet.flatten(style) ?? {};
  const box = (tree) => flat(tree.root.find((node) => node.type === 'View' && node.props.pointerEvents === 'none').props.style);
  function render(props = {}) {
    let tree;
    act(() => {
      tree = create(<Select testID="s" label="Goal" value="a" options={OPTS} onChange={() => {}} {...props} />);
    });
    return tree;
  }
  const realOS = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'ios';
  });
  afterEach(() => {
    Platform.OS = realOS;
  });

  it.each([
    ['well', { backgroundColor: colors.surfaceWell, borderRadius: radii.md, borderColor: colors.hairlineStrong }],
    ['pill', { backgroundColor: colors.fillWell, borderRadius: radii.full, borderColor: colors.hairlineStrong }],
    ['raised', { backgroundColor: colors.surfaceRaised, borderRadius: radii.md, borderColor: colors.hairlineButton }],
  ])('%s: the variant box, still 52 tall with the chevron', (variant, look) => {
    const tree = render({ variant });
    expect(box(tree)).toMatchObject({ ...look, minHeight: 52 });
    expect(tree.root.findAllByType(SelectChevron)).toHaveLength(1);
  });

  it.each(['well', 'pill', 'raised'])('%s + error: the danger-text edge wins', (variant) => {
    expect(box(render({ variant, error: 'Pick one' })).borderColor).toBe(colors.dangerText);
  });

  // DECLARED change (UX final audit X2, 27 Oct 2026): was 'the value text has no line cap (wraps at large text)'
  // with expect(value.props.numberOfLines).toBeUndefined(). The value is now ONE line + a tail ellipsis at every
  // text size (same rule as T-57 L1), never cut silently; the full label stays the accessibilityValue.
  it.each(['ios', 'android'])('X2 %s: the value is one line + a tail ellipsis (no font-scale branch), the §9 body cap, full text spoken', (os) => {
    Platform.OS = os;
    const tree = render({ variant: 'pill', value: 'b' });
    const value = tree.root.findAll((node) => node.type === Text && node.props.children === OPTS[1].label)[0];
    expect(value.props.numberOfLines).toBe(1);
    expect(value.props.ellipsizeMode).toBe('tail');
    expect(value.props.adjustsFontSizeToFit).toBeUndefined();
    expect(value.props.maxFontSizeMultiplier).toBe(2);
    const opener = tree.root.findAll((node) => node.props.testID === 's' && typeof node.props.onPress === 'function')[0];
    expect(opener.props.accessibilityValue).toEqual({ text: OPTS[1].label });
  });

  it('Android: the variant box under the dialog picker', () => {
    Platform.OS = 'android';
    expect(box(render({ variant: 'raised' }))).toMatchObject({ backgroundColor: colors.surfaceRaised, borderRadius: radii.md });
  });
});
