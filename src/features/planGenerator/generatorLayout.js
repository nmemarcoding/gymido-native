import { StyleSheet, View } from 'react-native';

import { breakpoints, colors, textScale } from '../../shared/theme/tokens';

// Shared layout rules of the generator screens (v2 Phase 4 J).

// §9 rule 4: above 1.3× text, button pairs stack (primary on top, full width)
// and trailing row actions drop below the text.
export const isReflow = (fontScale) => fontScale > textScale.reflowAbove;

// The tablet boards (TabletGenerator / TabletGeneratorPreview) from 768 up.
export const isTabletWidth = (width) => width >= breakpoints.md;


// As the app's other focus moves: give the screen time to lay out first.
export const FOCUS_DELAY_MS = 300;

// The review "Change" pill: 34 visual, 44 hit.
export const CHANGE_PILL_HEIGHT = 34;
const CHANGE_SLOP = (44 - CHANGE_PILL_HEIGHT) / 2;
export const CHANGE_HIT_SLOP = Object.freeze({ top: CHANGE_SLOP, bottom: CHANGE_SLOP, left: 4, right: 4 });

// The §8.6 press overlay (rest colour + white 4 %, or ink 4 % on light fills).
export function PressOverlay({ pressed, ink = false }) {
  return pressed ? (
    <View testID="press-overlay" pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ink ? colors.pressOverlayInk : colors.pressOverlay }]} />
  ) : null;
}
