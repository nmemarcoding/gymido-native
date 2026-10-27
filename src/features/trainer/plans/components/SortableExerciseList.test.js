jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
}));

import { act, create } from 'react-test-renderer';

import SortableExerciseList from './SortableExerciseList';

// Review 26fc4a8 M7: the drag path. Only the grip starts a drag; a drop goes
// through onMove(from, to); Move up / Move down use the row's position.

let mockListProps;
const mockDrags = {};
jest.mock('react-native-draggable-flatlist', () => {
  const { Fragment: F } = require('react');
  return {
    NestableDraggableFlatList: (props) => {
      mockListProps = props;
      return props.data.map((item) => {
        mockDrags[item.id] = mockDrags[item.id] ?? jest.fn();
        return <F key={props.keyExtractor(item)}>{props.renderItem({ item, drag: mockDrags[item.id], isActive: false })}</F>;
      });
    },
  };
});
jest.mock('../../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

const EXERCISES = [
  { id: 11, exercise: { id: 5, name: 'Back Squat' } },
  { id: 12, exercise: { id: 6, name: 'Bench Press' } },
  { id: 13, exercise: { id: 7, name: 'Row' } },
];

function render(onMove, capabilities = { reorderExercises: true }) {
  let tree;
  act(() => {
    tree = create(
      <SortableExerciseList exercises={EXERCISES} setsByExercise={{}} capabilities={capabilities} onMove={onMove} onAddSet={jest.fn()} onDeleteExercise={jest.fn()} onEditSet={jest.fn()} onDeleteSet={jest.fn()} />
    );
  });
  return tree;
}
const grip = (tree, id) => tree.root.find((node) => node.props.testID === `plan-exercise-grip-${id}` && typeof node.props.onAccessibilityAction === 'function');

describe('SortableExerciseList reorder (review M7)', () => {
  it('a drop calls onMove(from, to); the drag starts 6 px after a grip touch', () => {
    const onMove = jest.fn();
    render(onMove);
    expect(mockListProps.activationDistance).toBe(6);
    act(() => mockListProps.onDragEnd({ from: 0, to: 2, data: [] }));
    expect(onMove).toHaveBeenCalledWith(0, 2);
  });

  it('only the grip arms the drag (onPressIn = the row drag)', () => {
    const tree = render(jest.fn());
    expect(grip(tree, 12).props.onPressIn).toBe(mockDrags[12]);
  });

  it('Move up / Move down from the middle row; ignored past the ends; unknown actions ignored', () => {
    const onMove = jest.fn();
    const tree = render(onMove);
    const fire = (id, actionName) => act(() => grip(tree, id).props.onAccessibilityAction({ nativeEvent: { actionName } }));
    fire(12, 'moveUp');
    fire(12, 'moveDown');
    expect(onMove.mock.calls).toEqual([
      [1, 0],
      [1, 2],
    ]);
    fire(11, 'moveUp');
    fire(13, 'moveDown');
    fire(12, 'activate');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('without the reorder capability there is no grip', () => {
    const tree = render(jest.fn(), {});
    expect(tree.root.findAll((node) => (node.props.testID ?? '').startsWith('plan-exercise-grip-'))).toHaveLength(0);
  });
});
