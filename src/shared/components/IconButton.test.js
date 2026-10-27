import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, radii } from '../theme/tokens';
import IconButton from './IconButton';

// RN-SPEC-v2-foundation §4.2 Icon button.

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const pressableOf = (tree) => tree.root.findAll((node) => typeof node.type !== 'string' && node.props.accessibilityRole && typeof node.props.style !== 'undefined' && node.props.onPress !== undefined)[0];
const styleAt = (tree, pressed) => StyleSheet.flatten(pressableOf(tree).props.style({ pressed }));
const iconProps = (props) => {
  const icon = jest.fn(() => <Text>x</Text>);
  render(<IconButton accessibilityLabel="Close" onPress={() => {}} {...props}>{icon}</IconButton>);
  return icon.mock.calls.at(-1)[0];
};

describe('IconButton', () => {
  it('default: 44 circle, white 7 % fill, 1 px white 10 % border, labelled button', () => {
    const tree = render(<IconButton testID="close" accessibilityLabel="Close" onPress={() => {}}><Text>x</Text></IconButton>);
    expect(styleAt(tree, false)).toMatchObject({
      width: 44,
      height: 44,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      backgroundColor: colors.hairline,
    });
    expect(colors.hairline).toBe('rgba(255, 255, 255, 0.07)');
    expect(colors.hairlineStrong).toBe('rgba(255, 255, 255, 0.10)');
    const pressable = pressableOf(tree);
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe('Close');
    expect(pressable.props.testID).toBe('close');
    expect(pressable.props.accessibilityState).toEqual({});
  });

  it('the icon takes the text-primary ink', () => {
    expect(iconProps({}).color).toBe(colors.textPrimary);
  });

  it('pressed: the fill steps up to the 12 % hairline', () => {
    const tree = render(<IconButton accessibilityLabel="Close" onPress={() => {}} />);
    expect(styleAt(tree, true).backgroundColor).toBe(colors.hairlineButton);
  });

  it('active: gold fill and border, on-gold icon; pressed = goldDeep', () => {
    const tree = render(<IconButton active accessibilityLabel="Add weight" onPress={() => {}} />);
    expect(styleAt(tree, false)).toMatchObject({ backgroundColor: colors.gold, borderColor: colors.gold });
    expect(styleAt(tree, true)).toMatchObject({ backgroundColor: colors.goldDeep, borderColor: colors.goldDeep });
    expect(iconProps({ active: true }).color).toBe(colors.onGold);
  });

  it('passes the pressed state to a render-prop icon', () => {
    const icon = jest.fn(() => null);
    const tree = render(<IconButton accessibilityLabel="Close" onPress={() => {}}>{icon}</IconButton>);
    act(() => {
      pressableOf(tree).props.children({ pressed: true });
    });
    expect(icon).toHaveBeenLastCalledWith({ color: colors.textPrimary, pressed: true });
  });

  it('a press calls onPress', () => {
    const onPress = jest.fn();
    const tree = render(<IconButton accessibilityLabel="Close" onPress={onPress} />);
    act(() => pressableOf(tree).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled: opacity 0.5, not pressable, announced, no pressed look', () => {
    const tree = render(<IconButton disabled accessibilityLabel="Close" onPress={() => {}} />);
    expect(pressableOf(tree).props.disabled).toBe(true);
    expect(pressableOf(tree).props.accessibilityState).toEqual({ disabled: true });
    expect(styleAt(tree, false).opacity).toBe(0.5);
    expect(styleAt(tree, true).backgroundColor).toBe(colors.hairline);
  });

  it('merges the caller accessibilityState (the bell passes expanded)', () => {
    const tree = render(<IconButton accessibilityLabel="Notifications" accessibilityState={{ expanded: true }} onPress={() => {}} />);
    expect(pressableOf(tree).props.accessibilityState).toEqual({ expanded: true });
  });

  it('badge dot: 8 px danger dot at top 9 / right 10 with a 2 px ground ring', () => {
    const tree = render(<IconButton testID="bell" badge accessibilityLabel="Notifications, 2 unread" onPress={() => {}} />);
    const dot = StyleSheet.flatten(tree.root.find((node) => node.props.testID === 'bell-badge').props.style);
    expect(dot).toMatchObject({ position: 'absolute', backgroundColor: colors.dangerDot, borderWidth: 2, borderColor: colors.ground });
    // The ring sits outside the 8 px dot; offsets are inside the 1 px edge.
    expect(dot.width - 2 * dot.borderWidth).toBe(8);
    expect(dot.top + dot.borderWidth + 1).toBe(9);
    expect(dot.right + dot.borderWidth + 1).toBe(10);
  });

  it('no badge dot by default', () => {
    const tree = render(<IconButton testID="bell" accessibilityLabel="Notifications" onPress={() => {}} />);
    expect(tree.root.findAll((node) => node.props.testID === 'bell-badge')).toHaveLength(0);
  });

  it('forwards ref and hitSlop', () => {
    const ref = { current: null };
    const tree = render(<IconButton ref={ref} hitSlop={6} accessibilityLabel="Close" onPress={() => {}} />);
    expect(pressableOf(tree).props.hitSlop).toBe(6);
    expect(ref.current).not.toBeNull();
  });
});
