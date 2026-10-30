import { View, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import AppHeader from './AppHeader';

// T-140 (UX C1, ruling §2.1): a page's leading control (the Workout page's
// Back pill) sits on the bell's row: ONE row, leading left · bell right.

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }) }));
jest.mock('../notifications/bellPolling', () => ({ mountBell: jest.fn() }));
jest.mock('../notifications/NotificationBell', () => {
  const { View: MockView } = require('react-native');
  return function MockBell() {
    return <MockView testID="notification-bell" />;
  };
});
jest.mock('./ModeSwitch', () => () => null);
jest.mock('./shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./shellUiStore', () => ({ useShellUiStore: (select) => select({ isSessionActive: false }) }));

function render(props) {
  useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  let tree;
  act(() => {
    tree = create(<AppHeader mode="member" path="/workout" {...props} />);
  });
  return tree;
}
const byTestId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];

describe('AppHeader headerLeading (T-140)', () => {
  it('/workout: the leading control and the bell share ONE row (leading first)', () => {
    const tree = render({ headerLeading: <View testID="page-back" /> });
    const back = byTestId(tree, 'page-back');
    const bell = byTestId(tree, 'notification-bell');
    const row = (node) => {
      let parent = node.parent;
      while (parent && !(typeof parent.type === 'string' && (parent.props.style ? [].concat(parent.props.style) : []).some((style) => style?.flexDirection === 'row' && style?.justifyContent === 'space-between'))) {
        parent = parent.parent;
      }
      return parent;
    };
    expect(row(back)).toBe(row(bell));
    act(() => tree.unmount());
  });

  it('without one, the row is unchanged (an empty spacer, then the bell)', () => {
    const tree = render({});
    expect(byTestId(tree, 'page-back')).toBeUndefined();
    expect(byTestId(tree, 'notification-bell')).toBeDefined();
    act(() => tree.unmount());
  });
});
