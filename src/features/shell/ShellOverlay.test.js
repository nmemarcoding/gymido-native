import { useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ShellOverlay from './ShellOverlay';

const mockUi = { panelOpen: false, isSessionActive: false };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('./BottomNav', () => {
  const { View } = require('react-native');
  return function MockBottomNav() {
    return <View testID="bottom-nav" />;
  };
});
jest.mock('../notifications/NotificationPanel', () => () => null);
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: null, workspace: null }) }));
jest.mock('./shellUiStore', () => ({ closePanel: jest.fn(), useShellUiStore: (select) => select(mockUi) }));

const state = { index: 0, routes: [{ name: 'Today', state: { index: 0, routes: [{ name: 'Home', params: {} }] } }] };

function hasTabBar(width) {
  useWindowDimensions.mockReturnValue({ width, height: 844, scale: 3, fontScale: 1 });
  let tree;
  act(() => {
    tree = create(<ShellOverlay state={state} />);
  });
  return tree.root.findAll((node) => node.props.testID === 'bottom-nav').length > 0;
}

afterEach(() => {
  Object.assign(mockUi, { panelOpen: false, isSessionActive: false });
});

describe('ShellOverlay tab bar visibility (v1 rules kept)', () => {
  it('shows the floating tab bar on phones (< 768)', () => {
    expect(hasTabBar(390)).toBe(true);
    expect(hasTabBar(767)).toBe(true);
  });

  it('hides it on tablets (≥ 768: the sidebar navigates)', () => {
    expect(hasTabBar(768)).toBe(false);
    expect(hasTabBar(1024)).toBe(false);
  });

  it('hides it during a running workout session', () => {
    mockUi.isSessionActive = true;
    expect(hasTabBar(390)).toBe(false);
  });
});
