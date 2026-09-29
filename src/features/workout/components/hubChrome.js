import { StyleSheet, View } from 'react-native';

import { colors, radii } from '../../../shared/theme/tokens';

// Shared hub chrome (RN-SPEC-workout §2.1).
export const SHADOW_LIFT_2 = '0 2px 4px rgba(17,24,39,0.05), 0 12px 28px -6px rgba(17,24,39,0.10)';
export const SHADOW_LIFT_2_HOVER = '0 4px 8px rgba(17,24,39,0.06), 0 24px 48px -12px rgba(17,24,39,0.16)';
export const SHADOW_BRAND = '0 6px 16px -4px rgba(244,180,0,0.45), 0 14px 32px -12px rgba(244,180,0,0.30)';
export const SHADOW_EMBOSS = 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(17,24,39,0.05)';
export const SHADOW_INSET_SOFT = 'inset 0 2px 6px rgba(17,24,39,0.12)';
export const PRESS_SHADOW = 'inset 0 2px 6px rgba(17,24,39,0.12)';

export const hubStyles = StyleSheet.create({
  // card-3d: radius 28, surface, shadow-lift-2 and a 1px inset ring. The web's
  // top highlight line is drawn by the cards that need it.
  card3d: {
    borderRadius: radii.xxxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.05)',
    boxShadow: SHADOW_LIFT_2,
  },
});

// Pressed look for a gradient button (RN-SPEC-workout §19.10). The web shifts
// the stops one step on press (brand-300→400 becomes 400→500). No overlay can
// reproduce that: compositing only compresses a colour range, and the pressed
// range is wider. So the pressed gradient is its own layer, created once at
// mount above the resting one at opacity 0, and a press only flips its opacity
// ("pre-create, don't acquire"). Swapping the gradient value itself would build
// a new BackgroundImageDrawable on every press: the rest-zero crash mechanism.
// The flip is instant, like the web's stop change.
export const PRESSED_GRADIENT = 'linear-gradient(to bottom, #f4b400, #dda000)';

export function PressedGradient({ pressed, radius }) {
  return (
    <View
      testID="pressed-gradient"
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, experimental_backgroundImage: PRESSED_GRADIENT, opacity: pressed ? 1 : 0 },
      ]}
    />
  );
}

