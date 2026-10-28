import { BlurView } from 'expo-blur';
import { Platform, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ShellPage from './ShellPage';
import StatusBarBackdrop from './StatusBarBackdrop';

jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ name: 'EditProfile', params: {} }) }));
const mockInsets = { top: 0, bottom: 34, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
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
// DECLARED (batch k, 27 Oct 2026): the mock was useKeyboardHeight: () => 300; ShellPage reads useKeyboardOverlap now.
jest.mock('../../shared/hooks/useKeyboardHeight', () => ({ useKeyboardOverlap: () => 300 }));
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

// UX native final audit 27 Oct 2026, ruling 2 (rows A101, A105, C318): every
// scrolled screen gets a status-bar backdrop, one fixed layer the height of
// the top inset over the scroll. Ruling 2 amendments (2) + (3), 27 Oct 2026:
// where blur exists (iOS, Android 31+) the fill is TRANSLUCENT, the 0.86
// ground over a blur 20; low-end Android keeps the 0.96 ground, no blur.
describe('status-bar backdrop (UX native final audit 27 Oct 2026, ruling 2)', () => {
  const backdrop = (tree) => tree.root.findAll((node) => node.props.testID === 'status-bar-backdrop' && typeof node.type === 'string');
  // The fill is its own layer drawn OVER the blur (GlassSurface's order).
  const fillOf = (node) => StyleSheet.flatten(node.findAll((child) => child.props.testID === 'status-bar-backdrop-fill' && typeof child.type === 'string')[0].props.style);
  const pageRoot = (tree) => tree.root.findAll((node) => node.props.testID === 'app-root' && typeof node.type === 'string')[0];
  const { Version } = Platform;
  const setVersion = (value) => Object.defineProperty(Platform, 'Version', { value, configurable: true });

  beforeEach(() => {
    mockInsets.top = 47;
  });
  afterEach(() => {
    mockInsets.top = 0;
    setVersion(Version);
  });

  it('phone: one backdrop, exactly the top inset tall', () => {
    Platform.OS = 'ios';
    const found = backdrop(render());
    expect(found).toHaveLength(1);
    expect(StyleSheet.flatten(found[0].props.style).height).toBe(47);
  });

  it('is fixed at the top edge across the full width, outside the scroll', () => {
    Platform.OS = 'ios';
    const tree = render();
    const style = StyleSheet.flatten(backdrop(tree)[0].props.style);
    expect(style).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0 });
    expect(tree.root.findByType(ScrollView).findAll((node) => node.props.testID === 'status-bar-backdrop')).toHaveLength(0);
  });

  it('never takes a touch and is hidden from screen readers', () => {
    Platform.OS = 'ios';
    const node = backdrop(render())[0];
    expect(node.props.pointerEvents).toBe('none');
    expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(node.props.accessibilityElementsHidden).toBe(true);
  });

  it('sits above the scroll: drawn after the scroller in the same parent', () => {
    Platform.OS = 'ios';
    const tree = render();
    const children = pageRoot(tree).props.children.filter(Boolean);
    const scrollAt = children.findIndex((child) => child.type === ScrollView);
    const backdropAt = children.findIndex((child) => child.type === StatusBarBackdrop);
    expect(scrollAt).toBeGreaterThan(-1);
    expect(backdropAt).toBeGreaterThan(scrollAt);
  });

  it('stays below the overlays: no zIndex or elevation (the tab bar, toasts and Modal windows draw over it)', () => {
    Platform.OS = 'android';
    setVersion(34);
    const style = StyleSheet.flatten(backdrop(render())[0].props.style);
    expect(style.zIndex).toBeUndefined();
    expect(style.elevation).toBeUndefined();
  });

  // DECLARED (final batch, 27 Oct 2026, ruling 2 amendment 2): was "solid
  // ground #0A0B0F over the blur" on the band itself; now the band is clear
  // and its fill layer, over the blur 20, is the translucent 0.86 ground.
  it.each([
    ['iOS', 'ios', undefined],
    ['Android 12+ (API 31)', 'android', 31],
  ])('%s: the translucent 0.86 ground over a blur 20 (ruling 2 amendment 2)', (_name, os, version) => {
    Platform.OS = os;
    if (version) {
      setVersion(version);
    }
    const node = backdrop(render())[0];
    expect(StyleSheet.flatten(node.props.style).backgroundColor).toBeUndefined();
    expect(fillOf(node).backgroundColor).toBe('rgba(10, 11, 15, 0.86)');
    const blurs = node.findAllByType(BlurView);
    expect(blurs).toHaveLength(1);
    // BlurLayer maps CSS px to intensity × 2.5: blur 20 → 50.
    expect(blurs[0].props.intensity).toBe(50);
  });

  // DECLARED (final batch, 27 Oct 2026): the 0.96 now sits on the fill layer
  // (it was the band's own background); value and no-blur unchanged.
  it('low-end Android (below API 31): the 0.96 ground fallback and no blur (ruling 2 amendment 3)', () => {
    Platform.OS = 'android';
    setVersion(29);
    const node = backdrop(render())[0];
    expect(fillOf(node).backgroundColor).toBe('rgba(10, 11, 15, 0.96)');
    expect(node.findAllByType(BlurView)).toHaveLength(0);
  });

  it('tablet: the backdrop spans the content column only, never the rail column', () => {
    Platform.OS = 'ios';
    useWindowDimensions.mockReturnValue({ width: 834, height: 1194, scale: 2, fontScale: 1 });
    const tree = render();
    const column = tree.root.findAll((node) => node.props.testID === 'tablet-frame-column' && typeof node.type === 'string')[0];
    const inColumn = column.findAll((node) => node.props.testID === 'status-bar-backdrop' && typeof node.type === 'string');
    expect(inColumn).toHaveLength(1);
    expect(backdrop(tree)).toHaveLength(1);
    expect(StyleSheet.flatten(inColumn[0].props.style)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, height: 47 });
    // The column starts after the 88 reserved for the rail, so left: 0 is the column's edge.
    const frame = tree.root.findAll((node) => node.props.testID === 'tablet-frame' && typeof node.type === 'string')[0];
    expect(StyleSheet.flatten(frame.props.style).paddingLeft).toBe(88);
  });

  it('tablet: drawn after the scroller inside the column', () => {
    Platform.OS = 'ios';
    useWindowDimensions.mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });
    const tree = render();
    const column = tree.root.findAll((node) => node.props.testID === 'tablet-frame-column' && typeof node.type === 'string')[0];
    const children = [].concat(column.props.children).filter(Boolean);
    expect(children.findIndex((child) => child.type === StatusBarBackdrop)).toBeGreaterThan(children.findIndex((child) => child.type === ScrollView));
  });

  it('no inset (no status bar): nothing drawn', () => {
    Platform.OS = 'ios';
    mockInsets.top = 0;
    expect(backdrop(render())).toHaveLength(0);
  });
});

