import { Animated, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import Skeleton from '../../../shared/components/Skeleton';
import { colors, radii, spacing, textScale } from '../../../shared/theme/tokens';
import WorkoutSkeleton, { SKELETON_DAY_COUNT } from './WorkoutSkeleton';

// UX G "Workout hub" Loading row + "Tablet: Workout hub" ("Skeleton: same
// layout, ring circle 132"); geometry as 3a's TodayHeroCard / PlanDayCard /
// WorkoutScreen Hub.
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: mockFontScale }),
}));
let mockReducedMotion = false;
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));

const mounted = [];
function render({ width = 390, fontScale = 1 } = {}) {
  mockWidth = width;
  mockFontScale = fontScale;
  let tree;
  act(() => {
    tree = create(<WorkoutSkeleton />);
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
const hosts = (tree, pattern) => tree.root.findAll((node) => typeof node.type === 'string' && pattern.test(node.props.testID ?? ''));
const flat = (node) => StyleSheet.flatten(node.props.style);
const dayCards = (tree) => hosts(tree, /^workout-skeleton-day-\d+$/);
const rows = (tree) => hosts(tree, /^workout-skeleton-day-row-\d+$/);
const cardsPerRow = (tree) => rows(tree).map((row) => row.findAll((node) => typeof node.type === 'string' && /^workout-skeleton-day-\d+$/.test(node.props.testID ?? '')).length);
function layout(node, width) {
  act(() => node.props.onLayout({ nativeEvent: { layout: { width, height: 20, x: 0, y: 0 } } }));
}

describe('WorkoutSkeleton: loading region (kit Loader / Skeleton accessibility)', () => {
  it('is one busy progressbar labelled "Loading workout"; the blocks are hidden from screen readers', () => {
    const tree = render();
    const region = host(tree, 'workout-skeleton');
    // Kept from feedbackKit.test.js (role, label, live region); busy is new (Loader's rule, UX G aria-busy).
    expect(region.props).toMatchObject({
      accessibilityRole: 'progressbar',
      accessibilityLabel: 'Loading workout',
      accessibilityLiveRegion: 'polite',
      accessibilityState: { busy: true },
    });
    const blocks = tree.root.findAllByType(Skeleton);
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((block) => {
      const view = block.findAll((node) => typeof node.type === 'string')[0];
      expect(view.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
    });
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  });

  it('draws the hub only from kit Skeleton blocks (22 blocks, 11 pill/ring shapes) on phone and tablet', () => {
    // Declared change (was 18 blocks / 10 full-radius): header (2) + hero (7) + heading (1) + 4 day cards × 3.
    [390, 834].forEach((width) => {
      const tree = render({ width });
      const blocks = tree.root.findAllByType(Skeleton);
      expect(blocks).toHaveLength(22);
      expect(blocks.filter((block) => block.props.radius === radii.full)).toHaveLength(11);
    });
  });
});

describe('WorkoutSkeleton: phone geometry (UX G "Workout hub")', () => {
  it('lays the page like the hub: gap 14, bottom 20, header then hero then days', () => {
    const tree = render();
    expect(flat(host(tree, 'workout-skeleton'))).toMatchObject({ gap: spacing['3_5'], paddingBottom: spacing[5] });
    expect(flat(host(tree, 'workout-skeleton-back'))).toMatchObject({ minHeight: 32 });
    expect(flat(host(tree, 'workout-skeleton-title'))).toMatchObject({ minHeight: 52, marginTop: spacing['0_5'] });
  });

  it('hero: radius 32, padding 22, ring circle 104, 60-tall Start pill mt 16', () => {
    const tree = render();
    const hero = flat(host(tree, 'workout-skeleton-hero'));
    expect(hero).toMatchObject({ borderRadius: radii.xxxl, padding: spacing['5_5'], borderColor: colors.hairlineStrong });
    expect(hero.height).toBeUndefined();
    expect(flat(host(tree, 'workout-skeleton-hero-top'))).toMatchObject({ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3], marginTop: spacing['3_5'] });
    expect(flat(host(tree, 'workout-skeleton-ring'))).toMatchObject({ width: 104, height: 104, borderRadius: radii.full });
    const start = flat(host(tree, 'workout-skeleton-start'));
    expect(start).toMatchObject({ minHeight: 60, marginTop: spacing[4], borderRadius: radii.full });
    expect(start.height).toBeUndefined();
    expect(start.maxWidth).toBeUndefined();
  });

  it('four day cards, 188 min tall, radius 28, padding 16, in 2 columns with gap 12', () => {
    const tree = render();
    expect(SKELETON_DAY_COUNT).toBe(4);
    const cards = dayCards(tree);
    expect(cards).toHaveLength(4);
    cards.forEach((card) => {
      const style = flat(card);
      expect(style).toMatchObject({ minHeight: 188, borderRadius: radii.xxl, padding: spacing[4], flex: 1 });
      expect(style.height).toBeUndefined();
    });
    // Declared change: was 1 column on phones ('100%' × 3); the hub is 2 columns (UX G).
    expect(cardsPerRow(tree)).toEqual([2, 2]);
    expect(flat(host(tree, 'workout-skeleton-days'))).toMatchObject({ gap: spacing[3] });
    rows(tree).forEach((row) => expect(flat(row)).toMatchObject({ flexDirection: 'row', gap: spacing[3] }));
    expect(flat(host(tree, 'workout-skeleton-day-title-0'))).toMatchObject({ marginTop: 40 });
    expect(flat(host(tree, 'workout-skeleton-day-start-0'))).toMatchObject({ minHeight: 44, marginTop: 'auto', borderRadius: radii.full });
  });
});

describe('WorkoutSkeleton: tablet geometry (UX G "Tablet: Workout hub")', () => {
  it('page gap 18; hero padding 32, ring circle 132, Start 62 tall, max 420, mt 22', () => {
    const tree = render({ width: 834 });
    expect(flat(host(tree, 'workout-skeleton'))).toMatchObject({ gap: spacing['4_5'] });
    expect(flat(host(tree, 'workout-skeleton-title'))).toMatchObject({ minHeight: 64 });
    expect(flat(host(tree, 'workout-skeleton-hero'))).toMatchObject({ borderRadius: radii.xxxl, padding: spacing[8] });
    expect(flat(host(tree, 'workout-skeleton-hero-top'))).toMatchObject({ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[5] });
    expect(flat(host(tree, 'workout-skeleton-ring'))).toMatchObject({ width: 132, height: 132, borderRadius: radii.full });
    expect(flat(host(tree, 'workout-skeleton-start'))).toMatchObject({ minHeight: 62, maxWidth: 420, marginTop: spacing['5_5'] });
    // The tablet status pill sits in the text column (no phone label row).
    expect(hosts(tree, /^workout-skeleton-label-row$/)).toHaveLength(0);
  });

  it('four day cards, 188 min tall, radius 28, padding 22, 2 columns gap 14; 3 columns from 1280', () => {
    const tree = render({ width: 834 });
    const cards = dayCards(tree);
    expect(cards).toHaveLength(4);
    cards.forEach((card) => expect(flat(card)).toMatchObject({ minHeight: 188, borderRadius: radii.xxl, padding: spacing['5_5'] }));
    // Declared change: was '48%' wide cards; now 2 flex columns.
    expect(cardsPerRow(tree)).toEqual([2, 2]);
    rows(tree).forEach((row) => expect(flat(row)).toMatchObject({ gap: spacing['3_5'] }));
    expect(flat(host(tree, 'workout-skeleton-day-start-0'))).toMatchObject({ minHeight: 50, marginTop: spacing[4] });
    const wide = render({ width: 1280 });
    expect(cardsPerRow(wide)).toEqual([3, 1]);
    // The short last row keeps the column width (spacers fill it).
    expect(hosts(wide, /^workout-skeleton-day-spacer-\d+$/)).toHaveLength(2);
  });
});

describe('WorkoutSkeleton: large text (§9)', () => {
  it('keeps one row of two columns at 1 and reflows to one column past 1.3', () => {
    expect(cardsPerRow(render({ fontScale: 1 }))).toEqual([2, 2]);
    expect(cardsPerRow(render({ fontScale: 2 }))).toEqual([1, 1, 1, 1]);
    expect(cardsPerRow(render({ width: 834, fontScale: 3.1 }))).toEqual([1, 1, 1, 1]);
  });

  it('stacks the hero top row and grows text blocks to the capped scale; the ring keeps its size', () => {
    const tree = render({ fontScale: 3.1 });
    expect(flat(host(tree, 'workout-skeleton-hero-top'))).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' });
    expect(flat(host(tree, 'workout-skeleton-label-row'))).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' });
    expect(flat(host(tree, 'workout-skeleton-title')).minHeight).toBeCloseTo(52 * textScale.display);
    expect(flat(host(tree, 'workout-skeleton-plan')).minHeight).toBeCloseTo(40 * textScale.display);
    expect(flat(host(tree, 'workout-skeleton-detail')).minHeight).toBeCloseTo(22 * textScale.body);
    expect(flat(host(tree, 'workout-skeleton-day-title-0')).minHeight).toBeCloseTo(30 * textScale.title);
    expect(flat(host(tree, 'workout-skeleton-ring'))).toMatchObject({ width: 104, height: 104 });
    dayCards(tree).forEach((card) => expect(flat(card).minHeight).toBe(188));
  });

  it('uses minHeight, never height, on every block except the ring', () => {
    [1, 2, 3.1].forEach((fontScale) => {
      const tree = render({ fontScale });
      tree.root.findAllByType(Skeleton).forEach((block) => {
        const style = StyleSheet.flatten(block.props.style);
        if (block.props.testID === 'workout-skeleton-ring') {
          return;
        }
        expect(style.height).toBeUndefined();
        expect(style.minHeight).toBeGreaterThan(0);
      });
    });
  });
});

describe('WorkoutSkeleton: shimmer and reduced motion (kit Skeleton)', () => {
  it('sweeps the kit shimmer once laid out', () => {
    const loop = jest.spyOn(Animated, 'loop');
    const tree = render();
    layout(host(tree, 'workout-skeleton-ring'), 104);
    expect(loop).toHaveBeenCalled();
    expect(flat(host(tree, 'workout-skeleton-ring-shimmer')).opacity).toBe(1);
  });

  it('turns the shimmer off under reduced motion (static blocks, no loop)', () => {
    mockReducedMotion = true;
    const loop = jest.spyOn(Animated, 'loop');
    const tree = render();
    layout(host(tree, 'workout-skeleton-ring'), 104);
    layout(host(tree, 'workout-skeleton-start'), 300);
    expect(loop).not.toHaveBeenCalled();
    expect(flat(host(tree, 'workout-skeleton-ring-shimmer')).opacity).toBe(0);
    expect(flat(host(tree, 'workout-skeleton-start-shimmer')).opacity).toBe(0);
  });
});
