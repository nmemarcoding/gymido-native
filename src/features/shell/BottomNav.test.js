import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import BottomNav from './BottomNav';
import GymIcon from './GymIcon';
import { TAB_BAR, TAB_BAR_CLEARANCE, TAB_BAR_CONTENT_PADDING } from './tabBarMetrics';

const mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('./shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./shellUiStore', () => ({ closePanel: jest.fn() }));

const { openShellPath } = require('./shellLinks');
const { closePanel } = require('./shellUiStore');

const GOLD = '#FFC21A';
const MUTED = '#9BA1AD';
const PRIMARY = '#F5F6F8';

function render(props) {
  let tree;
  act(() => {
    tree = create(<BottomNav mode="member" path="/" {...props} />);
  });
  return tree;
}

const hostByTestId = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const flat = (node) => StyleSheet.flatten(node.props.style);
const isTab = (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('tab-') && typeof node.props.style === 'function';
const tab = (tree, key) => tree.root.findAll((node) => isTab(node) && node.props.testID === `tab-${key}`)[0];
const pressStyle = (tree, key, pressed) => StyleSheet.flatten(tab(tree, key).props.style({ pressed }));

function tabContent(tree, key, pressed = false) {
  // Render the item's children for a given pressed state.
  const children = tab(tree, key).props.children({ pressed });
  let inner;
  act(() => {
    inner = create(<>{children}</>);
  });
  return { icon: inner.root.findByType(GymIcon), label: inner.root.findByType(Text) };
}

afterEach(() => {
  Object.assign(mockInsets, { top: 47, bottom: 34, left: 0, right: 0 });
  jest.clearAllMocks();
});

describe('BottomNav floating glass tab bar (v2 §7.1)', () => {
  it('floats 16 from the sides and 20 above the bottom safe area', () => {
    const wrap = flat(hostByTestId(render(), 'bottom-nav'));
    expect(wrap).toMatchObject({ position: 'absolute', left: 16, right: 16, bottom: 20 + 34 });
  });

  it('adds the side safe-area insets (landscape) and works with no home indicator', () => {
    Object.assign(mockInsets, { bottom: 0, left: 44, right: 44 });
    const wrap = flat(hostByTestId(render(), 'bottom-nav'));
    expect(wrap).toMatchObject({ left: 60, right: 60, bottom: 20 });
  });

  it('is a 66 tall glass pill: radius 33, padding 6, blur, glass fill, hairline and float shadow', () => {
    const tree = render();
    const bar = flat(hostByTestId(tree, 'bottom-nav-bar'));
    expect(bar).toMatchObject({
      height: 66,
      padding: 6,
      borderRadius: 33,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.10)',
      boxShadow: '0px 16px 40px rgba(0, 0, 0, 0.5)',
      maxWidth: 398,
    });
    expect(tree.root.findAllByType(BlurView)).toHaveLength(1);
    expect(flat(hostByTestId(tree, 'bottom-nav-bar-fill')).backgroundColor).toBe('rgba(30, 33, 41, 0.72)');
  });

  it('draws the solid glass with no blur before Android 12 (low-end fallback)', () => {
    const { OS, Version } = Platform;
    Platform.OS = 'android';
    Object.defineProperty(Platform, 'Version', { value: 29, configurable: true });
    try {
      const tree = render();
      expect(tree.root.findAllByType(BlurView)).toHaveLength(0);
      expect(flat(hostByTestId(tree, 'bottom-nav-bar-fill')).backgroundColor).toBe('rgba(30, 33, 41, 0.96)');
    } finally {
      Platform.OS = OS;
      Object.defineProperty(Platform, 'Version', { value: Version, configurable: true });
    }
  });

  it('shows five member tabs and four trainer tabs', () => {
    const keys = (tree) => [...new Set(tree.root.findAll(isTab).map((n) => n.props.testID))];
    expect(keys(render())).toEqual(['tab-Today', 'tab-Plans', 'tab-Exercises', 'tab-Progress', 'tab-Profile']);
    expect(keys(render({ mode: 'trainer', path: '/trainer' }))).toEqual(['tab-TToday', 'tab-TClients', 'tab-TPlans', 'tab-TProfile']);
  });

  it('active tab: gold 16% tint pill, gold 22 px icon, 11/600 gold label, selected state', () => {
    const tree = render({ path: '/plans' });
    expect(tab(tree, 'Plans').props.accessibilityState).toEqual({ selected: true });
    expect(pressStyle(tree, 'Plans', false)).toMatchObject({ borderRadius: 27, backgroundColor: 'rgba(255, 194, 26, 0.16)' });
    const { icon, label } = tabContent(tree, 'Plans');
    expect(icon.props).toMatchObject({ size: 22, color: GOLD });
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({ fontSize: 11, lineHeight: 14, fontFamily: 'Geist-SemiBold', color: GOLD });
    expect(StyleSheet.flatten(label.props.style).fontWeight).toBeUndefined();
  });

  it('inactive tab: no fill, muted 22 px icon and 11/500 label', () => {
    const tree = render({ path: '/plans' });
    expect(tab(tree, 'Today').props.accessibilityState).toEqual({ selected: false });
    expect(pressStyle(tree, 'Today', false).backgroundColor).toBeUndefined();
    const { icon, label } = tabContent(tree, 'Today');
    expect(icon.props).toMatchObject({ size: 22, color: MUTED });
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({ fontSize: 11, fontFamily: 'Geist-Medium', color: MUTED });
  });

  it('pressed inactive tab: chip fill and primary ink; a pressed active tab keeps the gold tint', () => {
    const tree = render({ path: '/plans' });
    expect(pressStyle(tree, 'Today', true).backgroundColor).toBe('rgba(255, 255, 255, 0.05)');
    expect(tabContent(tree, 'Today', true).icon.props.color).toBe(PRIMARY);
    expect(pressStyle(tree, 'Plans', true).backgroundColor).toBe('rgba(255, 194, 26, 0.16)');
    expect(tabContent(tree, 'Plans', true).icon.props.color).toBe(GOLD);
  });

  it('Today stays active on /workout (extra prefix), as in v1', () => {
    expect(tab(render({ path: '/workout' }), 'Today').props.accessibilityState).toEqual({ selected: true });
  });

  it('a tab press closes the panel and opens the tab root (behaviour unchanged)', () => {
    const tree = render();
    act(() => tab(tree, 'Exercises').props.onPress());
    expect(closePanel).toHaveBeenCalledTimes(1);
    expect(openShellPath).toHaveBeenCalledWith('/exercises');
  });

  it('keeps tab items above the 44 touch minimum (66 - 2 border - 12 padding)', () => {
    expect(TAB_BAR.height - 2 - 2 * TAB_BAR.padding).toBeGreaterThanOrEqual(44);
  });
});

describe('tab bar clearance exports', () => {
  it('footers sit 66 + 20 = 86 above the safe area; content keeps 104', () => {
    expect(TAB_BAR_CLEARANCE).toBe(86);
    expect(TAB_BAR_CONTENT_PADDING).toBe(104);
    expect(TAB_BAR_CONTENT_PADDING).toBeGreaterThan(TAB_BAR_CLEARANCE);
  });
});
