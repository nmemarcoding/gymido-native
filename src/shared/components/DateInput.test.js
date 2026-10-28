import { Platform, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors } from '../theme/tokens';
import DateInput from './DateInput';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-community/datetimepicker', () => {
  const MockPicker = () => null;
  return MockPicker;
});

// RN-SPEC-v2-foundation §4.5 DateInput: the input style + a calendar icon;
// the platform picker stays (v1 rule).

const flat = (style) => StyleSheet.flatten(style) ?? {};
const field = (tree) => tree.root.findAll((node) => node.props.testID === 'dob' && typeof node.props.onPress === 'function')[0];
const box = (tree) => flat(tree.root.find((node) => node.type === 'View' && node.props.testID === 'dob').props.style);
const picker = (tree) => tree.root.findAll((node) => node.props.mode === 'date' && typeof node.props.onChange === 'function');
const svgCount = (tree) => tree.root.findAll((node) => node.props.viewBox === '0 0 24 24' && node.props.width === 18).length;

function render(props = {}) {
  let tree;
  act(() => {
    tree = create(<DateInput testID="dob" label="Date of Birth (optional)" value="" onChange={() => {}} {...props} />);
  });
  return tree;
}

describe('DateInput (v2 look)', () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Platform.OS = realOS;
  });

  it('empty (Android): 52 input box, faint "mm/dd/yyyy", the 18 px calendar icon, no Clear', () => {
    Platform.OS = 'android';
    const tree = render();
    const b = box(tree);
    expect(b.minHeight).toBe(52);
    expect(b.borderRadius).toBe(20);
    expect(b.borderColor).toBe(colors.hairlineStrong);
    const placeholder = tree.root.findAll((node) => node.type === Text && node.props.children === 'mm/dd/yyyy')[0];
    expect(flat(placeholder.props.style).color).toBe(colors.textFaint);
    expect(svgCount(tree)).toBe(1);
    expect(tree.root.findAll((node) => node.props.testID === 'dob-clear')).toHaveLength(0);
  });

  it('with a value: 16 px text, a gold Clear with a 44 target that clears it, and the calendar icon', () => {
    const onChange = jest.fn();
    const tree = render({ value: '1994-03-14', onChange });
    const clear = tree.root.findAll((node) => node.props.testID === 'dob-clear' && typeof node.props.onPress === 'function')[0];
    expect(clear.props.hitSlop).toBe(12);
    const clearText = tree.root.findAll((node) => node.type === Text && node.props.children === 'Clear')[0];
    expect(flat(clearText.props.style).color).toBe(colors.gold);
    act(() => clear.props.onPress());
    expect(onChange).toHaveBeenCalledWith('');
    expect(svgCount(tree)).toBe(1);
  });

  it('iOS: opening shows the focus ring and the inline dark picker in a sheet; Done closes', () => {
    Platform.OS = 'ios';
    const tree = render();
    act(() => field(tree).props.onPress());
    expect(box(tree).borderColor).toBe(colors.gold);
    expect(box(tree).outlineWidth).toBe(4);
    const [inline] = picker(tree);
    expect(inline.props.display).toBe('inline');
    expect(inline.props.themeVariant).toBe('dark');
    // FINAL-AUDIT batch 1 (4): the native wheel stays dark inside the dark sheet, never a white panel.
    expect(inline.props.textColor).toBe(colors.textPrimary);
    const sheet = tree.root.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.backgroundColor === colors.pickerSheet);
    expect(sheet.length).toBeGreaterThan(0);
    expect(colors.pickerSheet).toBe(colors.surfaceRaised);
    const done = tree.root.findAll((node) => node.props.testID === 'dob-done' && typeof node.props.onPress === 'function')[0];
    act(() => done.props.onPress());
    expect(box(tree).outlineWidth).toBeUndefined();
  });

  it('Android: opening shows the platform dialog; a set date reaches the caller as YYYY-MM-DD', () => {
    Platform.OS = 'android';
    const onChange = jest.fn();
    const tree = render({ onChange });
    expect(picker(tree)).toHaveLength(0);
    act(() => field(tree).props.onPress());
    const [dialog] = picker(tree);
    act(() => dialog.props.onChange({ type: 'set' }, new Date(2001, 0, 9)));
    expect(onChange).toHaveBeenCalledWith('2001-01-09');
    expect(picker(tree)).toHaveLength(0);
  });

  it('error: danger-text border and the announced message', () => {
    const tree = render({ error: 'Enter a valid date.' });
    expect(box(tree).borderColor).toBe(colors.dangerText);
    const message = tree.root.findAll((node) => node.type === Text && node.props.children === 'Enter a valid date.')[0];
    expect(message.props.accessibilityRole).toBe('alert');
  });

  // UX native final audit 27 Oct 2026, ruling 5 (A100 Create profile, A154
  // Edit profile): the date never breaks inside the value ("10/15/197" / "8")
  // or the placeholder ("mm/dd/ / yyyy"); one line that shrinks to fit.
  const TOKEN_PROPS = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.75, textBreakStrategy: 'simple' };
  const layout = (tree, width) => act(() => host(tree).props.onLayout({ nativeEvent: { layout: { width, height: 52, x: 0, y: 0 } } }));
  const host = (tree) => tree.root.find((node) => node.type === 'View' && node.props.testID === 'dob');
  const valueText = (tree, text) => tree.root.findAll((node) => node.type === Text && node.props.children === text)[0];

  it('ruling 5: the value and the placeholder stay one line and shrink instead of breaking', () => {
    Platform.OS = 'android';
    const filled = render({ value: '1978-10-15' });
    const shown = filled.root.findAll((node) => node.type === Text && /1978/.test(String(node.props.children)))[0];
    expect(shown.props).toMatchObject(TOKEN_PROPS);
    expect(valueText(render(), 'mm/dd/yyyy').props).toMatchObject(TOKEN_PROPS);
  });

  it('ruling 5: in a half-width cell the inline Clear drops to a 44-target × icon and the value keeps the room', () => {
    const onChange = jest.fn();
    const tree = render({ value: '1978-10-15', onChange });
    layout(tree, 150);
    expect(valueText(tree, 'Clear')).toBeUndefined();
    const clear = tree.root.findAll((node) => node.props.testID === 'dob-clear' && typeof node.props.onPress === 'function')[0];
    expect(clear.props.accessibilityLabel).toBe('Clear');
    expect(clear.props.hitSlop).toBe(13);
    expect(clear.findAll((node) => node.props.viewBox === '0 0 24 24' && node.props.width === 16)).not.toHaveLength(0);
    // The × only: the calendar icon steps aside while there's a value.
    expect(svgCount(tree)).toBe(0);
    act(() => clear.props.onPress());
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('ruling 5: a wide box keeps the gold "Clear" word and the calendar icon', () => {
    const tree = render({ value: '1978-10-15' });
    layout(tree, 600);
    expect(valueText(tree, 'Clear')).toBeDefined();
    expect(svgCount(tree)).toBe(1);
  });
});
