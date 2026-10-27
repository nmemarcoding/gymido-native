import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import AppHeader from './AppHeader';

const mockUi = { isSessionActive: false };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../notifications/bellPolling', () => ({ mountBell: jest.fn() }));
jest.mock('../notifications/NotificationBell', () => {
  const { View } = require('react-native');
  return function MockBell() {
    return <View testID="notification-bell" />;
  };
});
jest.mock('./ModeSwitch', () => {
  const { View } = require('react-native');
  return function MockModeSwitch() {
    return <View testID="mode-switch" />;
  };
});
jest.mock('./shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./shellUiStore', () => ({ useShellUiStore: (select) => select(mockUi) }));

const { mountBell } = require('../notifications/bellPolling');
const { openShellPath } = require('./shellLinks');

function render(props, width = 390) {
  useWindowDimensions.mockReturnValue({ width, height: 844, scale: 3, fontScale: 1 });
  let tree;
  act(() => {
    tree = create(<AppHeader mode="member" {...props} />);
  });
  return tree;
}

const title = (tree) => tree.root.findAllByType(Text).find((node) => node.props.accessibilityRole === 'header');
const titleStyle = (tree) => StyleSheet.flatten(title(tree).props.style);
const byTestId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const backLink = (tree) => tree.root.findAll((node) => node.props.testID === 'header-back-link' && typeof node.props.children === 'function')[0];

afterEach(() => {
  mockUi.isSessionActive = false;
  jest.clearAllMocks();
});

describe('AppHeader v2 look (§7.4)', () => {
  it('phone: the tab title in title-xl (36/40 Geist Bold, primary text), no fontWeight', () => {
    const tree = render({ path: '/plans' });
    expect(title(tree).props.children).toBe('Plans');
    expect(titleStyle(tree)).toMatchObject({ fontSize: 36, lineHeight: 40, fontFamily: 'Geist-Bold', color: '#F5F6F8' });
    expect(titleStyle(tree).fontWeight).toBeUndefined();
  });

  it('large text (UX §9): the title scales at most 1.3×, wraps by word to 3 lines and shrinks (≥ 0.7×) rather than breaking a word', () => {
    expect(title(render({ path: '/plans' })).props).toMatchObject({
      maxFontSizeMultiplier: 1.3,
      numberOfLines: 3,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.7,
      textBreakStrategy: 'simple',
    });
  });

  it('tablet: the title in display-lg (52/52, UX)', () => {
    expect(titleStyle(render({ path: '/plans' }, 1024))).toMatchObject({ fontSize: 52, lineHeight: 52, fontFamily: 'Geist-Bold' });
  });

  it('"/" is untitled: Today\'s greeting is the page heading (web parity)', () => {
    const tree = render({ path: '/' });
    expect(tree.root.findAll((node) => node.props.accessibilityRole === 'header')).toHaveLength(0);
  });

  it('back link: 14/600 gold, min-height 32 with a 44 hit area, goes to the tab root', () => {
    const tree = render({ path: '/my-trainer' });
    const link = backLink(tree);
    expect(StyleSheet.flatten(link.props.style)).toMatchObject({ minHeight: 32 });
    expect(32 + link.props.hitSlop.top + link.props.hitSlop.bottom).toBe(44);
    let inner;
    act(() => {
      inner = create(link.props.children({ pressed: false }));
    });
    expect(inner.root.findByType(Text).props.children).toBe('← Profile');
    expect(StyleSheet.flatten(inner.root.findByType(Text).props.style)).toMatchObject({
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
      color: '#FFC21A',
    });
    act(() => link.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/profile');
  });

  it('pressed back link: pressed gold + underline', () => {
    const link = backLink(render({ path: '/my-trainer' }));
    let inner;
    act(() => {
      inner = create(link.props.children({ pressed: true }));
    });
    expect(StyleSheet.flatten(inner.root.findByType(Text).props.style)).toMatchObject({
      color: '#F4A300',
      textDecorationLine: 'underline',
    });
  });

  it('no back link on a tab root', () => {
    expect(backLink(render({ path: '/' }))).toBeUndefined();
  });

  it('the bell sits at the right on phones; the mode switch only on tablets (v1 place)', () => {
    const phone = render({ path: '/' });
    expect(byTestId(phone, 'notification-bell')).toHaveLength(1);
    expect(byTestId(phone, 'mode-switch')).toHaveLength(0);
    const tablet = render({ path: '/' }, 1024);
    expect(byTestId(tablet, 'mode-switch')).toHaveLength(1);
    expect(byTestId(tablet, 'notification-bell')).toHaveLength(1);
  });

  it('running session on the workout route: no title and no back link (v1 rule)', () => {
    mockUi.isSessionActive = true;
    const tree = render({ path: '/workout' });
    expect(title(tree)).toBeUndefined();
    expect(backLink(tree)).toBeUndefined();
  });

  it('compact header: the phone Exercises root keeps its title-xl H1; other compact routes are untitled', () => {
    expect(titleStyle(render({ path: '/exercises' }))).toMatchObject({ fontSize: 36 });
    expect(title(render({ path: '/exercises' }, 1024))).toBeUndefined();
    expect(title(render({ path: '/plans/12' }))).toBeUndefined();
  });

  it('tells the bell controller which variant is showing (behaviour unchanged)', () => {
    render({ path: '/' });
    expect(mountBell).toHaveBeenLastCalledWith('full');
    render({ path: '/exercises' });
    expect(mountBell).toHaveBeenLastCalledWith('compact');
  });
});
