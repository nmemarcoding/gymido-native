// RN-SPEC-v2-phase2 A5: Not found (phone per the board; tablet ruling ND5).
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});
let mockWindow = { width: 390, height: 844 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ ...mockWindow, scale: 3, fontScale: 1 }),
}));

import { StyleSheet } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { act, create } from 'react-test-renderer';

import PillButton from '../../shared/components/PillButton';
import Screen from '../../shared/components/Screen';
import { colors } from '../../shared/theme/tokens';
import NotFoundScreen, { NUMERAL } from './NotFoundScreen';

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}
const host = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const flat = (node) => StyleSheet.flatten(node.props.style);
const readable = (tree) =>
  tree.root.findAll((node) => node.type === 'Text').map((node) => [].concat(node.props.children).join(''));

beforeEach(() => {
  mockWindow = { width: 390, height: 844 };
});

describe('A5 Not found', () => {
  it('phone: outline 404 (decorative), heading, body and the gold 60 full-width Go home; no glow', () => {
    const tree = render(<NotFoundScreen onGoHome={jest.fn()} />);
    expect(tree.root.find((node) => node.type === Screen).props.glow).toBeUndefined();
    const numeral = host(tree, 'not-found-numeral');
    expect(numeral.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
    const svg = tree.root.find((node) => node.type === Svg);
    expect(svg.props).toMatchObject({ width: NUMERAL.width, height: NUMERAL.lineHeight });
    const glyphs = tree.root.find((node) => node.type === SvgText);
    expect(glyphs.props).toMatchObject({ fill: 'none', stroke: colors.notFoundStroke, strokeWidth: 2, fontSize: 150, textAnchor: 'start' });
    expect(glyphs.props.children).toBe('404');
    // The "404" is not readable text; the heading carries the meaning.
    expect(readable(tree)).toEqual(['Page not found', 'The requested page does not exist. Return to the app home to keep going.', 'Go home']);
    const heading = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(flat(heading)).toMatchObject({ fontSize: 36, lineHeight: 40, color: colors.textPrimary });
    expect(tree.root.find((node) => node.type === PillButton).props).toMatchObject({
      title: 'Go home',
      size: 'cta',
      fullWidth: true,
      testID: 'not-found-home',
    });
    expect(flat(host(tree, 'not-found-column')).paddingTop).toBe(103);
  });

  it('Go home calls onGoHome (Home) once per press', () => {
    const onGoHome = jest.fn();
    const tree = render(<NotFoundScreen onGoHome={onGoHome} />);
    act(() => tree.root.find((node) => node.type === PillButton).props.onPress());
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it('Go home: pressed is the deep gold; 60 tall (≥ 44)', () => {
    const tree = render(<NotFoundScreen onGoHome={jest.fn()} />);
    const pressable = tree.root.find((node) => node.props.testID === 'not-found-home' && typeof node.props.style === 'function');
    expect(StyleSheet.flatten(pressable.props.style({ pressed: true }))).toMatchObject({ backgroundColor: colors.goldDeep, minHeight: 60 });
  });

  it.each([
    ['portrait', { width: 834, height: 1194 }],
    ['landscape', { width: 1194, height: 834 }],
  ])('tablet %s (ND5): the same outline 404 + copy + gold Go home, centred in a 640 column', (_, window) => {
    mockWindow = window;
    const tree = render(<NotFoundScreen onGoHome={jest.fn()} />);
    expect(flat(host(tree, 'not-found-column'))).toMatchObject({ maxWidth: 640, alignSelf: 'center', alignItems: 'center' });
    const glyphs = tree.root.find((node) => node.type === SvgText);
    expect(glyphs.props).toMatchObject({ textAnchor: 'middle', x: NUMERAL.width / 2, stroke: colors.notFoundStroke });
    const heading = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(flat(heading).textAlign).toBe('center');
    const home = tree.root.find((node) => node.type === PillButton);
    expect(home.props).toMatchObject({ size: 'cta', fullWidth: false, variant: 'primary' });
    expect(readable(tree)).toEqual(['Page not found', 'The requested page does not exist. Return to the app home to keep going.', 'Go home']);
  });
});
