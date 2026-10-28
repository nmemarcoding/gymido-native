import { Platform, Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import BlurLayer from '../../../shared/components/BlurLayer';
import Chip from '../../../shared/components/Chip';
import ExerciseImage from '../../../shared/components/ExerciseImage';
import GradientFill from '../../../shared/components/GradientFill';
import { blur, colors, gradients, textScale } from '../../../shared/theme/tokens';
import {
  CURRENT_ROW_FILL,
  CURRENT_ROW_WASH,
  ExerciseSheet,
  setsLabel,
  sheetProgress,
  sheetRowState,
  sheetSubtitle,
} from './ExerciseNavigation';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => () => null);
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../../shared/hooks/useSheetFocus', () => ({ useSheetFocus: jest.fn() }));

const { useSheetFocus } = require('../../../shared/hooks/useSheetFocus');

const sets = (done, total) => Array.from({ length: total }, (_, i) => ({ id: i, is_completed: i < done }));
const ex = (id, name, muscle, done, total, url) => ({
  id,
  exercise: { name, primary_muscle_group: { code: muscle.toUpperCase(), name: muscle }, thumbnail: url ? { url } : null },
  sets: sets(done, total),
});
const exercises = [
  ex(10, 'Push-up', 'Chest', 3, 3, 'https://img/push.jpg'),
  ex(11, 'Barbell Bench Press', 'Chest', 1, 3, 'https://img/bench.jpg'),
  ex(12, 'Lat Pulldown', 'Back', 0, 1, null),
];

const texts = (root) =>
  root
    .findAll((node) => node.type === 'Text')
    .map((node) =>
      []
        .concat(node.props.children)
        .filter((c) => typeof c !== 'object')
        .join(''),
    );
const host = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const styleOf = (node) => flat(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);

function setWidth(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale });
}

const mounted = [];
function render(props = {}) {
  const all = {
    open: true,
    exercises,
    muscleGroups: ['Chest', 'Back'],
    activeMuscle: 'all',
    onMuscle: jest.fn(),
    currentIndex: 1,
    onSelect: jest.fn(),
    onClose: jest.fn(),
    planName: 'Upper / Lower Split',
    ...props,
  };
  let tree;
  act(() => {
    tree = create(<ExerciseSheet {...all} />);
  });
  mounted.push(tree);
  return { tree, props: all };
}

beforeEach(() => setWidth(390));
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
});

describe('sheet helpers', () => {
  it('sums progress and builds the ND-5 subtitle', () => {
    expect(sheetProgress(exercises)).toEqual({ done: 4, total: 7 });
    expect(sheetSubtitle('Upper / Lower Split', exercises)).toBe('Upper / Lower Split · 4/7 sets done');
    expect(sheetSubtitle(undefined, exercises)).toBe('4/7 sets done');
    expect(sheetSubtitle('P', [ex(1, 'A', 'Chest', 0, 1)])).toBe('P · 0/1 set done');
  });

  it('labels sets with singular at exactly 1', () => {
    expect(setsLabel(1)).toBe('1 Set');
    expect(setsLabel(3)).toBe('3 Sets');
  });

  it('row state: View when all done (even current), Resume current, Go otherwise; accessible name', () => {
    expect(sheetRowState(exercises[0], true)).toMatchObject({ kind: 'complete', action: 'View' });
    expect(sheetRowState(exercises[1], true)).toMatchObject({
      kind: 'current',
      action: 'Resume',
      accessibilityLabel: 'Barbell Bench Press, 1 of 3 sets done, current',
    });
    expect(sheetRowState(exercises[2], false)).toMatchObject({
      kind: 'other',
      action: 'Go',
      accessibilityLabel: 'Lat Pulldown, 0 of 1 sets done',
    });
  });
});

