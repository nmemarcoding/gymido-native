import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/tokens';
import { CAP_BODY } from './largeText';
import Spinner from './Spinner';

// RN-SPEC-v2-foundation §5 + FINAL-AUDIT "Rulings for FE batch 1"
// (2026-10-27): ONE Loader look app-wide wherever no skeleton is drawn. A
// card (radius 20, surface + 1 px hairline) with a 22 px spinner (gold 2.5
// arc on a white 0.08 track) beside the label, 14 secondary. Default label
// "Loading". A caller's `style` places the card (margins, page padding); the
// card itself always keeps the one look.
export const LOADER_SPINNER = Object.freeze({ size: 22, thickness: 2.5 });

export default function Loader({ label = 'Loading', style }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={style}
    >
      <View testID="loader-card" style={styles.card}>
        <Spinner size={LOADER_SPINNER.size} thickness={LOADER_SPINNER.thickness} color={colors.gold} track={colors.fillGlass} />
        <Text {...CAP_BODY} style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2_5'],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[5],
  },
  label: {
    ...typography.bodySm,
    flexShrink: 1,
    color: colors.textSecondary,
  },
});
