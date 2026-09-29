import { clampTimerPosition, defaultTimerPosition, TIMER_DRAG_THRESHOLD } from './runtimeRules';

// §22.2: the rest-timer widget's drag, as a plain PanResponder config so the
// rules can be tested without a touch stack. The web uses Pointer Events with
// setPointerCapture; PanResponder is the native equivalent the spec allows, and
// it needs no new dependency.
//
// - The drag only becomes real past a 4px move on either axis, which is what
//   separates a tap from a drag on the collapsed disc.
// - Position is origin + total delta, so the original grab offset is preserved
//   and the widget never jumps when the threshold is crossed.
// - Every move is clamped, and dropping is instant: no release animation.
export function createTimerDragConfig({ getGeometry, isControlHeld, releaseControl, onMove }) {
  let origin = null;

  return {
    // Capture runs before a control's onPressIn, so every new touch starts
    // unblocked even if an earlier press never reported its release.
    onStartShouldSetPanResponderCapture: () => {
      releaseControl();
      return false;
    },
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) =>
      !isControlHeld() &&
      (Math.abs(gesture.dx) >= TIMER_DRAG_THRESHOLD || Math.abs(gesture.dy) >= TIMER_DRAG_THRESHOLD),
    onPanResponderGrant: () => {
      const geometry = getGeometry();
      origin = geometry.position || defaultTimerPosition(geometry);
    },
    onPanResponderMove: (_event, gesture) => {
      if (!origin) {
        return;
      }
      onMove(clampTimerPosition({ x: origin.x + gesture.dx, y: origin.y + gesture.dy }, getGeometry()));
    },
    onPanResponderRelease: () => {
      origin = null;
    },
    onPanResponderTerminate: () => {
      origin = null;
    },
  };
}
