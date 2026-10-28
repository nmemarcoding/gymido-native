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
    // DECLARED (T-65, PHONE-NAV spec §3 / §5): was openShellPath('/profile') on the tap. The pill goes back in history
    // first (the mock has a previous entry); with none it opens /profile.
    act(() => backLink(shown).props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    mockNavigation.canGoBack.mockReturnValueOnce(false);
    act(() => backLink(shown).props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/profile');
    expect(backLink(shown).props.accessibilityLabel).toBe('Profile');
    const loading = render({ path: '/profile/edit', heroTitleShown: false });
    expect(title(loading).props.children).toBe('Edit profile');
  });

});

// T-65 "phone bottom nav on main pages only" (PHONE-NAV spec §3 / §5, 27 Oct
// 2026): the shell header's back pill on these inner pages is the page's one
// back control: back in history, else the parent (opened by path = a tab root).
describe('T-65 header back pills (spec §3)', () => {
  function tree(path, mode, width = 390) {
    useWindowDimensions.mockReturnValue({ width, height: 844, scale: 3, fontScale: 1 });
    let rendered;
    act(() => {
      rendered = create(<AppHeader mode={mode} path={path} />);
    });
    return rendered;
  }

  it.each([
    ['/notifications', 'member', 'Back', '/'],
    ['/notifications', 'trainer', 'Back', '/trainer'],
    ['/profile/edit', 'member', 'Profile', '/profile'],
    ['/my-trainer', 'member', 'Profile', '/profile'],
    ['/trainers', 'member', 'Coaching', '/my-trainer'],
  ])('%s (%s): one pill "‹ %s"; with history it goes back, with none it opens %s', (path, mode, label, target) => {
    const rendered = tree(path, mode);
    expect(byTestId(rendered, 'header-back-link')).toHaveLength(1);
    const link = backLink(rendered);
    expect(link.props.accessibilityLabel).toBe(label);
    act(() => link.props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(openShellPath).not.toHaveBeenCalled();
    mockNavigation.canGoBack.mockReturnValueOnce(false);
    act(() => link.props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(openShellPath).toHaveBeenCalledWith(target);
  });

  it('main pages draw no back pill', () => {
    ['/', '/plans', '/progress', '/profile'].forEach((path) => expect(backLink(tree(path, 'member'))).toBeUndefined());
  });
});

// T-65 parity (PM, 27 Oct 2026; web keeps a plain link at ≥ 768): on a tablet
// Notifications' back is the plain gold text link "← Back"; the glass pill
// is phone-only there. Other tablet pages keep the pill (ruling 6).
describe('Notifications back on tablet = a plain text link (T-65 parity)', () => {
  const BackPill = require('../../shared/components/BackPill').default;
  const pills = (tree) => tree.root.findAll((node) => node.type === BackPill);

  it('834: no pill; a gold 14/600 text link "← Back" named "Back", same back behaviour', () => {
    const tree = render({ path: '/notifications' }, 834);
    expect(pills(tree)).toHaveLength(0);
    const link = byTestId(tree, 'header-back-link')[0];
    expect(link.props.accessibilityRole).toBe('link');
    expect(link.props.accessibilityLabel).toBe('Back');
    const texts = link.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toEqual(['←', 'Back']);
    const label = link.findAllByType(Text)[1];
    const style = Object.assign({}, ...[].concat(label.props.style).filter(Boolean));
    expect(style).toMatchObject({ color: require('../../shared/theme/tokens').colors.gold, fontSize: 14 });
    mockNavigation.canGoBack.mockReturnValueOnce(false);
    act(() => backLink(tree).props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/');
  });

  it('390: the pill', () => {
    expect(pills(render({ path: '/notifications' }, 390))).toHaveLength(1);
  });

  it('834, another inner page (My trainer): still the pill', () => {
    expect(pills(render({ path: '/my-trainer' }, 834))).toHaveLength(1);
  });
});
