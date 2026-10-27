import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';

import { appBlurTargetRef } from './blurTarget';

// Backdrop blur behind a scrim or bar (app-shell spec §1.0 item 2): Android
// needs dimezisBlurView or the blur silently does nothing, and every caller
// keeps its own solid-enough colour on top so the design reads without it.
// CSS blur px map to intensity as the app-shell spec does for the tab bar
// (8px → 20).
// `tint` is 'dark' in v2 (dark only); the glass colour on top carries the look.
// `overApp` is only for layers drawn in their own Modal window: on Android
// they blur the app's BlurTargetView. A layer inside that view (the tab bar)
// must not target it — it would draw itself recursively and overflow the
// RenderThread stack.
export default function BlurLayer({ blurPx = 8, overApp = false, tint = 'dark' }) {
  const android = Platform.OS === 'android';
  return (
    <BlurView
      pointerEvents="none"
      tint={tint}
      intensity={blurPx * 2.5}
      blurMethod={android ? 'dimezisBlurView' : undefined}
      blurTarget={android && overApp ? appBlurTargetRef : undefined}
      style={StyleSheet.absoluteFill}
    />
  );
}
