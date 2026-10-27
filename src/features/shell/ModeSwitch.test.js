import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, font } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import ModeSwitch, { MODE_SEGMENT_WIDTH } from './ModeSwitch';
import { openShellPath } from './shellLinks';
import { saveWorkspacePreference } from './shellUiStore';

jest.mock('./shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./shellUiStore', () => ({ saveWorkspacePreference: jest.fn() }));

// App-shell §6.2 behaviour (unchanged) in the v2 segmented look (§4.7):
// restyle only, placement stays v1's until Phase 5.

const flat = (style) => StyleSheet.flatten(style) ?? {};
const segment = (tree, mode) =>
  tree.root.findAll((node) => node.props.testID === `mode-switch-${mode}` && typeof node.props.style === 'function')[0];
const segStyle = (tree, mode) => flat(segment(tree, mode).props.style({ pressed: false }));
const textStyle = (tree, text) => flat(tree.root.findAll((node) => node.type === Text && node.props.children === text)[0].props.style);

const mounted = [];
function render(roles, mode = 'member') {
  act(() => useAuthStore.setState({ user: { roles } }));
  let tree;
  act(() => {
    tree = create(<ModeSwitch mode={mode} />);
  });
  mounted.push(tree);
  return tree;
}

describe('ModeSwitch', () => {
  afterEach(() => {
    mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
    jest.clearAllMocks();
  });

  it('members see nothing', () => {
    expect(render(['member']).toJSON()).toBeNull();
  });

  it('trainers: a "Workspace" group with Personal / Trainer, at least 120 wide, 40 tall segments, 44 hit area', () => {
    const tree = render(['trainer']);
    expect(tree.root.findAll((node) => node.type === 'View' && node.props.accessibilityLabel === 'Workspace')).toHaveLength(1);
    expect(MODE_SEGMENT_WIDTH).toBe(120);
    ['member', 'trainer'].forEach((mode) => {
      const style = segStyle(tree, mode);
      // Review: minWidth, so the largest Dynamic Type grows the segment.
      expect(style.minWidth).toBe(120);
      expect(style.width).toBeUndefined();
      expect(style.minHeight).toBe(40);
      const slop = segment(tree, mode).props.hitSlop;
      expect(slop.top + 40 + slop.bottom).toBe(44);
      expect(segment(tree, mode).props.accessibilityRole).toBe('button');
    });
  });

  it('selected segment is white with on-light 600; the other transparent with text-secondary 500', () => {
    const tree = render(['trainer'], 'trainer');
    expect(segStyle(tree, 'trainer').backgroundColor).toBe(colors.textPrimary);
    expect(segStyle(tree, 'member').backgroundColor).toBeUndefined();
    expect(textStyle(tree, 'Trainer').color).toBe(colors.onLight);
    expect(textStyle(tree, 'Trainer').fontFamily).toBe(font(600).fontFamily);
    expect(textStyle(tree, 'Personal').color).toBe(colors.textSecondary);
    expect(textStyle(tree, 'Personal').fontFamily).toBe(font(500).fontFamily);
    expect(segment(tree, 'trainer').props.accessibilityState).toEqual({ selected: true });
    expect(segment(tree, 'member').props.accessibilityState).toEqual({ selected: false });
  });

  it('switching saves the preference and opens that workspace home', () => {
    const tree = render(['trainer'], 'member');
    act(() => segment(tree, 'trainer').props.onPress());
    expect(saveWorkspacePreference).toHaveBeenCalledWith('trainer');
    expect(openShellPath).toHaveBeenCalledWith('/trainer');
  });

  it('pressing the current workspace does nothing', () => {
    const tree = render(['trainer'], 'member');
    act(() => segment(tree, 'member').props.onPress());
    expect(saveWorkspacePreference).not.toHaveBeenCalled();
    expect(openShellPath).not.toHaveBeenCalled();
  });
});
