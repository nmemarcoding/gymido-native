import { StyleSheet, View } from 'react-native';

import RemoteImage from '../../../../shared/components/RemoteImage';
import { colors, musclePalette, radii } from '../../../../shared/theme/tokens';
import { DumbbellIcon } from './pickerIcons';

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

// 52×52 thumbnail through the shared RemoteImage (Drive fallbacks; a cancelled
// load retries rather than advancing).
// `framed` false drops the picker's frame for callers that draw their own.
export default function ExerciseThumb({ exercise, size = 52, framed = true }) {
  const url = exercise.thumbnail?.url;
  const box = { width: size, height: size };

  if (!url) {
    const [background, iconColor] = getMuscleTileColors(exercise.primary_muscle_group?.code);
    return (
      <View style={[styles.thumb, box, styles.tile, { backgroundColor: background }]}>
        <DumbbellIcon color={iconColor} />
      </View>
    );
  }

  return (
    <View style={[styles.thumb, box, framed && styles.frame]}>
      <RemoteImage url={url} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radii.xxl,
    overflow: 'hidden',
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
