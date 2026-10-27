// RN-SPEC-v2-phase2 §A7 (dated change to app-shell §9.2, ruling ND3): the
// route error card AS DRAWN, gold "Reload app"; behaviour unchanged.
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children, ...props }) => <View {...props}>{children}</View> };
});
jest.mock('expo', () => ({ reloadAppAsync: jest.fn() }));

import { reloadAppAsync } from 'expo';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, layout, textScale } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';
import PillButton from './PillButton';
import RouteErrorBoundary, { RouteErrorFallback } from './RouteErrorBoundary';

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}
const host = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const flat = (node) => StyleSheet.flatten(node.props.style);

describe('A7 Route error (crash fallback)', () => {
  it('a surface card, max 560, centred, 16 sides; the danger icon tile with the triangle', () => {
    const tree = render(<RouteErrorFallback onReload={jest.fn()} />);
    expect(flat(host(tree, 'route-error'))).toMatchObject({ backgroundColor: colors.ground, paddingHorizontal: layout.gutter });
    expect(flat(host(tree, 'route-error-card'))).toMatchObject({ backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: 32 });
    expect(flat(host(tree, 'route-error-region'))).toMatchObject({ maxWidth: 560, alignSelf: 'center' });
    expect(flat(host(tree, 'route-error-icon'))).toMatchObject({ width: 60, height: 60, backgroundColor: colors.dangerTint });
    expect(tree.root.find((node) => node.type === FeedbackIcon).props).toMatchObject({ name: 'warning', size: 26, color: colors.dangerText });
  });

  it('role alert, one polite live region, a heading, the v1 copy', () => {
    const tree = render(<RouteErrorFallback onReload={jest.fn()} />);
    expect(host(tree, 'route-error-card').props).toMatchObject({ accessibilityRole: 'alert', accessibilityLiveRegion: 'polite' });
    const heading = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(heading.props.children).toBe('Something went wrong');
    expect(flat(heading)).toMatchObject({ fontSize: 28, lineHeight: 32, textAlign: 'center' });
  });

  it('"Reload app" is the GOLD primary (default 52, ≥ 44) and calls onReload', () => {
    const onReload = jest.fn();
    const tree = render(<RouteErrorFallback onReload={onReload} />);
    const reload = tree.root.find((node) => node.type === PillButton);
    expect(reload.props.title).toBe('Reload app');
    expect(reload.props.variant).toBeUndefined(); // PillButton default = primary (gold)
    const pressable = tree.root.find((node) => node.props.testID === 'route-error-reload' && typeof node.props.style === 'function');
    expect(StyleSheet.flatten(pressable.props.style({ pressed: false }))).toMatchObject({ backgroundColor: colors.gold, minHeight: 52 });
    expect(StyleSheet.flatten(pressable.props.style({ pressed: true })).backgroundColor).toBe(colors.goldDeep);
    act(() => reload.props.onPress());
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('the boundary reloads with reloadAppAsync by default (full reload) and never resets on its own', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    function Boom() {
      throw new Error('boom');
    }
    const tree = render(
      <RouteErrorBoundary>
        <Boom />
      </RouteErrorBoundary>
    );
    act(() => tree.root.find((node) => node.type === PillButton).props.onPress());
    expect(reloadAppAsync).toHaveBeenCalledTimes(1);
    act(() =>
      tree.update(
        <RouteErrorBoundary>
          <Text>ok</Text>
        </RouteErrorBoundary>
      )
    );
    expect(tree.root.findAll((node) => node.props.testID === 'route-error-card')).not.toHaveLength(0);
    console.error.mockRestore();
  });
});

describe('A7 Route error: UX §8.5 colour + §9 large text', () => {
  it('the icon tile is danger-tint 0.14 on the #FF5A4E family (board danger 0.12 → tint), the glyph danger-text', () => {
    const tree = render(<RouteErrorFallback onReload={jest.fn()} />);
    expect(colors.dangerTint).toBe('rgba(255, 90, 78, 0.14)');
    expect(flat(host(tree, 'route-error-icon')).backgroundColor).toBe(colors.dangerTint);
    expect(tree.root.find((node) => node.type === FeedbackIcon).props.color).toBe(colors.dangerText);
  });

  it('title: capped at textScale.title (28 = title-*), max 3 lines by word, a long word shrinks; body capped at textScale.body', () => {
    const tree = render(<RouteErrorFallback onReload={jest.fn()} />);
    expect(host(tree, 'route-error-title').props).toMatchObject({
      maxFontSizeMultiplier: textScale.title,
      numberOfLines: 3,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.7,
      textBreakStrategy: 'simple',
    });
    expect(host(tree, 'route-error-body').props.maxFontSizeMultiplier).toBe(textScale.body);
    expect(host(tree, 'route-error-body').props.numberOfLines).toBeUndefined();
  });

  it('AX5: the card scrolls inside the safe area (never clipped); no fixed heights on text; Reload app never truncates', () => {
    const tree = render(<RouteErrorFallback onReload={jest.fn()} />);
    const scroll = tree.root.findByType(ScrollView);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({ flexGrow: 1 });
    expect(flat(host(tree, 'route-error-region'))).toMatchObject({ flexGrow: 1, justifyContent: 'center' });
    expect(flat(host(tree, 'route-error-region')).flex).toBeUndefined();
    for (const id of ['route-error-card', 'route-error-title', 'route-error-body']) {
      expect(flat(host(tree, id)).height).toBeUndefined();
    }
    const label = tree.root.find((node) => node.type === 'Text' && node.props.children === 'Reload app');
    expect(label.props.numberOfLines).toBeUndefined();
  });
});
