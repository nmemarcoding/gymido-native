import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AppModal, { ModalActions } from '../../../shared/components/AppModal';
import PillButton from '../../../shared/components/PillButton';
import { CAP_BODY } from '../../../shared/components/largeText';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';
import { OVERFLOW_HANDOFF_MS } from '../../trainer/plans/components/PlanOverflowSheet';
import { MoreIcon } from '../../trainer/plans/components/pickerIcons';
import { FlagIcon } from '../../workout/runtime/SessionIcons';
import { END_PLAN_COPY, planActionsLabel } from '../endPlan';

// T-91 §1: the Progress ⋯ (a 36 glass circle: white 0.08 + 1px 0.12, the
// "more" glyph 18), 44 hit area, labelled "Plan actions, {plan name}".
export function PlanActionsButton({ ref, planName, onPress }) {
  return (
    <Pressable
      ref={ref}
      testID="plan-actions-button"
      accessibilityRole="button"
      accessibilityLabel={planActionsLabel(planName)}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <MoreIcon color={colors.textPrimary} size={18} />
    </Pressable>
  );
}

// T-91 (UX T91 §1): the Plan detail ⋯ menu, exactly the Progress one
// (WorkoutActionsSheet): the kit sheet titled "Plan actions", one row "End
// plan" (danger text, a flag glyph: nothing is deleted, so no trash), a
// footer Cancel and no ×. The row closes the sheet, then runs `onEnd` once
// the sheet has gone (iOS can't present the confirm while it dismisses).
export default function PlanActionsSheet({ isOpen, onClose, onEnd }) {
  const handoff = useRef(null);
  useEffect(() => () => clearTimeout(handoff.current), []);
  return (
    <AppModal
      testID="plan-actions-sheet"
      isOpen={isOpen}
      onClose={onClose}
      title={END_PLAN_COPY.menuTitle}
      size="md"
      footerDismiss
      footer={
        <ModalActions>
          <PillButton testID="plan-actions-cancel" title="Cancel" variant="secondary" onPress={onClose} />
        </ModalActions>
      }
    >
      <View accessibilityRole="menu" style={styles.list}>
        <Pressable
          testID="plan-actions-end"
          accessibilityRole="menuitem"
          accessibilityLabel={END_PLAN_COPY.menuItem}
          onPress={() => {
            onClose({ handoff: true });
            clearTimeout(handoff.current);
            handoff.current = setTimeout(onEnd, OVERFLOW_HANDOFF_MS);
          }}
          style={styles.row}
        >
          {({ pressed }) => (
            <>
              {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
              <FlagIcon color={colors.dangerText} size={20} />
              <Text {...CAP_BODY} style={styles.label}>
                {END_PLAN_COPY.menuItem}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.hairlineButton,
  },
  list: {
    gap: spacing[2],
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.fillChip,
    overflow: 'hidden',
  },
  pressed: {
    backgroundColor: colors.pressOverlay,
  },
  label: {
    ...font(600),
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
    color: colors.dangerText,
  },
});
