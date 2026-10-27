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

  it('Android: the platform dialog picker over the styled box, with the chevron', () => {
    Platform.OS = 'android';
    const tree = render({ disabled: true });
    expect(tree.root.findAllByType(SelectChevron)).toHaveLength(1);
    const picker = tree.root.findAll((node) => node.props.testID === 'difficulty' && node.props.mode === 'dialog')[0];
    expect(picker.props.enabled).toBe(false);
    expect(picker.props.prompt).toBe('Difficulty (optional)');
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

  it('the value text has no line cap (wraps at large text) and the §9 body cap', () => {
    const tree = render({ variant: 'pill', value: 'b' });
    const value = tree.root.findAll((node) => node.type === Text && node.props.children === OPTS[1].label)[0];
    expect(value.props.numberOfLines).toBeUndefined();
    expect(value.props.maxFontSizeMultiplier).toBe(2);
  });

  it('Android: the variant box under the dialog picker', () => {
    Platform.OS = 'android';
    expect(box(render({ variant: 'raised' }))).toMatchObject({ backgroundColor: colors.surfaceRaised, borderRadius: radii.md });
  });
});
