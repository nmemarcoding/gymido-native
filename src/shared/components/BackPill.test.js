import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, radii } from '../theme/tokens';
import BackPill from './BackPill';

// UX native final audit 27 Oct 2026, ruling 6: the coaching / trainer back
// controls are the boards' glass pill, 44 phone / 40 tablet.

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

function render(element, width = 390) {
  useWindowDimensions.mockReturnValue({ width, height: 844, scale: 3, fontScale: 1 });
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const host = (tree, id) => tree.root.findAll((node) => typeof node.type === 'string' && node.props.testID === id)[0];
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.children === 'function')[0];

describe('BackPill (ruling 6)', () => {
  it('phone: a 44 glass pill (white 7 % fill, 1 px white 10 %, full radius) with a chevron and the parent name', () => {
    const tree = render(<BackPill testID="back" label="All trainers" onPress={() => {}} />);
    expect(StyleSheet.flatten(host(tree, 'back').props.style)).toMatchObject({
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      backgroundColor: colors.hairline,
      paddingLeft: 8,
      paddingRight: 14,
    });
    expect(host(tree, 'back-chevron')).toBeTruthy();
    const label = tree.root.findAllByType(Text)[0];
    expect(label.props.children).toBe('All trainers');
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({ fontSize: 14, fontFamily: 'Geist-SemiBold', color: colors.textPrimary });
    expect(pressable(tree, 'back').props.hitSlop).toBeUndefined();
  });

  it('tablet (≥ 768): 40 tall, the hit area stays 44', () => {
    const tree = render(<BackPill testID="back" label="Coaching" onPress={() => {}} />, 834);
    expect(StyleSheet.flatten(host(tree, 'back').props.style).minHeight).toBe(40);
    const { hitSlop } = pressable(tree, 'back').props;
    expect(40 + hitSlop.top + hitSlop.bottom).toBe(44);
  });

  it('a link named by the parent only; the chevron is decorative', () => {
    const onPress = jest.fn();
    const tree = render(<BackPill testID="back" label="Profile" onPress={onPress} />);
    const link = pressable(tree, 'back');
    expect(link.props).toMatchObject({ accessibilityRole: 'link', accessibilityLabel: 'Profile' });
    const hidden = tree.root.findAll(
      (node) => node.type === 'View' && node.props.accessibilityElementsHidden === true && node.props.importantForAccessibility === 'no-hide-descendants',
    );
    expect(hidden.some((box) => box.findAll((node) => node.props.testID === 'back-chevron').length > 0)).toBe(true);
    act(() => link.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('pressed: the 4 % overlay over the rest fill (§8.6), nothing at rest', () => {
    const link = pressable(render(<BackPill testID="back" label="Profile" onPress={() => {}} />), 'back');
    let rest;
    let pressed;
    act(() => {
      rest = create(<>{link.props.children({ pressed: false })}</>);
      pressed = create(<>{link.props.children({ pressed: true })}</>);
    });
    expect(rest.root.findAll((node) => node.props?.testID === 'back-pressed')).toHaveLength(0);
    const overlay = pressed.root.findAll((node) => typeof node.type === 'string' && node.props?.testID === 'back-pressed')[0];
    expect(StyleSheet.flatten(overlay.props.style).backgroundColor).toBe(colors.pressOverlay);
  });
});
