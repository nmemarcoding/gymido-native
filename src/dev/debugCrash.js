import { useEffect, useState } from 'react';

// DEBUG ONLY — never reachable in a release build. Every reference to this
// module sits behind `__DEV__` (src/test/importGraph.test.js pins that), and the
// Expo dev menu it registers with does not exist in release builds.
//
// Lets testers trip the RouteErrorBoundary (RN-SPEC-app-shell §9.2) on demand:
// dev menu → "Trigger render crash" makes DebugCrashProbe, which sits inside
// the boundary, throw while rendering. The flag stays set until the JS reload
// ("Reload app") resets this module: React retries a failed render once, and a
// flag cleared on the first throw would let the retry succeed and skip the
// boundary.

let crashRequested = false;
const listeners = new Set();

export function requestRenderCrash() {
  crashRequested = true;
  listeners.forEach((listener) => listener());
}

export function DebugCrashProbe() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((count) => count + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  if (crashRequested) {
    throw new Error('Debug render crash (dev menu)');
  }
  return null;
}

export function registerDebugCrashMenuItem() {
  try {
    require('expo-dev-client')
      .registerDevMenuItems([{ name: 'Trigger render crash', callback: requestRenderCrash, shouldCollapse: true }])
      .catch(() => {});
  } catch {
    // No dev menu here (Jest, or no dev client): nothing to register.
  }
}

// Test hook.
export function resetDebugCrashForTest() {
  crashRequested = false;
}
