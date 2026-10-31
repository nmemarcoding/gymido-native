import { useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { ExerciseSheet } from './ExerciseNavigation';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => () => null);
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../../shared/hooks/useSheetFocus', () => ({ useSheetFocus: jest.fn() }));

const sets = (done, total) => Array.from({ length: total }, (_, i) => ({ id: i, is_completed: i < done }));
const ex = (id, name, muscle, done, total) => ({
  id,
  exercise: { name, primary_muscle_group: { code: muscle.toUpperCase(), name: muscle }, thumbnail: null },
  sets: sets(done, total),
});
const exercises = [ex(10, 'Push-up', 'Chest', 3, 3), ex(11, 'Barbell Bench Press', 'Chest', 1, 3), ex(12, 'Lat Pulldown', 'Back', 0, 1)];

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const styleOf = (node) => flat(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);

// T-170 step 4: the sheet reflows past 1.3 (fontScale only, phone and tablet alike).
describe('ExerciseSheet text scale branch', () => {
  it.each([
    [390, 1, false],
    [390, 1.15, false],
    [390, 1.3, false],
    [390, 1.31, true],
    [390, 2, true],
    [834, 1, false],
    [834, 1.3, false],
    [834, 1.31, true],
    [834, 2, true],
  ])('width %s, fontScale %s: stacked = %s', (width, scale, stacked) => {
    useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale: scale });
    let tree;
    act(() => {
      tree = create(
        <ExerciseSheet open exercises={exercises} muscleGroups={['Chest', 'Back']} activeMuscle="all" onMuscle={() => {}} currentIndex={1} onSelect={() => {}} onClose={() => {}} planName="Upper / Lower Split" />,
      );
    });
    mounted.push(tree);
    const chips = tree.root.find((n) => n.props.testID === 'exercise-sheet-chips' && typeof n.type === 'string');
    // Stacked: the chips wrap in a plain View; otherwise they scroll sideways.
    expect(chips.props.horizontal).toBe(stacked ? undefined : true);
    if (stacked) expect(flat(chips.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    if (width < 768) {
      // Phone rows: the trailing action sits below the text when stacked.
      const text = tree.root.find((n) => n.props.testID === 'exercise-sheet-text-2' && typeof n.type === 'string');
      const inText = text.findAll((n) => n.props.testID === 'exercise-sheet-action-2' && typeof n.type === 'string').length;
      expect(inText).toBe(stacked ? 1 : 0);
    } else {
      const card = tree.root.find((n) => n.props.testID === 'exercise-sheet-card-0' && typeof n.props.style === 'function');
      expect(styleOf(card).width).toBe(stacked ? '100%' : '47%');
    }
  });
});
