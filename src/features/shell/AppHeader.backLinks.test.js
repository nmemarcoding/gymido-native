import { Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import AppHeader from './AppHeader';

// UX native final audit 27 Oct 2026, batch k: rows A153 (Edit profile) and
// A157 (Notifications), the shell header's back control + one title.

const mockUi = { isSessionActive: false };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
const mockNavigation = { canGoBack: jest.fn(() => true), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useNavigation: () => mockNavigation }));
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
const byTestId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const backLink = (tree) => tree.root.findAll((node) => node.props.testID === 'header-back-link' && typeof node.props.children === 'function')[0];

afterEach(() => {
  mockUi.isSessionActive = false;
  jest.clearAllMocks();
});

describe('AppHeader back links (A153, A157)', () => {
  // UX native final audit 27 Oct 2026, row A157 (MUST): Notifications (a
  // hidden screen opened from the bell anywhere) has a back control above its
  // title; it goes back to where it was opened, else to Today.
  it('A157: Notifications draws the back pill "‹ Back" above the title; it goes back (Today when there is no history)', () => {
    const tree = render({ path: '/notifications' });
    expect(byTestId(tree, 'header-back-link')).toHaveLength(1);
    expect(title(tree).props.children).toBe('Notifications');
    const link = backLink(tree);
    expect(link.props.accessibilityLabel).toBe('Back');
    act(() => link.props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(openShellPath).not.toHaveBeenCalled();
    mockNavigation.canGoBack.mockReturnValueOnce(false);
    act(() => link.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/');
  });

  // Row A153 (MUST): Edit profile = the back control + ONE title, its own
  // "Edit profile" (the shell drops "Profile"; it shows "Edit profile" only
  // while the page's own heading is not on screen).
  it('A153: Edit profile draws "‹ Profile" (→ /profile) and no "Profile" title', () => {
    const shown = render({ path: '/profile/edit', heroTitleShown: true });
    expect(shown.root.findAll((node) => node.props.accessibilityRole === 'header')).toHaveLength(0);
    act(() => backLink(shown).props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/profile');
    expect(backLink(shown).props.accessibilityLabel).toBe('Profile');
    const loading = render({ path: '/profile/edit', heroTitleShown: false });
    expect(title(loading).props.children).toBe('Edit profile');
  });

});