describe('All exercises sheet v2 (C4), phone', () => {
  it('shows the title, the ND-5 subtitle, Close and the muscle chips', () => {
    const { tree } = render();
    const shown = texts(tree.root);
    expect(shown).toEqual(
      expect.arrayContaining(['All Exercises', 'Upper / Lower Split · 4/7 sets done', 'Close', 'All', 'Chest', 'Back']),
    );
    expect(host(tree.root, 'exercise-sheet')[0].props.accessibilityViewIsModal).toBe(true);
    expect(host(tree.root, 'exercise-sheet-chip-all')[0].props.accessibilityState).toMatchObject({ selected: true });
  });

  it('rows: sub line "{muscle} · {n} Sets · done/total", actions View / Resume / Go', () => {
    const { tree } = render();
    expect(texts(tree.root)).toEqual(
      expect.arrayContaining(['Chest · 3 Sets · 3/3', 'Chest · 3 Sets · 1/3', 'Back · 1 Set · 0/1', 'View', 'Resume', 'Go']),
    );
    expect(flat(host(tree.root, 'exercise-sheet-sub-1')[0].props.style).color).toBe(colors.gold);
    expect(flat(host(tree.root, 'exercise-sheet-sub-0')[0].props.style).color).toBe(colors.textFaint);
    expect(pressable(tree.root, 'exercise-sheet-card-1').props.accessibilityLabel).toBe(
      'Barbell Bench Press, 1 of 3 sets done, current',
    );
  });

  it('current row: gold ring, number badge and the gold Resume (T-86: no glow inside a sheet)', () => {
    const { tree } = render();
    expect(styleOf(pressable(tree.root, 'exercise-sheet-card-1'))).toMatchObject({ borderColor: colors.gold, borderWidth: 1.5 });
    expect(host(tree.root, 'exercise-sheet-badge-1')).toHaveLength(1);
    expect(styleOf(pressable(tree.root, 'exercise-sheet-action-1'))).toMatchObject({
      backgroundColor: colors.gold,
    });
    // DECLARED (T-86): was boxShadow shadows.goldGlow; a button inside a sheet has no gold glow.
    expect(styleOf(pressable(tree.root, 'exercise-sheet-action-1')).boxShadow).toBeUndefined();
    expect(styleOf(pressable(tree.root, 'exercise-sheet-action-2')).backgroundColor).toBe(colors.fillSkeleton);
  });

  it('complete row: the gold check badge; the photo is ExerciseImage', () => {
    const { tree } = render();
    expect(host(tree.root, 'exercise-sheet-done-0')).toHaveLength(1);
    const image = tree.root.find((node) => node.props.testID === 'exercise-sheet-image-0' && typeof node.type !== 'string');
    expect(image.props).toMatchObject({ url: 'https://img/push.jpg', size: 52 });
  });

  it('no photo URL: the tile shows the ROW number, not initials', () => {
    const { tree } = render();
    const tile = host(tree.root, 'exercise-sheet-number-2')[0];
    expect(tile.findAll((node) => node.type === 'Text').map((n) => n.props.children)).toEqual([3]);
    expect(host(tree.root, 'exercise-sheet-image-2-initials')).toHaveLength(0);
  });

  it('a failed photo shows the muscle tile + workout icon (ExerciseImage failed state), not the number', () => {
    const { tree } = render();
    const image = tree.root.find((node) => node.props.testID === 'exercise-sheet-image-1' && typeof node.type !== 'string');
    const remote = image.findAll((node) => typeof node.props.onExhausted === 'function')[0];
    act(() => remote.props.onExhausted());
    expect(host(tree.root, 'exercise-sheet-image-1-failed')).toHaveLength(1);
    expect(host(tree.root, 'exercise-sheet-number-1')).toHaveLength(0);
  });

  it('row and action select the exercise; chips filter; Close and Android back close', () => {
    const { tree, props } = render();
    act(() => pressable(tree.root, 'exercise-sheet-card-2').props.onPress());
    act(() => pressable(tree.root, 'exercise-sheet-action-0').props.onPress());
    expect(props.onSelect.mock.calls).toEqual([[2], [0]]);
    act(() => pressable(tree.root, 'exercise-sheet-chip-Back').props.onPress());
    expect(props.onMuscle).toHaveBeenCalledWith('Back');
    act(() => pressable(tree.root, 'exercise-sheet-close').props.onPress());
    act(() => tree.root.find((node) => typeof node.props.onRequestClose === 'function').props.onRequestClose());
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('filter with no match shows the code empty line; chips stay', () => {
    const { tree } = render({ activeMuscle: 'Legs' });
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['No exercises in this group.', 'All']));
  });

  it('no muscle groups: no chip row', () => {
    const { tree } = render({ muscleGroups: [] });
    expect(tree.root.findAll((node) => node.props.testID === 'exercise-sheet-chip-all')).toHaveLength(0);
  });

  it('wires focus: title on open, the opener on close', () => {
    const opener = { current: null };
    render({ returnFocusRef: opener });
    const [open, refs] = useSheetFocus.mock.calls.at(-1);
    expect(open).toBe(true);
    expect(refs.returnRef).toBe(opener);
    expect(refs.initialRef.current).toBeTruthy();
  });
});

