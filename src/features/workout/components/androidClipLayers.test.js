import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { CompleteWorkoutButton } from '../runtime/RuntimeOverlays';
import PlanDayCard from './PlanDayCard';

// Android blank-render class: a rounded view that clips (overflow hidden)
// must never also change its border/background/shadow at runtime, or Android
// stops drawing its children. These views change style, so they must not clip.
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);

const flat = (style) => StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style) ?? {};
const flatPressed = (style) => StyleSheet.flatten(typeof style === 'function' ? style({ pressed: true }) : style) ?? {};

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

describe('no clipping on views whose style changes (Android)', () => {
  it('Complete workout: the pressable never clips, in either press state', () => {
    const tree = render(<CompleteWorkoutButton completing={false} onPress={() => {}} />);
    const button = tree.root.findAll((node) => node.props.testID === 'complete-workout' && typeof node.type !== 'string')[0];
    expect(flat(button.props.style).overflow).toBeUndefined();
    expect(flatPressed(button.props.style).overflow).toBeUndefined();
  });

  it('Plan day card: the card that gains a border when done never clips', () => {
    for (const isDone of [false, true]) {
      const tree = render(<PlanDayCard day={{ id: 3, name: 'Push' }} weekdays={[]} isDone={isDone} starting={false} onStart={() => {}} index={0} />);
      const card = tree.root.findAll((node) => node.props.testID === 'workout-day-3' && typeof node.type === 'string')[0];
      expect(flat(card.props.style).overflow).toBeUndefined();
    }
  });
});
