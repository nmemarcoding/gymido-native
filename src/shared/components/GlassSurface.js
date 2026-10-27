import { Platform, StyleSheet, View } from 'react-native';

import { colors, shadows } from '../theme/tokens';
import BlurLayer from './BlurLayer';

// v2 glass chrome (RN-SPEC-v2-foundation §1.1 color-glass, §3 blur-glass):
// a frosted surface over the content: blur, the glass colour, a strong
// hairline edge and the float shadow. Used by the tab bar, glass icon
// buttons, toasts and sticky chrome.
//
// Before Android 12 (API 31) expo-blur's dimezis method blurs on the CPU
// every frame; there the surface draws the solid glass instead (low-end
// Android fallback, PM-approved 26 Oct). `solid` forces it anywhere.
export const BLUR_MIN_ANDROID_API = 31;

export function usesSolidGlass(platform = Platform) {
  return platform.OS === 'android' && Number(platform.Version) < BLUR_MIN_ANDROID_API;
}

export default function GlassSurface({
  children,
  style,
  radius = 0,
  blurPx = 24,
  tone = 'glass',
  solid = false,
  overApp = false,
  shadow = true,
  testID,
  ...viewProps
}) {
  const solidGlass = solid || usesSolidGlass();
  const fill = solidGlass ? colors.glassSolid : tone === 'toast' ? colors.glassToast : colors.glass;
  return (
    <View
      testID={testID}
      style={[styles.surface, { borderRadius: radius }, shadow && styles.float, style]}
      {...viewProps}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
        {solidGlass ? null : <BlurLayer blurPx={blurPx} overApp={overApp} />}
        <View testID={testID ? `${testID}-fill` : undefined} style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  clip: {
    overflow: 'hidden',
  },
  float: {
    boxShadow: shadows.float,
  },
});
