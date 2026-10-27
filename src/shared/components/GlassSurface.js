import { Platform, StyleSheet, View } from 'react-native';

import { blur, colors, shadows } from '../theme/tokens';
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

// Tones (UX §8.4 / §8.7): the fill and its blur radius. `solidFill` is what
// the low-end Android fallback draws with no blur: the grey glass tones fall
// back to glassSolid; the dark tones keep their own fill (it reads without
// the blur).
//   glass        chrome: tab bar, glass buttons, sticky chrome (blur 24)
//   toast        toasts (blur 24)
//   glassStrong  near-solid sheets and panels (blur.glassStrong)
//   onPhoto      chips and buttons over photos (blur.onPhoto)
//   scrimStrong  U4: the dark loading disc, scrim-strong 0.72 + blur 16
export const GLASS_TONES = Object.freeze({
  glass: Object.freeze({ fill: colors.glass, blurPx: blur.glass, solidFill: colors.glassSolid }),
  toast: Object.freeze({ fill: colors.glassToast, blurPx: blur.glass, solidFill: colors.glassSolid }),
  glassStrong: Object.freeze({ fill: colors.glassStrong, blurPx: blur.glassStrong, solidFill: colors.glassSolid }),
  onPhoto: Object.freeze({ fill: colors.onPhoto, blurPx: blur.onPhoto, solidFill: colors.onPhoto }),
  scrimStrong: Object.freeze({ fill: colors.scrimStrong, blurPx: blur.scrimStrong, solidFill: colors.scrimStrong }),
});

// `blurPx` overrides the tone's radius; `fill` overrides the tone's fill
// over the blur (the solid fallback keeps the tone's solidFill).
export default function GlassSurface({
  children,
  style,
  radius = 0,
  blurPx,
  tone = 'glass',
  fill,
  solid = false,
  overApp = false,
  shadow = true,
  testID,
  ...viewProps
}) {
  const look = GLASS_TONES[tone] ?? GLASS_TONES.glass;
  const solidGlass = solid || usesSolidGlass();
  const fillColor = solidGlass ? look.solidFill : (fill ?? look.fill);
  return (
    <View
      testID={testID}
      style={[styles.surface, { borderRadius: radius }, shadow && styles.float, style]}
      {...viewProps}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
        {solidGlass ? null : <BlurLayer blurPx={blurPx ?? look.blurPx} overApp={overApp} />}
        <View testID={testID ? `${testID}-fill` : undefined} style={[StyleSheet.absoluteFill, { backgroundColor: fillColor }]} />
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