describe('All exercises sheet v2 (C4), tablet', () => {
  beforeEach(() => setWidth(834));

  it('stays a bottom sheet (ND-6) with photo cards; the current card spans both columns at its position', () => {
    const { tree } = render();
    const panel = styleOf(host(tree.root, 'exercise-sheet')[0]);
    expect(panel).toMatchObject({ borderTopLeftRadius: 40 });
    expect(panel.borderRadius).toBeUndefined();
    expect(host(tree.root, 'exercise-sheet-subtitle')).toHaveLength(0);
    const current = styleOf(pressable(tree.root, 'exercise-sheet-card-1'));
    expect(current).toMatchObject({ width: '100%', minHeight: 250, borderColor: colors.gold });
    expect(styleOf(pressable(tree.root, 'exercise-sheet-card-0'))).toMatchObject({ minHeight: 220, width: '47%' });
    const order = tree.root
      .findAll((node) => typeof node.type === 'string' && /^exercise-sheet-card-\d$/.test(node.props.testID ?? ''))
      .map((node) => node.props.testID);
    expect(order).toEqual(['exercise-sheet-card-0', 'exercise-sheet-card-1', 'exercise-sheet-card-2']);
  });

  it('count pills say "n of m sets done" to screen readers; Close is a text pill; chips are 44', () => {
    const { tree } = render();
    expect(host(tree.root, 'exercise-sheet-count-0')[0].props.accessibilityLabel).toBe('3 of 3 sets done');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Close', '1/3', 'Chest · 3 Sets', 'Resume', 'View', 'Go']));
    expect(styleOf(host(tree.root, 'exercise-sheet-chip-all')[0]).minHeight).toBe(44);
    expect(pressable(tree.root, 'exercise-sheet-action-1').props.accessibilityLabel).toBe('Resume Barbell Bench Press');
  });

  it('no-photo card: the muscle-tinted tile with the row number', () => {
    const { tree } = render();
    const tile = host(tree.root, 'exercise-sheet-number-2')[0];
    const number = tile.find((node) => node.type === 'Text');
    expect(number.props.children).toBe(3);
  });
});

// Phase 2 tokens pass: exact colours (UX §8.4, state rule) and large text (§9).
function childrenAt(root, id, pressed) {
  const element = root.find((node) => node.props.testID === id && typeof node.props.children === 'function');
  let inner;
  act(() => {
    inner = create(<>{element.props.children({ pressed })}</>);
  });
  mounted.push(inner);
  return inner;
}
const overlayColor = (inner, id) => {
  const found = inner.root.findAll((node) => node.props?.testID === id && typeof node.type === 'string');
  return found.length ? flat(found[0].props.style).backgroundColor : null;
};
const insideKit = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === ExerciseImage || parent.type === Chip) {
      return true;
    }
  }
  return false;
};
const ownTexts = (root) => root.findAllByType(Text).filter((node) => !insideKit(node));

