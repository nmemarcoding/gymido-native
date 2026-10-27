import { StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { act, create } from 'react-test-renderer';

import NotificationBell from './NotificationBell';

const mockState = { unreadCount: 0, panelOpen: false };
const mockSetPanelOpen = jest.fn();
const mockSetBellFrame = jest.fn();
jest.mock('./notificationStore', () => ({ useNotificationStore: (select) => select(mockState) }));
jest.mock('../shell/shellUiStore', () => {
  const useShellUiStore = (select) => select(mockState);
  useShellUiStore.getState = () => ({ setPanelOpen: mockSetPanelOpen, setBellFrame: mockSetBellFrame });
  return { useShellUiStore };
});

function render() {
  let tree;
  act(() => {
    tree = create(<NotificationBell />);
  });
  return tree;
}

const button = (tree) => tree.root.findAll((node) => node.props.testID === 'notification-bell' && typeof node.props.style === 'function')[0];
const buttonStyle = (tree, pressed) => StyleSheet.flatten(button(tree).props.style({ pressed }));
const badge = (tree) => tree.root.findAll((node) => node.props.testID === 'notification-badge' && typeof node.type === 'string');

afterEach(() => {
  Object.assign(mockState, { unreadCount: 0, panelOpen: false });
  jest.clearAllMocks();
});

describe('NotificationBell v2 look (§7.6, §4.2 icon button)', () => {
  it('is a 44 round glass icon button: white 0.07 fill, 0.10 hairline', () => {
    expect(buttonStyle(render(), false)).toMatchObject({
      width: 44,
      height: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.10)',
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
    });
  });

  it('pressed: a brighter fill and edge', () => {
    expect(buttonStyle(render(), true)).toMatchObject({
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
    });
  });

  it('draws the 20 px bell in the primary text colour with explicit Svg size', () => {
    const tree = render();
    expect(tree.root.findByType(Svg).props).toMatchObject({ width: 20, height: 20 });
    const paths = tree.root.findAllByType(Path);
    expect(paths).toHaveLength(2);
    paths.forEach((path) => expect(path.props).toMatchObject({ stroke: '#F5F6F8', strokeWidth: 1.8 }));
  });

  it('no badge with nothing unread', () => {
    expect(badge(render())).toHaveLength(0);
  });

  it('count badge: danger fill, white 11/700 tabular count, 2 px ground ring, 18 inside the ring', () => {
    mockState.unreadCount = 3;
    const tree = render();
    expect(badge(tree)).toHaveLength(1);
    const style = StyleSheet.flatten(badge(tree)[0].props.style);
    expect(style).toMatchObject({ backgroundColor: '#D93036', borderWidth: 2, borderColor: '#0A0B0F', height: 22, minWidth: 22 });
    expect(style.height - 2 * style.borderWidth).toBe(18);
    const text = tree.root.findByType(Text);
    expect(text.props.children).toBe(3);
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({
      fontSize: 11,
      fontFamily: 'Geist-Bold',
      color: '#FFFFFF',
      fontVariant: ['tabular-nums'],
    });
    expect(StyleSheet.flatten(text.props.style).fontWeight).toBeUndefined();
  });

  it('caps the count at "99+"', () => {
    mockState.unreadCount = 120;
    expect(render().root.findByType(Text).props.children).toBe('99+');
  });

  it('keeps its label and toggles the panel (behaviour unchanged)', () => {
    const tree = render();
    expect(button(tree).props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Notifications', accessibilityState: { expanded: false } });
    act(() => button(tree).props.onPress());
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
  });

  it('reports expanded while the panel is open, and a press closes it', () => {
    mockState.panelOpen = true;
    const tree = render();
    expect(button(tree).props.accessibilityState).toEqual({ expanded: true });
    act(() => button(tree).props.onPress());
    expect(mockSetPanelOpen).toHaveBeenCalledWith(false);
  });
});
