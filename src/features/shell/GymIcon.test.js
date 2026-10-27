import { StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';
import { act, create } from 'react-test-renderer';

import { colors } from '../../shared/theme/tokens';
import GymIcon from './GymIcon';

const NAMES = ['workout', 'exercises', 'library', 'progress', 'trainer', 'settings', 'dashboard', 'users', 'plans', 'profile'];

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

describe('GymIcon (v2 §3 icon rule)', () => {
  it.each(NAMES)('%s: stroke 2.2–2.6, round caps and joins, explicit size, hidden', (name) => {
    const svg = render(<GymIcon name={name} size={22} color={colors.textPrimary} />).root.findByType(Svg);
    expect(svg.props.strokeWidth).toBeGreaterThanOrEqual(2.2);
    expect(svg.props.strokeWidth).toBeLessThanOrEqual(2.6);
    expect(svg.props).toMatchObject({
      width: 22,
      height: 22,
      viewBox: '0 0 32 32',
      fill: 'none',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
  });

  it('draws the board strokes: workout 2.6, the others 2.4', () => {
    const stroke = (name) => render(<GymIcon name={name} />).root.findByType(Svg).props.strokeWidth;
    expect(stroke('workout')).toBe(2.6);
    NAMES.filter((name) => name !== 'workout').forEach((name) => expect(stroke(name)).toBe(2.4));
  });

  it('keeps the default 28 size and passes the colour through', () => {
    const svg = render(<GymIcon name="plans" color={colors.gold} />).root.findByType(Svg);
    expect(svg.props).toMatchObject({ width: 28, height: 28, stroke: colors.gold });
  });

  it('renders an empty box of the size for an unknown name', () => {
    const tree = render(<GymIcon name="nope" size={24} />);
    expect(tree.root.findAllByType(Svg)).toHaveLength(0);
    expect(StyleSheet.flatten(tree.root.findByType(View).props.style)).toEqual({ width: 24, height: 24 });
  });
});

describe('mail (UX §8.3)', () => {
  it('the 24-grid drawing scaled onto 32: stroke 2.2 × 4/3, a rect and the flap, explicit size', () => {
    const tree = render(<GymIcon name="mail" size={18} color={colors.gold} />);
    const svg = tree.root.findByType(Svg);
    expect(svg.props).toMatchObject({ width: 18, height: 18, viewBox: '0 0 32 32', stroke: colors.gold, strokeWidth: 2.93, fill: 'none' });
    const types = tree.root.findAll((node) => typeof node.type !== 'string' && node.props.d !== undefined).map((node) => node.props.d);
    expect(types).toContain('M4 9.33l12 8 12-8');
    expect(tree.root.findAll((node) => node.props.rx === 2.67 && node.props.width === 24)).not.toHaveLength(0);
  });
});
