import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import IconButton from '../../shared/components/IconButton';
import { colors, font } from '../../shared/theme/tokens';
import { useShellUiStore } from '../shell/shellUiStore';
import NotificationBell from './NotificationBell';
import { useNotificationStore } from './notificationStore';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  const Path = (props) => {
    const { View } = require('react-native');
    return <View testID="bell-path" stroke={props.stroke} />;
  };
  return { __esModule: true, default: Mock, Path };
});

// v2 §7.6: the bell is a 44 icon button (§4.2); behaviour unchanged (§7.3).

function render() {
  let tree;
  act(() => {
    tree = create(<NotificationBell />);
  });
  return tree;
}

const pressableOf = (tree) => tree.root.findAll((node) => typeof node.type !== 'string' && node.props.accessibilityRole && typeof node.props.style !== 'undefined' && node.props.onPress !== undefined)[0];
const texts = (tree) => tree.root.findAllByType(Text).map((node) => node.props.children);

beforeEach(() => {
  act(() => {
    useNotificationStore.setState({ unreadCount: 0 });
    useShellUiStore.setState({ panelOpen: false, bellFrame: null });
  });
});

describe('NotificationBell', () => {
  it('is the 44 glass IconButton with the same testID, label and state', () => {
    const tree = render();
    expect(tree.root.findAllByType(IconButton)).toHaveLength(1);
    const pressable = pressableOf(tree);
    expect(pressable.props.testID).toBe('notification-bell');
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe('Notifications');
    expect(pressable.props.accessibilityState).toEqual({ expanded: false });
    expect(StyleSheet.flatten(pressable.props.style({ pressed: false }))).toMatchObject({ width: 44, height: 44, backgroundColor: colors.hairline });
  });

  it('the bell icon takes the text-primary ink', () => {
    const tree = render();
    expect(tree.root.find((node) => node.props.testID === 'bell-path' && typeof node.type === 'string').props.stroke).toBe(colors.textPrimary);
  });

  it('a tap toggles the panel and measures the bell frame', () => {
    const tree = render();
    act(() => pressableOf(tree).props.onPress());
    expect(useShellUiStore.getState().panelOpen).toBe(true);
    expect(pressableOf(tree).props.accessibilityState).toEqual({ expanded: true });
    act(() => pressableOf(tree).props.onPress());
    expect(useShellUiStore.getState().panelOpen).toBe(false);
  });

  it('no badge with zero unread', () => {
    expect(texts(render())).toEqual([]);
  });

  it('count badge: the number on a danger pill with a 2 px surface ring, white 11/700 tabular', () => {
    act(() => useNotificationStore.setState({ unreadCount: 3 }));
    const tree = render();
    const text = tree.root.findByType(Text);
    expect(text.props.children).toBe(3);
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ ...font(700), fontSize: 11, color: colors.onDanger, fontVariant: ['tabular-nums'] });
    expect(StyleSheet.flatten(text.props.style).fontWeight).toBeUndefined();
    const badge = StyleSheet.flatten(text.parent.props.style);
    expect(badge).toMatchObject({ backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.surface, paddingHorizontal: 5 });
    expect(badge.minWidth - 2 * badge.borderWidth).toBe(18);
    expect(badge.height - 2 * badge.borderWidth).toBe(18);
  });

  it('caps the count at 99+', () => {
    act(() => useNotificationStore.setState({ unreadCount: 120 }));
    expect(texts(render())).toEqual(['99+']);
  });
});
