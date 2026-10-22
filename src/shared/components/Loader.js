import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/tokens';
import Spinner from './Spinner';

// Trainer plans spec §A3.5: spinner + label row.
export default function Loader({ label, style }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={[styles.row, style]}
    >
      <Spinner size={20} thickness={2} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
