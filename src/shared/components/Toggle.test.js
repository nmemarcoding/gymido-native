import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors } from '../theme/tokens';
import Toggle, { TOGGLE_HIT, toggleMetrics } from './Toggle';

// UX native final audit 27 Oct 2026, ruling 11 (A145): on = gold track + a
// white knob on the right; off = the white 0.14 track + the knob on the left;
// hit area 44; visual 51×31 (iOS) / 52×32 (Android).

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const host = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const flat = (node) => StyleSheet.flatten(node.props.style);

describe('Toggle', () => {
  it('ruling 11: on = the gold track, the knob on the right', () => {
    const tree = render(<Toggle testID="t" value onValueChange={() => {}} accessibilityLabel="Sound" />);
    expect(flat(host(tree, 't-track'))).toMatchObject({ backgroundColor: colors.gold, alignItems: 'flex-end' });
  });

  it('ruling 11: off = the white 0.14 track, the knob on the left', () => {
    const tree = render(<Toggle testID="t" value={false} onValueChange={() => {}} accessibilityLabel="Sound" />);
    expect(colors.switchTrackOff).toBe('rgba(255, 255, 255, 0.14)');
    expect(flat(host(tree, 't-track'))).toMatchObject({ backgroundColor: colors.switchTrackOff, alignItems: 'flex-start' });
  });

  it('ruling 11: the knob is white in both states', () => {
    expect(colors.switchKnob).toBe('#FFFFFF');
    [true, false].forEach((value) => {
      const tree = render(<Toggle testID="t" value={value} onValueChange={() => {}} accessibilityLabel="Sound" />);
      expect(flat(host(tree, 't-knob')).backgroundColor).toBe(colors.switchKnob);
    });
  });

  it('ruling 11: the visual is 51×31 on iOS and 52×32 on Android, a round track and knob', () => {
    expect(toggleMetrics('ios')).toEqual({ width: 51, height: 31, knob: 27 });
    expect(toggleMetrics('android')).toEqual({ width: 52, height: 32, knob: 28 });
    // Jest runs as iOS.
    const tree = render(<Toggle testID="t" value onValueChange={() => {}} accessibilityLabel="Sound" />);
    expect(flat(host(tree, 't-track'))).toMatchObject({ width: 51, height: 31, borderRadius: 15.5, padding: 2 });
    expect(flat(host(tree, 't-knob'))).toMatchObject({ width: 27, height: 27, borderRadius: 13.5 });
  });

  it('ruling 11: the hit area is at least 44×44', () => {
    expect(TOGGLE_HIT).toBe(44);
    const tree = render(<Toggle testID="t" value onValueChange={() => {}} accessibilityLabel="Sound" />);
    expect(flat(host(tree, 't'))).toMatchObject({ minWidth: 44, minHeight: 44 });
  });

  it('a switch with its checked state; a press flips the value', () => {
    const onValueChange = jest.fn();
    const tree = render(<Toggle testID="t" value={false} onValueChange={onValueChange} accessibilityLabel="Sound" />);
    const node = host(tree, 't');
    expect(node.props).toMatchObject({ accessibilityRole: 'switch', accessibilityState: { checked: false }, accessibilityLabel: 'Sound' });
    act(() => {
      tree.root.find((n) => n.props.testID === 't' && n.props.onPress).props.onPress();
    });
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('decorative (inside a row that is the switch): hidden from accessibility', () => {
    const tree = render(<Toggle testID="t" value onValueChange={() => {}} decorative />);
    expect(host(tree, 't').props).toMatchObject({ accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  });
});
