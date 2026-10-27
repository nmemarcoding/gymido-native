import { useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, shadows } from '../../../shared/theme/tokens';
import { ExerciseSheet, setsLabel, sheetProgress, sheetRowState, sheetSubtitle } from './ExerciseNavigation';

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
  root.findAll((node) => node.type === 'Text').map((node) => [].concat(node.props.children).filter((c) => typeof c !== 'object').join(''));
const host = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const styleOf = (node) => flat(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);

function setWidth(width) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale: 1 });
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
    expect(sheetRowState(exercises[2], false)).toMatchObject({ kind: 'other', action: 'Go', accessibilityLabel: 'Lat Pulldown, 0 of 1 sets done' });
  });
});

describe('All exercises sheet v2 (C4), phone', () => {
  it('shows the title, the ND-5 subtitle, Close and the muscle chips', () => {
    const { tree } = render();
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['All Exercises', 'Upper / Lower Split · 4/7 sets done', 'Close', 'All', 'Chest', 'Back']));
    expect(host(tree.root, 'exercise-sheet')[0].props.accessibilityViewIsModal).toBe(true);
    expect(host(tree.root, 'exercise-sheet-chip-all')[0].props.accessibilityState).toMatchObject({ selected: true });
  });

  it('rows: sub line "{muscle} · {n} Sets · done/total", actions View / Resume / Go', () => {
    const { tree } = render();
    expect(texts(tree.root)).toEqual(
      expect.arrayContaining(['Chest · 3 Sets · 3/3', 'Chest · 3 Sets · 1/3', 'Back · 1 Set · 0/1', 'View', 'Resume', 'Go'])
    );
    expect(flat(host(tree.root, 'exercise-sheet-sub-1')[0].props.style).color).toBe(colors.gold);
    expect(flat(host(tree.root, 'exercise-sheet-sub-0')[0].props.style).color).toBe(colors.textFaint);
    expect(pressable(tree.root, 'exercise-sheet-card-1').props.accessibilityLabel).toBe('Barbell Bench Press, 1 of 3 sets done, current');
  });

  it('current row: gold ring, number badge and the gold Resume with its glow', () => {
    const { tree } = render();
    expect(styleOf(pressable(tree.root, 'exercise-sheet-card-1'))).toMatchObject({ borderColor: colors.gold, borderWidth: 1.5 });
    expect(host(tree.root, 'exercise-sheet-badge-1')).toHaveLength(1);
    expect(styleOf(pressable(tree.root, 'exercise-sheet-action-1'))).toMatchObject({ backgroundColor: colors.gold, boxShadow: shadows.goldGlow });
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
    expect(current).toMatchObject({ width: '100%', height: 250, borderColor: colors.gold });
    expect(styleOf(pressable(tree.root, 'exercise-sheet-card-0'))).toMatchObject({ height: 220, width: '47%' });
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
