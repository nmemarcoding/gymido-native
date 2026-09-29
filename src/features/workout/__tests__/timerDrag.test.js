import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { clampTimerPosition, defaultTimerPosition, TIMER_DEFAULT_TOP } from '../runtime/runtimeRules';
import { createTimerDragConfig } from '../runtime/timerDrag';
import { useRestTimer } from '../runtime/useRestTimer';

const BOUNDS = { width: 390, height: 800 };
const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

describe('clampTimerPosition (§22.2)', () => {
  it('leaves a position that is already inside the 8px margin alone', () => {
    expect(clampTimerPosition({ x: 100, y: 200 }, { size: 80, bounds: BOUNDS, insets: NO_INSETS })).toEqual({
      x: 100,
      y: 200,
    });
  });

  it('pulls a position back to the 8px margin on every edge', () => {
    const geometry = { size: 80, bounds: BOUNDS, insets: NO_INSETS };
    expect(clampTimerPosition({ x: -500, y: -500 }, geometry)).toEqual({ x: 8, y: 8 });
    expect(clampTimerPosition({ x: 5000, y: 5000 }, geometry)).toEqual({
      x: 390 - 80 - 8,
      y: 800 - 80 - 8,
    });
  });

  it('pins to 8 rather than going negative when the widget is wider than the box', () => {
    // The web's inner max(8, …) on the upper bound, reproduced.
    const narrow = { size: 288, bounds: { width: 200, height: 200 }, insets: NO_INSETS };
    expect(clampTimerPosition({ x: 1000, y: 1000 }, narrow)).toEqual({ x: 8, y: 8 });
  });

  it('[O2] measures the margin from the safe-area edges, not the raw window', () => {
    const geometry = { size: 80, bounds: BOUNDS, insets: { top: 59, bottom: 34, left: 20, right: 20 } };
    expect(clampTimerPosition({ x: 0, y: 0 }, geometry)).toEqual({ x: 28, y: 67 });
    expect(clampTimerPosition({ x: 9999, y: 9999 }, geometry)).toEqual({
      x: 390 - 20 - 80 - 8,
      y: 800 - 34 - 80 - 8,
    });
  });

  it('passes a null position straight through', () => {
    expect(clampTimerPosition(null, { size: 80, bounds: BOUNDS })).toBeNull();
    expect(clampTimerPosition({ x: 1, y: 2 }, { size: 80, bounds: null })).toEqual({ x: 1, y: 2 });
  });
});

describe('defaultTimerPosition (§22.2)', () => {
  it('is horizontally centred, 12 from the top', () => {
    expect(defaultTimerPosition({ size: 80, bounds: BOUNDS })).toEqual({ x: 155, y: TIMER_DEFAULT_TOP });
  });

  it('is null until the overlay has been measured', () => {
    expect(defaultTimerPosition({ size: 80, bounds: null })).toBeNull();
  });
});

