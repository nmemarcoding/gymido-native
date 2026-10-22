import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppModal from '../../../../shared/components/AppModal';
import PillButton from '../../../../shared/components/PillButton';
import { colors } from '../../../../shared/theme/tokens';
import WeightHistoryChart from './WeightHistoryChart';

// Development only: renders the weight chart from fixed logs (no API, no
// writes) so its curve rules can be checked on a device.
const FIXTURE = [80, 82, 81, 81, 79].map((value, index) => ({
  id: index,
  recorded_on: `2026-10-${String(10 + index * 2).padStart(2, '0')}`,
  weight_value: value,
  weight_unit: 'kg',
}));

export default function ChartFixture() {
  const [open, setOpen] = useState(false);
  if (!__DEV__) {
    return null;
  }
  return (
    <>
      <PillButton testID="dev-chart-fixture" title="Chart fixture (dev)" variant="secondary" onPress={() => setOpen(true)} />
      <AppModal
        testID="dev-chart-fixture-modal"
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Chart fixture"
        description="80, 82, 81, 81, 79 kg — then a single log."
        size="2xl"
        footer={<PillButton testID="dev-chart-fixture-close" title="Close" variant="secondary" fullWidth onPress={() => setOpen(false)} />}
      >
        <View style={styles.body}>
          <WeightHistoryChart logs={FIXTURE} profile={null} />
          <Text style={styles.label}>One log:</Text>
          <WeightHistoryChart logs={FIXTURE.slice(0, 1)} profile={null} />
        </View>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 16,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
