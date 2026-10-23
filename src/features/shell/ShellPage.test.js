import { Platform, ScrollView } from 'react-native';
import { act, create } from 'react-test-renderer';

import ShellPage from './ShellPage';

jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ name: 'EditProfile', params: {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }) }));
jest.mock('react-native-draggable-flatlist', () => ({ NestableScrollContainer: 'NestableScrollContainer' }));
jest.mock('./AppHeader', () => () => null);
jest.mock('./DesktopSidebar', () => () => null);
jest.mock('./ModeSwitch', () => () => null);
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: null, workspace: null }) }));
jest.mock('./shellNavigation', () => ({ getScreenPath: () => '/profile/edit' }));
jest.mock('./shellRules', () => ({ resolveMode: () => 'member', showsMobileModeSwitch: () => false }));
jest.mock('../../shared/hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => 300 }));

const realOS = Platform.OS;
afterEach(() => {
  Platform.OS = realOS;
});

function bottomPadding(tree) {
  const scroller = tree.root.findByType(ScrollView);
  const column = scroller.props.children;
  const content = column.props.children;
  return [].concat(content.props.style).reduce((sum, part) => sum + (part?.paddingBottom ?? 0), 0);
}

function render() {
  let tree;
  act(() => {
    tree = create(<ShellPage />);
  });
  return tree;
}

describe('ShellPage keyboard handling (E1)', () => {
  it('lets iOS inset the ScrollView for the keyboard and adds no padding', () => {
    Platform.OS = 'ios';
    const tree = render();
    expect(tree.root.findByType(ScrollView).props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(bottomPadding(tree)).toBe(112 + 34);
  });

  it('pads the content by the keyboard height on Android', () => {
    Platform.OS = 'android';
    const tree = render();
    expect(bottomPadding(tree)).toBe(112 + 34 + 300);
  });
});