describe('All exercises sheet tokens (Phase 2 exact match)', () => {
  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('panel: glass-strong + blur 24 (not the solid glass); hairline-bright handle', () => {
    for (const width of [390, 834]) {
      setWidth(width);
      const { tree } = render();
      const panel = host(tree.root, 'exercise-sheet')[0];
      expect(flat(host(tree.root, 'exercise-sheet-fill')[0].props.style).backgroundColor).toBe(colors.glassStrong);
      expect(panel.findAllByType(BlurLayer).map((node) => node.props.blurPx)).toContain(blur.glassStrong);
      expect(styleOf(host(tree.root, 'exercise-sheet-handle')[0]).backgroundColor).toBe(colors.hairlineBright);
    }
  });

  it('low-end Android (API < 31): the solid glass fallback, no panel blur', () => {
    const original = Platform.Version;
    Platform.OS = 'android';
    Object.defineProperty(Platform, 'Version', { value: 29, configurable: true });
    const { tree } = render();
    expect(flat(host(tree.root, 'exercise-sheet-fill')[0].props.style).backgroundColor).toBe(colors.glassSolid);
    expect(host(tree.root, 'exercise-sheet')[0].findAllByType(BlurLayer)).toHaveLength(0);
    Object.defineProperty(Platform, 'Version', { value: original, configurable: true });
  });

  it('backdrop is the scrim; Close uses the board colours and presses with the 4 % overlay', () => {
    const { tree } = render();
    const scrim = tree.root.find((node) => node.props.accessibilityLabel === 'Close' && !node.props.testID && node.props.onPress);
    expect(flat(scrim.props.style).backgroundColor).toBe(colors.scrim);
    expect(styleOf(pressable(tree.root, 'exercise-sheet-close'))).toMatchObject({
      backgroundColor: colors.fillSkeleton,
      borderColor: colors.hairlineStrong,
    });
    expect(overlayColor(childrenAt(tree.root, 'exercise-sheet-close', false), 'exercise-sheet-close-pressed')).toBeNull();
    expect(overlayColor(childrenAt(tree.root, 'exercise-sheet-close', true), 'exercise-sheet-close-pressed')).toBe(
      colors.pressOverlay,
    );
  });

  it('current row: surface-raised → surface-card-2 under the 4 % → clear wash, always mounted', () => {
    const { tree } = render();
    const fills = (idx) => host(tree.root, `exercise-sheet-current-fill-${idx}`)[0];
    expect(flat(fills(1).props.style).opacity).toBe(1);
    expect(flat(fills(0).props.style).opacity).toBe(0);
    const layers = fills(1)
      .findAllByType(GradientFill)
      .map((node) => node.props);
    expect(layers).toEqual([
      expect.objectContaining({ angle: 160, colors: [colors.surfaceRaised, colors.surfaceCard2] }),
      expect.objectContaining({ angle: 160, colors: [colors.pressOverlay, colors.sheenClear] }),
    ]);
    expect(CURRENT_ROW_FILL.colors).toEqual([colors.surfaceRaised, colors.surfaceCard2]);
    expect(CURRENT_ROW_WASH.colors[1]).toBe('rgba(255, 255, 255, 0)');
  });

  it('rows press with the white overlay (not a new fill); the current row has none', () => {
    const { tree } = render();
    expect(styleOf(pressable(tree.root, 'exercise-sheet-card-0')).backgroundColor).toBe(colors.fillWell);
    expect(overlayColor(childrenAt(tree.root, 'exercise-sheet-card-0', true), 'exercise-sheet-card-0-pressed')).toBe(
      colors.pressOverlay,
    );
    expect(overlayColor(childrenAt(tree.root, 'exercise-sheet-card-1', true), 'exercise-sheet-card-1-pressed')).toBeNull();
  });

  it('actions: Go/View press white 4 %, Resume presses ink 4 % on gold (no gold-deep)', () => {
    const { tree } = render();
    expect(overlayColor(childrenAt(tree.root, 'exercise-sheet-action-2', true), 'exercise-sheet-action-2-pressed')).toBe(
      colors.pressOverlay,
    );
    expect(overlayColor(childrenAt(tree.root, 'exercise-sheet-action-1', true), 'exercise-sheet-action-1-pressed')).toBe(
      colors.pressOverlayInk,
    );
    expect(styleOf(pressable(tree.root, 'exercise-sheet-action-1')).backgroundColor).toBe(colors.gold);
  });

  it('tablet cards: photo fade, on-photo-strong badge, on-photo glass count pill and Go/View, hairline-bright edge', () => {
    setWidth(834);
    const { tree } = render();
    const card = (idx) =>
      tree.root.find((node) => node.props.testID === `exercise-sheet-card-${idx}` && typeof node.props.style === 'function');
    const fade = card(0).findAllByType(GradientFill)[0].props;
    expect(fade.colors).toEqual([gradients.photoFade.colors[0], ...gradients.photoFade.colors]);
    expect(styleOf(host(tree.root, 'exercise-sheet-badge-2')[0]).backgroundColor).toBe(colors.onPhotoStrong);
    const pill = host(tree.root, 'exercise-sheet-count-0')[0];
    expect(styleOf(pill).backgroundColor).toBeUndefined();
    expect(pill.findByType(BlurLayer).props.blurPx).toBe(blur.onPhoto);
    expect(
      pill.findAll((node) => typeof node.type === 'string' && flat(node.props.style).backgroundColor === colors.onPhoto),
    ).toHaveLength(1);
    expect(styleOf(pressable(tree.root, 'exercise-sheet-action-0')).borderColor).toBe(colors.hairlineBright);
    const go = childrenAt(tree.root, 'exercise-sheet-action-0', false);
    expect(go.root.findByType(BlurLayer).props.blurPx).toBe(blur.onPhoto);
    expect(overlayColor(childrenAt(tree.root, 'exercise-sheet-action-0', true), 'exercise-sheet-action-0-pressed')).toBe(
      colors.pressOverlay,
    );
    expect(childrenAt(tree.root, 'exercise-sheet-action-1', false).root.findAllByType(BlurLayer)).toHaveLength(0);
  });
});

