import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AppModal, { ModalActions } from '../../shared/components/AppModal';
import PillButton from '../../shared/components/PillButton';
import { CAP_BODY } from '../../shared/components/largeText';
import { colors, font, radii, spacing } from '../../shared/theme/tokens';
import { OVERFLOW_HANDOFF_MS } from '../trainer/plans/components/PlanOverflowSheet';
import { TrashIcon } from '../trainer/plans/components/pickerIcons';
import { DELETE_COPY } from './progressFormat';

// T-82 (UX T82-delete-workout-ux §1): the phone Menu of a Recent workouts row
// (the "More plan actions" pattern, PlanOverflowSheet): the kit sheet titled
// "Workout actions", one row "Delete workout" (danger text, trash glyph), a
// footer Cancel and no ×. The row closes the sheet, then runs `onDelete`
// once the sheet has gone (iOS can't present the confirm while it dismisses).
export default function WorkoutActionsSheet({ isOpen, onClose, onDelete }) {
  const handoff = useRef(null);
  useEffect(() => () => clearTimeout(handoff.current), []);
  return (
    <AppModal
      testID="workout-actions-sheet"
      isOpen={isOpen}
      onClose={onClose}
      title={DELETE_COPY.menuTitle}
      size="md"
      footerDismiss
      footer={
        <ModalActions>
          <PillButton testID="workout-actions-cancel" title="Cancel" variant="secondary" onPress={onClose} />
        </ModalActions>
      }
    >
      <View accessibilityRole="menu" style={styles.list}>
        <Pressable
          testID="workout-actions-delete"
          accessibilityRole="menuitem"
          accessibilityLabel={DELETE_COPY.menuItem}
          onPress={() => {
            onClose({ handoff: true });
            clearTimeout(handoff.current);
            handoff.current = setTimeout(onDelete, OVERFLOW_HANDOFF_MS);
          }}
          style={styles.row}
        >
          {({ pressed }) => (
            <>
              {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
              <TrashIcon color={colors.dangerText} size={20} />
              <Text {...CAP_BODY} style={styles.label}>
                {DELETE_COPY.menuItem}
              </Text>
            </>
          )}
        </Pressable>
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
  label: {
    ...font(600),
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
    color: colors.dangerText,
  },
});
