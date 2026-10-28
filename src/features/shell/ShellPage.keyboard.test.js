import { Dimensions, Keyboard, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ShellPage from './ShellPage';

// UX native final audit 27 Oct 2026, batch k (PM, the batch g bug class): on
// an edge-to-edge Android window ShellPage grows its content by what the
// keyboard COVERS (useKeyboardOverlap), not the raw height, which leaves out
// the nav bar under the IME. The REAL hook with a mocked keyboard frame:
// Android phone, 48 nav bar, window 915 tall, IME top at 915 − 336 − 48 = 531
// (overlap 384) while RN reports height 336.

jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ name: 'EditProfile', params: {} }) }));
const mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('react-native-draggable-flatlist', () => ({ NestableScrollContainer: 'NestableScrollContainer' }));
jest.mock('./AppHeader', () => () => null);
jest.mock('./TabletRail', () => () => null);
jest.mock('./ModeSwitch', () => () => null);
jest.mock('../workspace/workspacePreference', () => ({ setWorkspace: jest.fn(() => Promise.resolve()) }));
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: null, workspace: null }) }));
jest.mock('./shellNavigation', () => ({ getScreenPath: () => '/profile/edit' }));
jest.mock('./shellRules', () => ({ resolveMode: () => 'member', showsMobileModeSwitch: () => false }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const WINDOW = { width: 412, height: 915, scale: 2.625, fontScale: 1 };
const FRAME = { height: 336, screenY: 915 - 336 - 48 };
// The phone's tab-bar clearance (bar 66 + 20 + 18, ShellPage) + the inset.
const TAB_CLEARANCE = 104 + mockInsets.bottom;

const realOS = Platform.OS;
let listeners;
beforeEach(() => {
  Platform.OS = 'android';
  useWindowDimensions.mockReturnValue(WINDOW);
  listeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, cb) => {
    listeners[name] = cb;
    return { remove: () => delete listeners[name] };
  });
  jest.spyOn(Dimensions, 'get').mockImplementation(() => WINDOW);
  jest.spyOn(Dimensions, 'addEventListener').mockImplementation(() => ({ remove: () => {} }));
});
afterEach(() => {
  Platform.OS = realOS;
  jest.restoreAllMocks();
});

function bottomPadding(tree) {
  const content = tree.root.findByType(ScrollView).props.children.props.children;
  return [].concat(content.props.style).reduce((sum, part) => sum + (part?.paddingBottom ?? 0), 0);
}

describe('ShellPage, Android keyboard (useKeyboardOverlap)', () => {
  it('keyboard up: the content grows by the 384 the keyboard covers (not the raw 336), so its end clears the keyboard top', () => {
    let tree;
    act(() => {
      tree = create(<ShellPage />);
    });
    expect(bottomPadding(tree)).toBe(TAB_CLEARANCE);
    act(() => listeners.keyboardDidShow({ endCoordinates: FRAME }));
    const keyboardPart = bottomPadding(tree) - TAB_CLEARANCE;
    expect(keyboardPart).toBe(WINDOW.height - FRAME.screenY);
    expect(WINDOW.height - keyboardPart).toBeLessThanOrEqual(FRAME.screenY);
    act(() => listeners.keyboardDidHide());
    expect(bottomPadding(tree)).toBe(TAB_CLEARANCE);
    act(() => tree.unmount());
  });
});
