import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppModal, { ModalActions } from '../../../../shared/components/AppModal';
import FeedbackIcon from '../../../../shared/components/FeedbackIcon';
import { CAP_BODY } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import { useSheetFocus } from '../../../../shared/hooks/useSheetFocus';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';
import { PlanAction, getActionCopy } from '../planActions';
import { AffectsNoticeLine } from './AffectedClients';
import { useBuilderLayout } from './builderParts';

export { PlanAction };

// E5 (spec §B4): the one confirm of the builder's six actions. v2 look (UX
// phase4 I §10-13): danger tone = the solid danger action, brand tone (the
// two deactivates) = gold. Phone: the action (60) above Cancel (52); tablet:
// Cancel left, the action right, both 60. Screen-reader focus starts on
// Cancel (the safe choice). While the request runs, Cancel, the scrim and
// Android back do nothing; a failure shows the error box and confirming
// retries.
export default function PlanActionDialog({ action, text, affectedCount, onClose, onConfirm }) {
  const { tablet } = useBuilderLayout();
  const copy = getActionCopy(action ?? {}, text);
  const running = Boolean(action?.running);
  const open = Boolean(action);
  const cancelRef = useRef(null);
  useSheetFocus(open, { initialRef: cancelRef });

  const close = () => {
    if (!running) {
      onClose();
    }
  };

  return (
    <AppModal
      testID="plan-action-dialog"
      // Review M2 (a11y ruling 27 Oct): an ALERT dialog. Needs the shared
      // AppModal `role` prop (default 'none'), listed for the lead.
      role="alertdialog"
      isOpen={open}
      onClose={close}
      title={copy.title}
      description={copy.description}
      size="md"
      // FINAL-AUDIT batch 1 (5): the footer has the dismiss, so no phone ×.
      footerDismiss
      footer={
        <ModalActions fill>
          <PillButton
            ref={cancelRef}
            testID="plan-action-dialog-cancel"
            title="Cancel"
            variant="secondary"
            size={tablet ? 'cta' : 'default'}
            onPress={close}
          />
          <PillButton
            testID="plan-action-dialog-confirm"
            title={copy.confirmLabel}
            variant={copy.tone === 'danger' ? 'danger' : 'primary'}
            size="cta"
            loading={running}
            onPress={onConfirm}
          />
        </ModalActions>
      }
    >
      <AffectsNoticeLine count={affectedCount} />
      {action?.type === PlanAction.deactivateRefused && action.refusedMessage ? (
        <Text {...CAP_BODY} testID="plan-action-refused" style={styles.refused}>
          {action.refusedMessage}
        </Text>
      ) : null}
      {action?.error ? <DialogErrorBox title={action.error.title} message={action.error.message} tablet={tablet} /> : null}
    </AppModal>
  );
}

// UX §0.4 dialog error box: phone = the 4 % well + hairline, a bold line
// and the server text; tablet = the danger 8 % tint + 30 % edge with the
// leading icon. An alert, announced when it appears.
export function DialogErrorBox({ title, message, tablet = false }) {
  return (
    <View
      testID="plan-action-error"
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.errorBox, tablet && styles.errorBoxTablet]}
    >
      {tablet ? <FeedbackIcon name="error" size={20} color={colors.dangerText} /> : null}
      <View style={styles.errorText}>
        <Text {...CAP_BODY} style={styles.errorTitle}>
          {title}
        </Text>
        {message ? (
          <Text {...CAP_BODY} style={[styles.errorMessage, tablet && styles.errorMessageTablet]}>
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  refused: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    gap: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.fillWell,
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
  },
  errorBoxTablet: {
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerFaint,
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    gap: spacing['0_5'],
  },
  errorTitle: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  errorMessage: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  errorMessageTablet: {
    color: colors.dangerText,
  },
});
