import { StyleSheet } from 'react-native';

import ExerciseImage from '../../../../shared/components/ExerciseImage';
// Review M4/M5: the v2 image chain (w400 first) and media_type.
import { thumbImageProps } from '../../../plans/planImages';
import { colors, musclePalette } from '../../../../shared/theme/tokens';

const WHITE = musclePalette.iconLight;

// Spec §A7.3 tile colours by primary muscle group code: [background, icon].
const MUSCLE_TILES = {
  CHEST: [colors.navy, WHITE],
  BACK: [colors.brand400, colors.navy],
  LEGS: [musclePalette.legs, WHITE],
  SHOULDERS: [musclePalette.shoulders, WHITE],
  ARMS: [colors.arms, WHITE],
  ABS: [musclePalette.abs, colors.navy],
  CARDIO: [musclePalette.cardio, WHITE],
  QUADS: [musclePalette.quads, WHITE],
  OBLIQUES: [musclePalette.obliques, WHITE],
  BICEPS: [colors.arms, WHITE],
  ADDUCTORS: [musclePalette.adductors, WHITE],
  TRAPS_NECK: [musclePalette.trapsNeck, colors.navy],
  TRICEPS: [colors.arms, WHITE],
  ABDUCTORS: [musclePalette.abductors, WHITE],
  HAMSTRINGS: [musclePalette.hamstrings, WHITE],
  LOWER_BACK: [musclePalette.lowerBack, colors.navy],
  LATS: [musclePalette.lats, WHITE],
  GLUTES: [musclePalette.glutes, musclePalette.iconDark],
  // C11 (23 Oct 2026, owner).
  UPPER_BACK: [musclePalette.upperBack, WHITE],
  FOREARMS: [musclePalette.forearms, WHITE],
};

export function getMuscleTileColors(code) {
  return MUSCLE_TILES[code ?? 'BACK'] ?? [colors.brand400, colors.navy];
}

// The picker / builder thumbnail (default 52) through the shared v2
// ExerciseImage: the photo (Drive fallbacks; a cancelled load retries), the
// initials tile when there is no URL, the muscle tile + workout icon when the
// URL fails. `framed` (default) adds the hairline frame around it; false
// drops it for callers that draw their own. `getMuscleTileColors` stays the
// v1 tile palette for PlanDetailScreen until its own phase.
export default function ExerciseThumb({ exercise, size = 52, framed = true }) {
  return <ExerciseImage exercise={exercise} {...thumbImageProps(exercise)} size={size} style={framed ? styles.frame : null} />;
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: colors.hairline,
  },
});
