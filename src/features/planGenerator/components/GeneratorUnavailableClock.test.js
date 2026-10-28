import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';
import Svg, { Circle, Path } from 'react-native-svg';

import { GeneratorUnavailable } from './GeneratorStates';

// Lead UX parity ruling (board G1, "Generator turned off"): a solid gold 72
// tile, radius 24 (radii.xl), the gold glow, and a 24 px CLOCK glyph (circle
// r9 + hands "M12 7v5l3 2"), stroke 2.0 in on-gold, at EVERY width.

let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const { colors, radii } = require('../../../shared/theme/tokens');

const render = (element) => {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
};
const host = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');

describe('G1 "Generator turned off": the clock tile (UX parity ruling)', () => {
  it.each([
    ['phone 390', 390],
    ['tablet portrait 834', 834],
    ['tablet landscape 1194', 1194],
  ])('%s: solid gold 72 tile, radius-xl 24, gold glow; 24 px clock glyph, stroke 2.0 on-gold', (_label, width) => {
    mockWindow = { width, height: 1000, scale: 2, fontScale: 1 };
    const tree = render(<GeneratorUnavailable onBack={() => {}} />);
    const tile = StyleSheet.flatten(host(tree, 'generator-unavailable-icon').props.style);
    expect(tile).toMatchObject({ width: 72, height: 72, borderRadius: radii.xl, backgroundColor: colors.gold });
    // DECLARED (T-86): was boxShadow shadows.goldGlow; a tile carries no gold glow.
    expect(tile.boxShadow).toBeUndefined();
    expect(radii.xl).toBe(24);
    // Solid: no gradient inside the tile.
    expect(host(tree, 'generator-unavailable-icon').findAll((node) => node.props.radial !== undefined || node.props.angle !== undefined)).toHaveLength(0);

    const svg = tree.root.find((node) => node.type === Svg && node.props.testID === 'generator-unavailable-clock');
    expect(svg.props).toMatchObject({ width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: colors.onGold, strokeWidth: 2 });
    expect(svg.props.accessibilityElementsHidden).toBe(true);
    const circle = svg.findByType(Circle);
    expect(circle.props).toMatchObject({ cx: '12', cy: '12', r: '9' });
    expect(svg.findAllByType(Path).map((node) => node.props.d)).toEqual(['M12 7v5l3 2']);
  });
});
