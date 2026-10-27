import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// The workout prompts' backdrop blur (A2 / A3 / Discard / tablet Complete)
// is drawn ONLY while the app is in the foreground, and remounted on every
// return to 'active' (a new `key`).
//
// Why (QA: the A2 backdrop was opaque after returning from the background):
// on Android the Modal's BlurLayer (expo-blur dimezisBlurView with the app's
// blurTarget) draws a bitmap captured from the BlurTargetView. A capture made
// while the app is not active (the window's surface is gone in the
// background, or the permission / settings screen is on top) has no content,
// so the blur paints a solid frame over the live Rest screen. Dropping the
// blur while away and starting a fresh one when the app is active again means
// it never shows a stale capture; with no blur the 0.6 scrim alone still
// shows the workout.
// 'background' / 'inactive' are away; 'active' (and an unknown launch state)
// count as the foreground.
export function isForeground(appState) {
  return appState !== 'background' && appState !== 'inactive';
}

export default function useForegroundBlur() {
  const [state, setState] = useState(() => ({ active: isForeground(AppState.currentState), epoch: 0 }));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      setState((current) => {
        const active = isForeground(next);
        if (active === current.active) {
          return current;
        }
        return { active, epoch: active ? current.epoch + 1 : current.epoch };
      });
    });
    return () => subscription.remove();
  }, []);
  return { showBlur: state.active, blurKey: `blur-${state.epoch}` };
}
