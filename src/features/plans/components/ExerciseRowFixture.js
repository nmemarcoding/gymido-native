import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import AppModal from '../../../shared/components/AppModal';
import PillButton from '../../../shared/components/PillButton';
import { ExerciseRow } from '../screens/PlanDetailScreen';

// Development only: S2 exercise rows from fixed data (no API, no writes) —
// notes (§4.4), the no-image colour tile, and a broken image URL that falls
// back to the tile once every candidate fails (R3).
const ROWS = [
  {
    id: 1,
    notes: '  Control the lowering for 3 seconds.\nPause at the bottom.  ',
    exercise: { name: 'Barbell Bench Press - Medium Grip', primary_muscle_group: { code: 'CHEST', name: 'Chest' } },
    target_set_summary: { set_count: 4, target_reps_min: 8, target_reps_max: 12 },
  },
  {
    id: 2,
    exercise: { name: 'Seated Dumbbell Shoulder Press', primary_muscle_group: { code: 'SHOULDERS', name: 'Shoulders' } },
    target_set_summary: { set_count: 1, target_reps_min: 10 },
  },
  {
    id: 3,
    notes: '   ',
    exercise: {
      name: 'Lying Leg Curl',
      primary_muscle_group: { code: 'HAMSTRINGS', name: 'Hamstrings' },
      thumbnail: { url: 'https://invalid.example/missing.gif' },
    },
  },
];

export default function ExerciseRowFixture() {
  const [open, setOpen] = useState(false);
  if (!__DEV__) {
    return null;
  }
  return (
    <>
      <PillButton testID="dev-row-fixture" title="Exercise rows (dev)" variant="secondary" onPress={() => setOpen(true)} />
      <AppModal
        testID="dev-row-fixture-modal"
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Exercise rows"
        description="Notes · no image · broken image → tile."
        footer={<PillButton testID="dev-row-fixture-close" title="Close" variant="secondary" fullWidth onPress={() => setOpen(false)} />}
      >
        <View style={styles.list}>
          {ROWS.map((item, index) => (
            <ExerciseRow key={item.id} item={item} position={index + 1} onPress={() => {}} />
          ))}
        </View>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
});
