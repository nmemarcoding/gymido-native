import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { SessionChrome } from '../runtime/RuntimeParts';
import HubDayRows from './hub/HubDayRows';

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
  // DECLARED (T-105, PM OK 29 Oct): was CompleteWorkoutButton (the end-of-column button, removed); the same check on
  // the header's Complete, in both tones.
  it('Complete workout: the pressable never clips, in either press state', () => {
    for (const completePrimary of [false, true]) {
      const tree = render(
        <SessionChrome planName="Plan" completedSets={1} totalSets={4} exerciseCount={2} onExit={() => {}} onAll={() => {}} onComplete={() => {}} completePrimary={completePrimary} />
      );
      const button = tree.root.findAll((node) => node.props.testID === 'complete-workout' && typeof node.type !== 'string')[0];
      expect(flat(button.props.style).overflow).toBeUndefined();
      expect(flatPressed(button.props.style).overflow).toBeUndefined();
    }
  });

  // DECLARED (T-76): was the PlanDayCard card (retired); the hub day row, which fades when done.
  it('Hub day row: the row (done or not) never clips', () => {
    for (const done of [false, true]) {
      const row = { dayId: 3, title: 'Push', done, meta: 'Any day · 5 exercises', action: `${done ? 'Repeat' : 'Start'} Push` };
      const copy = { title: 'Other days', help: 'Tap any day.' };
      const tree = render(<HubDayRows copy={copy} rows={[row]} exercisesByDay={{ 3: [] }} startingDayId={null} onStart={() => {}} />);
      const pressable = tree.root.findAll((node) => node.props.testID === 'workout-day-start-3' && typeof node.type !== 'string')[0];
      expect(flat(pressable.props.style).overflow).toBeUndefined();
      expect(flatPressed(pressable.props.style).overflow).toBeUndefined();
    }
  });
});
