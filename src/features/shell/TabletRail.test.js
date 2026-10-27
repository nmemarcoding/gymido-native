import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import GymIcon from './GymIcon';
import TabletRail from './TabletRail';

const mockInsets = { top: 24, bottom: 20, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('./shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./shellUiStore', () => ({ closePanel: jest.fn() }));
// The text scale (React Native's Jest setup reports 2 otherwise).
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 834, height: 1194, scale: 2, fontScale: mockFontScale }),
}));

const { openShellPath } = require('./shellLinks');
const { closePanel } = require('./shellUiStore');

const GOLD = '#FFC21A';
const MUTED = '#9BA1AD';
const PRIMARY = '#F5F6F8';

function render(props) {
  let tree;
  act(() => {
    tree = create(<TabletRail mode="member" path="/" {...props} />);
  });
  return tree;
}

const host = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const isItem = (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('rail-') && typeof node.props.style === 'function';
const items = (tree) => tree.root.findAll(isItem);
const item = (tree, key) => items(tree).find((node) => node.props.testID === `rail-${key}`);
const itemStyle = (tree, key, pressed = false) => StyleSheet.flatten(item(tree, key).props.style({ pressed }));
function inner(node, pressed = false) {
  let tree;
  act(() => {
    tree = create(<>{node.props.children({ pressed })}</>);
  });
  return { icon: tree.root.findByType(GymIcon), labels: tree.root.findAllByType(Text) };
}

const realOS = Platform.OS;
afterEach(() => {
  jest.clearAllMocks();
  mockFontScale = 1;
  Platform.OS = realOS;
  Object.assign(mockInsets, { top: 24, bottom: 20, left: 0, right: 0 });
});

describe('TabletRail geometry (RN-SPEC-v2-foundation §7.2, tablet boards)', () => {
  it('is an 88 wide column, color-surface with a hairline on the content side', () => {
    const rail = StyleSheet.flatten(host(render(), 'tablet-rail').props.style);
    expect(rail).toMatchObject({ width: 88, backgroundColor: '#15171D', borderRightWidth: 1, borderRightColor: 'rgba(255, 255, 255, 0.07)' });
  });

  it('safe area: the top/bottom insets pad it; the left inset widens it (landscape)', () => {
    Object.assign(mockInsets, { top: 0, bottom: 24, left: 44, right: 44 });
    const rail = StyleSheet.flatten(host(render(), 'tablet-rail').props.style);
    expect(rail).toMatchObject({ width: 88 + 44, paddingLeft: 44, paddingTop: 0 + 24, paddingBottom: 24 + 24 });
  });

  it('scrolls on short landscape windows instead of clipping', () => {
    expect(render().root.findAllByType(ScrollView)).toHaveLength(1);
  });

  it('draws the solid gold "G" tile on top, announced as Gymido', () => {
    const tree = render();
    const mark = host(tree, 'tablet-rail-mark');
    expect(mark.props).toMatchObject({ accessible: true, accessibilityRole: 'image', accessibilityLabel: 'Gymido' });
    expect(StyleSheet.flatten(mark.props.style)).toMatchObject({ width: 44, height: 44, borderRadius: 12, backgroundColor: GOLD });
    const letter = mark.findByType(Text);
    expect(letter.props.children).toBe('G');
    expect(StyleSheet.flatten(letter.props.style).color).toBe('#0A0B0F');
  });

  it('items: 72 wide, min 64 tall (≥ 44 target), radius 20, a 22 icon over an 11 px label, gap 4', () => {
    const tree = render();
    expect(itemStyle(tree, 'Plans')).toMatchObject({ width: 72, minHeight: 64, borderRadius: 20, gap: 4 });
    expect(itemStyle(tree, 'Plans').height).toBeUndefined();
    const { icon, labels } = inner(item(tree, 'Plans'));
    expect(icon.props.size).toBe(22);
    expect(StyleSheet.flatten(labels[0].props.style).fontSize).toBe(11);
  });
});

describe('TabletRail items per mode (same items as the tab bar)', () => {
  it('member: Today, Plans, Exercises, Progress, Profile', () => {
    expect(items(render()).map((node) => node.props.accessibilityLabel)).toEqual(['Today', 'Plans', 'Exercises', 'Progress', 'Profile']);
  });

  it('trainer: Today, Clients, Plans, Profile', () => {
    const tree = render({ mode: 'trainer', path: '/trainer' });
    expect(items(tree).map((node) => node.props.accessibilityLabel)).toEqual(['Today', 'Clients', 'Plans', 'Profile']);
    expect(items(tree).map((node) => node.props.testID)).toEqual(['rail-TToday', 'rail-TClients', 'rail-TPlans', 'rail-TProfile']);
  });
});

describe('TabletRail active state', () => {
  it('active: gold tint 0.16 fill, gold icon, 11/600 gold label, selected', () => {
    const tree = render({ path: '/plans/12' });
    const plans = item(tree, 'Plans');
    expect(plans.props.accessibilityState).toEqual({ selected: true });
    expect(itemStyle(tree, 'Plans').backgroundColor).toBe('rgba(255, 194, 26, 0.16)');
    const { icon, labels } = inner(plans);
    expect(icon.props.color).toBe(GOLD);
    expect(StyleSheet.flatten(labels[0].props.style)).toMatchObject({ color: GOLD, fontFamily: 'Geist-SemiBold' });
  });

  it('inactive: muted 500, no fill; pressed: chip fill and primary ink', () => {
    const tree = render({ path: '/plans' });
    const today = item(tree, 'Today');
    expect(today.props.accessibilityState).toEqual({ selected: false });
    expect(itemStyle(tree, 'Today').backgroundColor).toBeUndefined();
    expect(StyleSheet.flatten(inner(today).labels[0].props.style)).toMatchObject({ color: MUTED, fontFamily: 'Geist-Medium' });
    expect(itemStyle(tree, 'Today', true).backgroundColor).toBe('rgba(255, 255, 255, 0.05)');
    expect(inner(today, true).icon.props.color).toBe(PRIMARY);
  });

  it('follows the tab bar path rules: Today owns /workout, Profile owns the coaching pages', () => {
    expect(item(render({ path: '/workout' }), 'Today').props.accessibilityState.selected).toBe(true);
    expect(item(render({ path: '/my-trainer' }), 'Profile').props.accessibilityState.selected).toBe(true);
    expect(item(render({ path: '/exercises/5' }), 'Exercises').props.accessibilityState.selected).toBe(true);
    const trainer = render({ mode: 'trainer', path: '/trainer/clients/7' });
    expect(item(trainer, 'TClients').props.accessibilityState.selected).toBe(true);
    expect(item(trainer, 'TToday').props.accessibilityState.selected).toBe(false);
  });
});

describe('TabletRail navigation (as the tab bar)', () => {
  it('a press closes the notification panel and opens the tab root', () => {
    const tree = render({ path: '/plans' });
    act(() => item(tree, 'Exercises').props.onPress());
    expect(closePanel).toHaveBeenCalledTimes(1);
    expect(openShellPath).toHaveBeenCalledWith('/exercises');
  });

  it('trainer items open the trainer roots', () => {
    const tree = render({ mode: 'trainer', path: '/trainer' });
    act(() => item(tree, 'TClients').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/trainer/clients');
    act(() => item(tree, 'TToday').props.onPress());
    expect(openShellPath).toHaveBeenLastCalledWith('/trainer');
  });
});

describe('TabletRail accessibility', () => {
  it('a tablist of tabs, each named and with its selected state', () => {
    const tree = render();
    expect(tree.root.findAll((node) => node.props.accessibilityRole === 'tablist' && typeof node.type === 'string')).toHaveLength(1);
    items(tree).forEach((node) => {
      expect(node.props.accessibilityRole).toBe('tab');
      expect(typeof node.props.accessibilityLabel).toBe('string');
      expect(typeof node.props.accessibilityState.selected).toBe('boolean');
    });
  });
});

describe('TabletRail large text (UX §9 "Rail (tablet): the same rule")', () => {
  it('fontScale 1: labels shown, capped at 1.2, one line, no Large Content Viewer', () => {
    const tree = render();
    const { labels } = inner(item(tree, 'Exercises'));
    expect(labels[0].props).toMatchObject({ maxFontSizeMultiplier: 1.2, numberOfLines: 1, children: 'Exercises' });
    expect(item(tree, 'Exercises').props.accessibilityShowsLargeContentViewer).toBe(false);
  });

  it.each([2, 3.1])('fontScale %s: icons only, names kept for screen readers and the Large Content Viewer', (scale) => {
    mockFontScale = scale;
    const tree = render();
    items(tree).forEach((node) => {
      expect(inner(node).labels).toHaveLength(0);
      expect(node.props.accessibilityShowsLargeContentViewer).toBe(true);
      expect(node.props.accessibilityLargeContentTitle).toBe(node.props.accessibilityLabel);
    });
    expect(itemStyle(tree, 'Today').minHeight).toBe(64);
  });

  it('Android, icons only: a long press shows the label beside the item; release hides it', () => {
    Platform.OS = 'android';
    mockFontScale = 2;
    const tree = render();
    act(() => item(tree, 'Progress').props.onLongPress());
    const tip = host(tree, 'tablet-rail-tip');
    expect(tip.findByType(Text).props.children).toBe('Progress');
    expect(StyleSheet.flatten(tip.props.style).left).toBe(88 + 8);
    act(() => item(tree, 'Progress').props.onPressOut());
    expect(tree.root.findAll((node) => node.props.testID === 'tablet-rail-tip')).toHaveLength(0);
  });

  // QA BUG-N1 (s1 T8): at font scale 2.0 the Android tip read "Plan..". The
  // tip shows the FULL tab name: no line limit, no ellipsis, and a label that
  // never shrinks below its text width (the chip grows instead).
  it.each(['trainer', 'member'])('Android 2.0 (%s): every long-press tip shows the full tab name, never ellipsized', (mode) => {
    Platform.OS = 'android';
    mockFontScale = 2;
    const tree = render({ mode });
    items(tree).forEach((node) => {
      act(() => node.props.onLongPress());
      const text = host(tree, 'tablet-rail-tip').findByType(Text);
      expect(text.props.children).toBe(node.props.accessibilityLabel);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      expect(StyleSheet.flatten(text.props.style).flexShrink).toBe(0);
      act(() => node.props.onPressOut());
    });
  });

  it('no long-press label with labels shown, nor on iOS', () => {
    Platform.OS = 'android';
    expect(item(render(), 'Today').props.onLongPress).toBeUndefined();
    Platform.OS = 'ios';
    mockFontScale = 3.1;
    expect(item(render(), 'Today').props.onLongPress).toBeUndefined();
  });
});