// UX native final audit 27 Oct 2026, ruling 1: a screen with a pinned dock
// (PinnedDock) hands its measured height over; the scroll content's bottom
// padding is then exactly that height (it already holds the tab bar, the gap
// and the safe area), so the last row scrolls fully clear above the fade.
describe('ShellPage pinned dock room (UX native final audit 27 Oct 2026, ruling 1)', () => {
  const containerPad = (tree) => StyleSheet.flatten(tree.root.findByType(ScrollView).props.contentContainerStyle).paddingBottom ?? 0;

  it('phone: contentContainer paddingBottom = the dock height, no tab-bar padding on top of it', () => {
    Platform.OS = 'ios';
    const tree = render({ dockHeight: 254 });
    expect(containerPad(tree)).toBe(254);
    expect(bottomPadding(tree)).toBe(0);
  });

  it('tablet: the same rule (the dock replaces the 40)', () => {
    Platform.OS = 'ios';
    useWindowDimensions.mockReturnValue({ width: 834, height: 1194, scale: 2, fontScale: 1 });
    const tree = render({ dockHeight: 120 });
    expect(containerPad(tree)).toBe(120);
    expect(bottomPadding(tree)).toBe(0);
  });

  it('Android keeps the keyboard room on top of the dock height', () => {
    Platform.OS = 'android';
    const tree = render({ dockHeight: 254 });
    expect(containerPad(tree)).toBe(254);
    expect(bottomPadding(tree)).toBe(300);
  });

  it('no dock (or not measured yet): the standard tab-bar padding, as before', () => {
    Platform.OS = 'ios';
    expect(bottomPadding(render({ dockHeight: null }))).toBe(104 + 34);
    expect(containerPad(render())).toBe(0);
  });
});
