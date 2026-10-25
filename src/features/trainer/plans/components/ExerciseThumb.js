import { StyleSheet, View } from 'react-native';

import RemoteImage from '../../../../shared/components/RemoteImage';
import { colors, radii } from '../../../../shared/theme/tokens';
import { DumbbellIcon } from './pickerIcons';

const WHITE = '#ffffff';

// Spec §A7.3 tile colours by primary muscle group code: [background, icon].
const MUSCLE_TILES = {
  CHEST: [colors.navy, WHITE],
  BACK: [colors.brand400, colors.navy],
  LEGS: ['#3A4D6A', WHITE],
  SHOULDERS: ['#009CA6', WHITE],
  ARMS: [colors.arms, WHITE],
  ABS: ['#FF6A00', colors.navy],
  CARDIO: ['#009CA6', WHITE],
  QUADS: ['#3B82F6', WHITE],
  OBLIQUES: ['#8B5CF6', WHITE],
  BICEPS: [colors.arms, WHITE],
  ADDUCTORS: ['#06B6D4', WHITE],
  TRAPS_NECK: ['#F59E0B', colors.navy],
  TRICEPS: [colors.arms, WHITE],
  ABDUCTORS: ['#14B8A6', WHITE],
  HAMSTRINGS: ['#D946EF', WHITE],
  LOWER_BACK: ['#F97316', colors.navy],
  LATS: ['#0EA5E9', WHITE],
  GLUTES: ['#84CC16', '#000000'],
  // C11 (23 Oct 2026, owner).
  UPPER_BACK: ['#3A4D6A', WHITE],
  FOREARMS: ['#14B8A6', WHITE],
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