describe('All exercises sheet large text (UX §9)', () => {
  it.each([
    [390, 1],
    [390, 2],
    [834, 1],
    [834, 3.1],
  ])('width %s, fontScale %s: every own text capped by role, titles wrap and shrink, nothing cut to one line', (width, scale) => {
    setWidth(width, scale);
    const { tree } = render();
    ownTexts(tree.root).forEach((node) => {
      expect(node.props.maxFontSizeMultiplier).toBeGreaterThan(0);
      expect(node.props.numberOfLines === undefined || node.props.numberOfLines >= 2).toBe(true);
    });
    const title = tree.root.find((node) => node.props.testID === 'exercise-sheet-title' && node.type === Text);
    expect(title.props).toMatchObject({
      maxFontSizeMultiplier: width === 834 ? textScale.display : textScale.title,
      numberOfLines: 3,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.7,
    });
    expect(styleOf(pressable(tree.root, 'exercise-sheet-action-2')).height).toBeUndefined();
  });

  it('fontScale 1: trailing actions beside the text, chips scroll, tablet cards two per row', () => {
    const { tree } = render();
    const rowText = (idx) => host(tree.root, `exercise-sheet-text-${idx}`)[0];
    expect(rowText(2).findAll((node) => node.props.testID === 'exercise-sheet-action-2')).toHaveLength(0);
    expect(
      tree.root.find((node) => node.props.testID === 'exercise-sheet-chips' && node.props.horizontal !== undefined).props
        .horizontal,
    ).toBe(true);
    setWidth(834);
    const wide = render().tree;
    expect(styleOf(pressable(wide.root, 'exercise-sheet-card-0')).width).toBe('47%');
    expect(styleOf(host(wide.root, 'exercise-sheet-bottom-0')[0]).flexDirection).toBe('row');
  });

  it.each([2, 3.1])('fontScale %s: actions drop below the text, chips wrap, tablet cards one column', (scale) => {
    setWidth(390, scale);
    const { tree } = render();
    const rowText = host(tree.root, 'exercise-sheet-text-2')[0];
    expect(
      rowText.findAll((node) => node.props.testID === 'exercise-sheet-action-2' && typeof node.type === 'string'),
    ).toHaveLength(1);
    expect(styleOf(pressable(tree.root, 'exercise-sheet-action-2'))).toMatchObject({ marginTop: 8, alignSelf: 'flex-start' });
    const chips = host(tree.root, 'exercise-sheet-chips')[0];
    expect(flat(chips.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(chips.props.horizontal).toBeUndefined();
    setWidth(834, scale);
    const wide = render().tree;
    expect(styleOf(pressable(wide.root, 'exercise-sheet-card-0')).width).toBe('100%');
    expect(styleOf(host(wide.root, 'exercise-sheet-bottom-0')[0])).toMatchObject({
      flexDirection: 'column',
      alignItems: 'flex-start',
    });
    expect(styleOf(pressable(wide.root, 'exercise-sheet-card-0')).height).toBeUndefined();
  });
});
