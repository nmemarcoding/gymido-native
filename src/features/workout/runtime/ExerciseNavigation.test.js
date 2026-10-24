import { Animated, PanResponder } from 'react-native';
import { act, create } from 'react-test-renderer';

import { ExerciseSheet, isOpenSheetSwipe, shouldDismissSheet } from './ExerciseNavigation';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Path: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);

describe('exercise nav gestures (§19.8, §19.7)', () => {
  it('opens the sheet on a swipe up past 45 that is more vertical than horizontal', () => {
    expect(isOpenSheetSwipe({ dy: -46, dx: 10 })).toBe(true);
    expect(isOpenSheetSwipe({ dy: -45, dx: 0 })).toBe(false);
    expect(isOpenSheetSwipe({ dy: -60, dx: 70 })).toBe(false);
  });

  it('dismisses a dragged sheet when far or fast enough, else springs back', () => {
    expect(shouldDismissSheet({ dy: 121, vy: 0 })).toBe(true);
    expect(shouldDismissSheet({ dy: 30, vy: 1.3 })).toBe(true);
    expect(shouldDismissSheet({ dy: 60, vy: 0.2 })).toBe(false);
  });

  it('an interrupted header drag settles: closes past the threshold, else springs back (#34)', () => {
    const configs = [];
    const real = PanResponder.create;
    jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      return real(config);
    });
    const timing = jest.spyOn(Animated, 'timing');
    const onClose = jest.fn();
    let tree;
    act(() => {
      tree = create(
        <ExerciseSheet open exercises={[]} muscleGroups={[]} activeMuscle="all" onMuscle={() => {}} currentIndex={0} onSelect={() => {}} onClose={onClose} />
      );
    });
    const header = configs.find((config) => config.onPanResponderTerminate);
    expect(header).toBeDefined();
    timing.mockClear();
    header.onPanResponderTerminate({}, { dy: 40, vy: 0 });
    expect(onClose).not.toHaveBeenCalled();
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0 }));
    header.onPanResponderTerminate({}, { dy: 200, vy: 0 });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Re-rendering with a new onClose keeps the same responder but calls the latest callback.
    const nextClose = jest.fn();
    const created = configs.length;
    act(() => {
      tree.update(
        <ExerciseSheet open exercises={[]} muscleGroups={[]} activeMuscle="all" onMuscle={() => {}} currentIndex={0} onSelect={() => {}} onClose={nextClose} />
      );
    });
    expect(configs.length).toBe(created);
    header.onPanResponderRelease({}, { dy: 200, vy: 0 });
    expect(nextClose).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    jest.restoreAllMocks();
  });
});
