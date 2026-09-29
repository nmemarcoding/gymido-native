import { fireEvent, render, screen } from '@testing-library/react-native';

import { DraggableRestTimer, RestTimerWidget } from '../runtime/Overlays';

const TIMER = { setId: 201, secondsLeft: 60, totalSeconds: 60, nextSetKey: '100:202' };
const LAYOUT = { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } };

async function renderTimer(props = {}) {
  const onMove = jest.fn();
  const utils = await render(
    <DraggableRestTimer
      restTimer={TIMER}
      minimized
      position={null}
      onMove={onMove}
      onExpand={jest.fn()}
      onMinimize={jest.fn()}
      onAdjust={jest.fn()}
      onSkip={jest.fn()}
      {...props}
    />
  );
  return { onMove, ...utils };
}

async function measure() {
  await fireEvent(screen.getByTestId('rest-timer-layer'), 'layout', LAYOUT);
}

const flatten = (style) => (Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity).filter(Boolean)) : style);

describe('DraggableRestTimer (§22.2)', () => {
  test('sits horizontally centred, 12 from the top, until it is dragged', async () => {
    await renderTimer();
    const placement = flatten(screen.getByTestId('rest-timer-drag').props.style);
    expect(placement.top).toBe(12);
    expect(placement.alignSelf).toBe('center');
    expect(placement.left).toBeUndefined();
  });

  test('a dragged position replaces the centred default', async () => {
    await renderTimer({ position: { x: 40, y: 500 } });
    const placement = flatten(screen.getByTestId('rest-timer-drag').props.style);
    expect(placement).toMatchObject({ left: 40, top: 500 });
    expect(placement.alignSelf).toBeUndefined();
  });

  test('keeps a constant z-index, above the page and below the completion popup', async () => {
    await renderTimer({ position: { x: 40, y: 500 } });
    expect(flatten(screen.getByTestId('rest-timer-drag').props.style).zIndex).toBe(50);
  });

  test('lets touches through everywhere except the widget itself', async () => {
    await renderTimer();
    expect(screen.getByTestId('rest-timer-layer').props.pointerEvents).toBe('box-none');
  });

  test('re-clamps an off-screen position once the layer is measured', async () => {
    const { onMove } = await renderTimer({ position: { x: 9999, y: 9999 } });
    await measure();
    expect(onMove).toHaveBeenCalledWith({ x: 390 - 80 - 8, y: 800 - 80 - 8 });
  });

  test('re-clamps on a countdown tick rather than waiting for a resize event', async () => {
    const { onMove, rerender } = await renderTimer({ position: { x: 300, y: 700 } });
    await measure();
    onMove.mockClear();

    // Expanding makes the widget 288 wide, so the old corner is now out of bounds.
    await rerender(
      <DraggableRestTimer
        restTimer={{ ...TIMER, secondsLeft: 59 }}
        minimized={false}
        position={{ x: 300, y: 700 }}
        onMove={onMove}
        onExpand={jest.fn()}
        onMinimize={jest.fn()}
        onAdjust={jest.fn()}
        onSkip={jest.fn()}
      />
    );
    expect(onMove).toHaveBeenCalledWith({ x: 390 - 288 - 8, y: 800 - 288 - 8 });
  });

  test('leaves an in-bounds position untouched on a tick', async () => {
    const { onMove, rerender } = await renderTimer({ position: { x: 100, y: 100 } });
    await measure();
    onMove.mockClear();
    await rerender(
      <DraggableRestTimer
        restTimer={{ ...TIMER, secondsLeft: 59 }}
        minimized
        position={{ x: 100, y: 100 }}
        onMove={onMove}
        onExpand={jest.fn()}
        onMinimize={jest.fn()}
        onAdjust={jest.fn()}
        onSkip={jest.fn()}
      />
    );
    expect(onMove).not.toHaveBeenCalled();
  });

  // The 4px threshold and the control lock are covered in timerDrag.test.js;
  // PanResponder derives its own gestureState, so it cannot be faked here.
  test('every excluded control takes and releases the drag lock', async () => {
    const dragLock = { onPressIn: jest.fn(), onPressOut: jest.fn() };
    await render(
      <RestTimerWidget
        restTimer={TIMER}
        minimized={false}
        dragLock={dragLock}
        onExpand={jest.fn()}
        onMinimize={jest.fn()}
        onAdjust={jest.fn()}
        onSkip={jest.fn()}
      />
    );

    const controls = [
      screen.getByLabelText('Minimize rest timer'),
      screen.getByLabelText('Decrease rest timer by 5 seconds'),
      screen.getByLabelText('Increase rest timer by 5 seconds'),
      screen.getByTestId('rest-timer-skip'),
    ];
    for (const control of controls) {
      await fireEvent(control, 'pressIn');
      await fireEvent(control, 'pressOut');
    }
    expect(dragLock.onPressIn).toHaveBeenCalledTimes(4);
    expect(dragLock.onPressOut).toHaveBeenCalledTimes(4);
  });

  test('a touch-down never claims the responder, so a tap still reaches the disc', async () => {
    await renderTimer();
    expect(screen.getByTestId('rest-timer-drag').props.onStartShouldSetResponder({})).toBe(false);
  });
});
