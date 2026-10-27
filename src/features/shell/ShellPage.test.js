import { Platform, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ShellPage from './ShellPage';

jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ name: 'EditProfile', params: {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }) }));
jest.mock('react-native-draggable-flatlist', () => ({ NestableScrollContainer: 'NestableScrollContainer' }));
const mockHeaderMounts = [];
const mockHeaderProps = [];
jest.mock('./AppHeader', () => {
  const { useEffect } = require('react');
  return function MockAppHeader(props) {
    mockHeaderProps.push(props);
    useEffect(() => {
      mockHeaderMounts.push(1);
    }, []);
    return null;
  };
});
const mockRail = jest.fn(() => null);
jest.mock('./TabletRail', () => (props) => mockRail(props));
jest.mock('./ModeSwitch', () => () => null);
jest.mock('../workspace/workspacePreference', () => ({ setWorkspace: jest.fn(() => Promise.resolve()) }));
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: null, workspace: null }) }));
jest.mock('./shellNavigation', () => ({ getScreenPath: () => '/profile/edit' }));
jest.mock('./shellRules', () => ({ resolveMode: () => 'member', showsMobileModeSwitch: () => false }));
jest.mock('../../shared/hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => 300 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

beforeEach(() => {
  useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
});

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

function render(props) {
  let tree;
  act(() => {
    tree = create(<ShellPage {...props} />);
  });
  return tree;
}

describe('ShellPage keyboard handling (E1)', () => {
  it('lets iOS inset the ScrollView for the keyboard and adds no padding', () => {
    Platform.OS = 'ios';
    const tree = render();
    expect(tree.root.findByType(ScrollView).props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(bottomPadding(tree)).toBe(104 + 34);
  });

  it('pads the content by the keyboard height on Android', () => {
    Platform.OS = 'android';
    const tree = render();
    expect(bottomPadding(tree)).toBe(104 + 34 + 300);
  });
});

describe('ShellPage v2 ground, tab-bar clearance and glow', () => {
  const root = (tree) => tree.root.findAll((node) => node.props.testID === 'app-root' && typeof node.type === 'string')[0];

  it('paints the ground colour', () => {
    expect(StyleSheet.flatten(root(render()).props.style).backgroundColor).toBe('#0A0B0F');
  });

  it('phone content clears the floating tab bar: 104 + the safe area (bar 66 + 20 above it)', () => {
    Platform.OS = 'ios';
    expect(bottomPadding(render())).toBe(104 + 34);
    expect(104).toBeGreaterThan(66 + 20);
  });

  it('tablet keeps its 40 bottom padding (no tab bar)', () => {
    Platform.OS = 'ios';
    useWindowDimensions.mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });
    const tree = render();
    const column = tree.root.findByType(ScrollView).props.children;
    const content = column.props.children;
    const pad = [].concat(content.props.style).reduce((sum, part) => sum + (part?.paddingBottom ?? 0), 0);
    expect(pad).toBe(40 + 34);
  });

  it('T-56 tablet: ShellPage never draws the rail, it reserves its 88 (the overlay draws it)', () => {
    mockRail.mockClear();
    useWindowDimensions.mockReturnValue({ width: 834, height: 1194, scale: 2, fontScale: 1 });
    const tree = render();
    expect(mockRail).not.toHaveBeenCalled();
    const frame = tree.root.findAll((node) => node.props.testID === 'tablet-frame' && typeof node.type === 'string')[0];
    expect(StyleSheet.flatten(frame.props.style).paddingLeft).toBe(88);
  });

  it('T-56 phone: no rail and no reserved space', () => {
    mockRail.mockClear();
    const tree = render();
    expect(mockRail).not.toHaveBeenCalled();
    expect(tree.root.findAll((node) => node.props.testID === 'tablet-frame')).toHaveLength(0);
  });

  it('no ambient glow unless the screen asks for one', () => {
    expect(render().root.findAll((node) => node.props.testID === 'ambient-glow')).toHaveLength(0);
  });

  it('glow draws the ambient gold glow behind the scroller from the first render', () => {
    const tree = render({ glow: true });
    expect(tree.root.findAll((node) => node.props.testID === 'ambient-glow' && typeof node.type === 'string')).toHaveLength(1);
    expect(root(tree).props.children[0].props.glow).toBe(true);
  });
});

describe('live text-size change (QA F1)', () => {
  it('remounts the page content on a new text scale; same scale keeps it mounted', () => {
    const mounts = [];
    function Probe() {
      const { useEffect } = require('react');
      useEffect(() => {
        mounts.push(1);
      }, []);
      return null;
    }
    const tree = render({ children: <Probe /> });
    act(() => tree.update(<ShellPage><Probe /></ShellPage>));
    expect(mounts).toHaveLength(1);
    useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 2 });
    act(() => tree.update(<ShellPage><Probe /></ShellPage>));
    expect(mounts).toHaveLength(2);
  });


  it('remounts the header when the text scale changes, so a background tab measures it again', () => {
    mockHeaderMounts.length = 0;
    const tree = render();
    expect(mockHeaderMounts).toHaveLength(1);
    act(() => tree.update(<ShellPage />));
    expect(mockHeaderMounts).toHaveLength(1);
    useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1.35 });
    act(() => tree.update(<ShellPage />));
    expect(mockHeaderMounts).toHaveLength(2);
  });

  // T-58: the header and the content are siblings, so their remount keys
  // must differ, or React warns about a duplicate key (a dev-build red box).
  it('gives the header and the page content different keys (no duplicate-key warning)', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const tree = render({ children: null });
      useWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1.35 });
      act(() => tree.update(<ShellPage />));
      const messages = errors.mock.calls.map((call) => call.map(String).join(' '));
      expect(messages.filter((m) => /same key/i.test(m))).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });
});

describe('ShellPage header-actions slot (FE batch 1)', () => {
  it('passes the page headerActions to the shell header; none by default', () => {
    const actions = <></>;
    mockHeaderProps.length = 0;
    render({ headerActions: actions });
    expect(mockHeaderProps[mockHeaderProps.length - 1].headerActions).toBe(actions);
    mockHeaderProps.length = 0;
    render();
    expect(mockHeaderProps[mockHeaderProps.length - 1].headerActions).toBeUndefined();
  });
});
