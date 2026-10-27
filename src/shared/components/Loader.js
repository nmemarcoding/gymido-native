import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';
import Spinner from './Spinner';

// RN-SPEC-v2-foundation §5 (board "Loading"): an 18 px gold arc on a faint
// track beside the label, 14 secondary. Default label "Loading".
export default function Loader({ label = 'Loading', style }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={[styles.row, style]}
    >
      <Spinner size={18} thickness={2} track={colors.hairlineButton} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2_5'],
  },
  label: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
});
