import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ShellPage from './ShellPage';

// T-140 (web review lesson 3): a page drawn in a centred column passes its
// width, and the header row (Back · bell) sits in the same centred column;
// headerLeading reaches the header.

jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ name: 'Workout', params: {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-draggable-flatlist', () => ({ NestableScrollContainer: 'NestableScrollContainer' }));
const mockHeaderProps = [];
jest.mock('./AppHeader', () => (props) => {
  mockHeaderProps.push(props);
  return null;
});
jest.mock('./TabletRail', () => () => null);
jest.mock('./ModeSwitch', () => () => null);
jest.mock('../workspace/workspacePreference', () => ({ setWorkspace: jest.fn(() => Promise.resolve()) }));
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: null, workspace: null }) }));
jest.mock('./shellNavigation', () => ({ getScreenPath: () => '/workout' }));
jest.mock('./shellRules', () => ({ ...jest.requireActual('./shellRules'), resolveMode: () => 'member', showsMobileModeSwitch: () => false }));
jest.mock('../../shared/hooks/useKeyboardHeight', () => ({ useKeyboardOverlap: () => 0 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

function render(props) {
  useWindowDimensions.mockReturnValue({ width: 834, height: 1194, scale: 2, fontScale: 1 });
  let tree;
  act(() => {
    tree = create(<ShellPage {...props} />);
  });
  return tree;
}
const column = (tree) => tree.root.findAll((node) => node.props.testID === 'shell-header-column' && typeof node.type === 'string')[0];

describe('ShellPage header column (T-140)', () => {
  it('contentMaxWidth centres the header row in a column of that width', () => {
    const tree = render({ contentMaxWidth: 600, children: <View /> });
    expect(StyleSheet.flatten(column(tree).props.style)).toMatchObject({ width: '100%', maxWidth: 600, alignSelf: 'center' });
    act(() => tree.unmount());
  });

  it('without it the header spans the content as before; headerLeading reaches AppHeader', () => {
    const leading = <View testID="lead" />;
    const tree = render({ headerLeading: leading, children: <View /> });
    expect(StyleSheet.flatten(column(tree).props.style) ?? {}).not.toHaveProperty('maxWidth');
    expect(mockHeaderProps.at(-1).headerLeading).toBe(leading);
    act(() => tree.unmount());
  });
});
