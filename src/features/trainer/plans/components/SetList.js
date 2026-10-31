import { StyleSheet, Text, View } from 'react-native';

import { CAP_BADGE, CAP_BODY } from '../../../../shared/components/largeText';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';
import { exerciseName, formatSetSummary } from '../planFormat';
import { TextAction, useBuilderLayout } from './builderParts';

// The set lines of an exercise (spec §A5.6) with the Part B per-set
// Edit / Delete text buttons (§B8). v2 look (UX phase4 I §1-2, phase6 O):
// member rows are text rows ("Set n" | summary | Edit | Delete; 13 px phone,
// 14 px tablet); trainer rows sit on a 4 % well with a gold-tint number
// badge. Past the §9 reflow point the buttons drop below the text.
export default function SetList({ exercise, sets, capabilities, onEditSet, onDeleteSet, look = 'member', divided = false }) {
  const { tablet, reflow } = useBuilderLayout();
  if (sets.length === 0) {
    return null;
  }
  const name = exerciseName(exercise);
  const hasControls = capabilities.editSet || capabilities.deleteSet;
  const trainer = look === 'trainer';
  const size = tablet ? 14 : 13;

  return (
    <View testID={`plan-sets-${exercise.id}`} style={[styles.sets, trainer && styles.setsTrainer, divided && styles.divided]}>
      {sets.map((set) => (
        <View
          key={set.id}
          testID={`plan-set-${set.id}`}
          style={[styles.row, tablet && styles.rowTablet, trainer && styles.rowTrainer, reflow && styles.rowReflow]}
        >
          <View style={styles.text}>
            {trainer ? (
              // Phone trainer rows draw only the badge, so it carries "Set n".
              <View
                style={styles.badge}
                accessible={!tablet}
                accessibilityLabel={tablet ? undefined : `Set ${set.set_number}`}
                accessibilityElementsHidden={tablet}
                importantForAccessibility={tablet ? 'no-hide-descendants' : 'yes'}
              >
                <Text {...CAP_BADGE} style={styles.badgeText}>
                  {set.set_number}
                </Text>
              </View>
            ) : null}
            {trainer && !tablet ? null : (
              <Text {...CAP_BODY} style={[styles.number, { fontSize: size, lineHeight: size + 5 }, tablet && styles.numberTablet]}>
                Set {set.set_number}
              </Text>
            )}
            <Text {...CAP_BODY} style={[styles.summary, { fontSize: size, lineHeight: size + 5 }, trainer && !tablet && styles.summaryTrainer]}>
              {formatSetSummary(set)}
            </Text>
          </View>
          {hasControls ? (
            <View style={[styles.controls, reflow && styles.controlsReflow]}>
              {capabilities.editSet ? (
                <TextAction
                  testID={`plan-set-edit-${set.id}`}
                  label="Edit"
                  size={size}
                  accessibilityLabel={`Edit set ${set.set_number} of ${name}`}
                  onPress={() => onEditSet(exercise, set)}
                />
              ) : null}
              {capabilities.deleteSet ? (
                <TextAction
                  testID={`plan-set-delete-${set.id}`}
                  label="Delete"
                  tone="danger"
                  size={size}
                  accessibilityLabel={`Delete set ${set.set_number} of ${name}`}
                  onPress={() => onDeleteSet(exercise, set)}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sets: {
    marginTop: spacing['1_5'],
    gap: spacing['0_5'],
  },
  setsTrainer: {
    gap: spacing['1_5'],
  },
  // Tablet member: a top hairline above the list (mt 12, padding-top 10).
  divided: {
    marginTop: spacing[3],
    paddingTop: spacing['2_5'],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  row: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  rowTablet: {
    minHeight: 40,
  },
  rowTrainer: {
    minHeight: 44,
    paddingLeft: spacing['2_5'],
    paddingRight: spacing[1],
    borderRadius: radii.sm,
    backgroundColor: colors.fillWell,
  },
  rowReflow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing[1],
    paddingVertical: spacing['1_5'],
  },
  text: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: spacing[3],
  },
  number: {
    ...font(600),
    minWidth: 42,
    color: colors.textPrimary,
  },
  numberTablet: {
    minWidth: 46,
  },
  summary: {
    ...font(400),
    flexShrink: 1,
    color: colors.textSecondary,
  },
  summaryTrainer: {
    color: colors.textStrong2,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...font(700),
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
    color: colors.gold,
  },
  controls: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing[3],
  },
  controlsReflow: {
    alignSelf: 'flex-start',
  },
});
