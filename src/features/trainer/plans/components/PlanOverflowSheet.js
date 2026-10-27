import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AppModal, { ModalActions } from '../../../../shared/components/AppModal';
import PillButton from '../../../../shared/components/PillButton';
import { CAP_BODY } from '../../../../shared/components/largeText';
import Spinner from '../../../../shared/components/Spinner';
import { colors, font, motion, radii, spacing } from '../../../../shared/theme/tokens';

// The phone builder's "More plan actions" sheet (UX phase4 I §1 "Overflow
// open", undrawn): the kit sheet with an action list, rows 52 tall, 16/600,
// gap 8; "Delete plan" in danger text. It equals the tablet header buttons
// (approved): Edit details, Make a copy, Deactivate / Activate, Delete plan.
// A row closes the sheet, then runs its action (after the sheet's exit).
// UX R2-4 (web round 2): a Menu, so a footer Cancel and no title-row ×.
export const OVERFLOW_TITLE = 'More plan actions';
export const OVERFLOW_HANDOFF_MS = 350;

export function overflowLabel(items) {
  return `${OVERFLOW_TITLE}: ${items.map((item) => item.label).join(', ')}`;
}

export default function PlanOverflowSheet({ isOpen, onClose, items }) {
  // Review LOW: the queued hand-off is cancelled when the screen goes away
  // (no late action, e.g. a copy POST after leaving).
  const handoff = useRef(null);
  useEffect(() => () => clearTimeout(handoff.current), []);
  return (
    <AppModal
      testID="plan-overflow-sheet"
      isOpen={isOpen}
      onClose={onClose}
      title={OVERFLOW_TITLE}
      size="md"
      footerDismiss
      footer={
        <ModalActions>
          <PillButton testID="plan-overflow-cancel" title="Cancel" variant="secondary" onPress={onClose} />
        </ModalActions>
      }
    >
      <View accessibilityRole="menu" style={styles.list}>
        {items.map((item) => {
          const inactive = item.disabled || item.loading;
          return (
            <Pressable
              key={item.key}
              testID={item.testID}
              accessibilityRole="menuitem"
              accessibilityState={{ disabled: inactive, busy: Boolean(item.loading) }}
              disabled={inactive}
              onPress={() => {
                onClose();
                // iOS can't present the next dialog while this sheet is still
                // dismissing, so the action runs once the sheet has gone.
                clearTimeout(handoff.current);
                handoff.current = setTimeout(item.onPress, OVERFLOW_HANDOFF_MS);
              }}
              style={[styles.row, inactive && styles.inactive]}
            >
              {({ pressed }) => (
                <>
                  {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
                  {item.loading ? (
                    <Spinner size={16} thickness={2} color={colors.textPrimary} reducedMotionLoopMs={motion.spinnerReducedLoopMs} />
                  ) : null}
                  <Text {...CAP_BODY} style={[styles.label, item.tone === 'danger' && styles.danger]}>
                    {item.label}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
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
  inactive: {
    opacity: 0.5,
  },
  label: {
    ...font(600),
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  danger: {
    color: colors.dangerText,
  },
});
