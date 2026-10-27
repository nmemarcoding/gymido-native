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
});