describe('createTimerDragConfig (§22.2)', () => {
  function setup({ position = null, size = 80, held = false } = {}) {
    const onMove = jest.fn();
    const state = { position, held };
    const config = createTimerDragConfig({
      getGeometry: () => ({ position: state.position, size, bounds: BOUNDS, insets: NO_INSETS }),
      isControlHeld: () => state.held,
      releaseControl: () => {
        state.held = false;
      },
      onMove,
    });
    return { config, onMove, state };
  }

  const gesture = (dx, dy) => ({ dx, dy });

  it('treats anything under 4px as a tap, not a drag', () => {
    const { config } = setup();
    expect(config.onMoveShouldSetPanResponder({}, gesture(3, 3))).toBe(false);
    expect(config.onMoveShouldSetPanResponder({}, gesture(-3.9, 0))).toBe(false);
  });

  it('starts dragging at 4px on either axis', () => {
    const { config } = setup();
    expect(config.onMoveShouldSetPanResponder({}, gesture(4, 0))).toBe(true);
    expect(config.onMoveShouldSetPanResponder({}, gesture(0, -4))).toBe(true);
  });

  it('never starts a drag while one of the four controls is held', () => {
    const { config } = setup({ held: true });
    expect(config.onMoveShouldSetPanResponder({}, gesture(40, 40))).toBe(false);
  });

  it('releases the control lock on the next touch, so a lost press cannot wedge it', () => {
    const { config, state } = setup({ held: true });
    expect(config.onStartShouldSetPanResponderCapture({})).toBe(false);
    expect(state.held).toBe(false);
    expect(config.onMoveShouldSetPanResponder({}, gesture(40, 40))).toBe(true);
  });

  it('moves from the untouched default when the widget has never been dragged', () => {
    const { config, onMove } = setup();
    config.onPanResponderGrant({});
    config.onPanResponderMove({}, gesture(10, 20));
    // Centred default (155, 12) plus the total delta.
    expect(onMove).toHaveBeenCalledWith({ x: 165, y: 32 });
  });

  it('keeps the grab offset by applying the total delta to the grab origin', () => {
    const { config, onMove } = setup({ position: { x: 100, y: 100 } });
    config.onPanResponderGrant({});
    config.onPanResponderMove({}, gesture(4, 0)); // the move that crossed the threshold
    config.onPanResponderMove({}, gesture(30, 15));
    expect(onMove).toHaveBeenNthCalledWith(1, { x: 104, y: 100 });
    expect(onMove).toHaveBeenNthCalledWith(2, { x: 130, y: 115 });
  });

  it('clamps while dragging, so the widget cannot leave the screen', () => {
    const { config, onMove } = setup({ position: { x: 100, y: 100 } });
    config.onPanResponderGrant({});
    config.onPanResponderMove({}, gesture(-9999, 9999));
    expect(onMove).toHaveBeenCalledWith({ x: 8, y: 800 - 80 - 8 });
  });

  it('stays where it was dropped and ignores stray moves after release', () => {
    const { config, onMove } = setup({ position: { x: 100, y: 100 } });
    config.onPanResponderGrant({});
    config.onPanResponderMove({}, gesture(20, 20));
    config.onPanResponderRelease({});
    onMove.mockClear();
    config.onPanResponderMove({}, gesture(50, 50));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('drops the drag when the gesture is terminated', () => {
    const { config, onMove } = setup({ position: { x: 100, y: 100 } });
    config.onPanResponderGrant({});
    config.onPanResponderTerminate({});
    onMove.mockClear();
    config.onPanResponderMove({}, gesture(50, 50));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not claim the responder on touch-down, so a tap still reaches the disc', () => {
    const { config } = setup();
    expect(config.onStartShouldSetPanResponder({})).toBe(false);
  });
});

describe('the dragged position in useRestTimer (⚠W23)', () => {
  it('survives later rests in the same visit, and resets when the session changes', async () => {
    const { result, rerender } = await renderHook(({ sessionId }) => useRestTimer({ sessionId }), {
      initialProps: { sessionId: 7 },
    });

    expect(result.current.timerPosition).toBeNull();
    await act(async () => result.current.setTimerPosition({ x: 40, y: 500 }));
    expect(result.current.timerPosition).toEqual({ x: 40, y: 500 });

    // A rest ending does not move the widget back.
    await act(async () => result.current.clearRestTimer());
    expect(result.current.timerPosition).toEqual({ x: 40, y: 500 });

    await act(async () => {
      result.current.startRestTimer({ setId: 202, restSeconds: 60, nextSetKey: '100:203' });
    });
    expect(result.current.timerPosition).toEqual({ x: 40, y: 500 });

    // Nothing is persisted — no storage key, on purpose.
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    // A new session starts from the centred default again.
    await rerender({ sessionId: 8 });
    expect(result.current.timerPosition).toBeNull();
  });
});
