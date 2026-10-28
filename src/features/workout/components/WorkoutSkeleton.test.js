import { Animated, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import Skeleton from '../../../shared/components/Skeleton';
import { colors, radii } from '../../../shared/theme/tokens';
import WorkoutSkeleton, { SKELETON_ROW_COUNT } from './WorkoutSkeleton';

// T-76 state 7 (board "Workout hub states" 6 · Loading, UX U3).
// DECLARED: replaces the pre-T-76 skeleton tests (UX G hero radius 32 with the
// 104/132 ring, 60/62 Start, 4 day cards 188 tall in 2/3 columns, its own
// header blocks): the hub now draws the real header above
// it; the skeleton mirrors the new today card, week card and day rows, and
// says "Loading your workout…". The busy progressbar, kit-Skeleton-only blocks
// and the shimmer / reduced-motion checks are kept.
let mockReducedMotion = false;
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));

const mounted = [];
function render(props = {}) {
  let tree;
  act(() => {
    tree = create(<WorkoutSkeleton {...props} />);
  });
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  mockReducedMotion = false;
  jest.restoreAllMocks();
});

const host = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const flat = (node) => StyleSheet.flatten(node.props.style);

describe('WorkoutSkeleton: the loading region', () => {
  it('is one busy progressbar "Loading workout" with the polite "Loading your workout…" line', () => {
    const tree = render();
    expect(host(tree, 'workout-skeleton').props).toMatchObject({ accessibilityRole: 'progressbar', accessibilityLabel: 'Loading workout', accessibilityState: { busy: true } });
    const status = host(tree, 'workout-skeleton-status');
    expect(status.props.accessibilityLiveRegion).toBe('polite');
    expect(tree.root.findAllByType(Text).map((node) => node.props.children)).toEqual(['Loading your workout…']);
    expect(flat(status)).toMatchObject({ fontSize: 14, color: colors.textSecondary });
  });

  it('draws only kit Skeleton blocks: today (3 lines, 4 photos, the action), week (title, bar, 7 circles), 3 rows', () => {
    const tree = render();
    expect(tree.root.findAllByType(Skeleton)).toHaveLength(3 + 4 + 1 + 2 + 7 + SKELETON_ROW_COUNT * 3);
    expect(host(tree, 'workout-skeleton-today').findAllByType(Skeleton)).toHaveLength(8);
    expect(host(tree, 'workout-skeleton-week').findAllByType(Skeleton)).toHaveLength(9);
    expect(host(tree, 'workout-skeleton-rows').findAllByType(Skeleton)).toHaveLength(9);
  });
});

describe('WorkoutSkeleton: geometry (the loaded hub)', () => {
  it('today card r28 / padding 18; week and rows cards r24; surface with a hairline', () => {
    const tree = render();
    expect(flat(host(tree, 'workout-skeleton-today'))).toMatchObject({ borderRadius: radii.xxl, padding: 18, backgroundColor: colors.surface, borderColor: colors.hairline });
    expect(flat(host(tree, 'workout-skeleton-week')).borderRadius).toBe(radii.xl);
    expect(flat(host(tree, 'workout-skeleton-rows')).borderRadius).toBe(radii.xl);
    const circles = host(tree, 'workout-skeleton-week').findAllByType(Skeleton).slice(2);
    circles.forEach((circle) => expect(StyleSheet.flatten(circle.props.style)).toMatchObject({ width: 34, height: 34 }));
  });

  it('phone stacks; split puts the week and rows side by side (1 : 1.15)', () => {
    expect(flat(host(render(), 'workout-skeleton-week')).flex).toBeUndefined();
    const tree = render({ split: true });
    expect(flat(host(tree, 'workout-skeleton-week')).flex).toBe(1);
    expect(flat(host(tree, 'workout-skeleton-rows')).flex).toBe(1.15);
  });

  it('text blocks use minHeight (they grow with the text), never a fixed height', () => {
    const tree = render();
    const lines = host(tree, 'workout-skeleton-today').findAllByType(Skeleton).slice(0, 3);
    lines.forEach((line) => {
      const style = StyleSheet.flatten(line.props.style);
      expect(style.minHeight).toBeGreaterThan(0);
      expect(style.height).toBeUndefined();
    });
  });
});

describe('WorkoutSkeleton: shimmer and reduced motion (kit Skeleton)', () => {
  it('sweeps the kit shimmer once laid out', () => {
    const loop = jest.spyOn(Animated, 'loop');
    const tree = render();
    const block = tree.root.findAllByType(Skeleton)[0];
    const view = block.find((node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function');
    act(() => view.props.onLayout({ nativeEvent: { layout: { width: 120, height: 14, x: 0, y: 0 } } }));
    expect(loop).toHaveBeenCalled();
  });

  it('no loop under reduced motion', () => {
    mockReducedMotion = true;
    const loop = jest.spyOn(Animated, 'loop');
    const tree = render();
    tree.root.findAllByType(Skeleton).forEach((block) => {
      const view = block.find((node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function');
      act(() => view.props.onLayout({ nativeEvent: { layout: { width: 120, height: 14, x: 0, y: 0 } } }));
    });
    expect(loop).not.toHaveBeenCalled();
  });
});
