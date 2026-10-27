import { StyleSheet, Text, View } from 'react-native';

import ConfirmDialog from '../../../../shared/components/ConfirmDialog';
import { colors, radii } from '../../../../shared/theme/tokens';
import { PlanAction, getActionCopy } from '../planActions';
import { AffectsNoticeLine } from './AffectedClients';

export { PlanAction };

// E5 (spec §B4). Can't be dismissed while its request runs.
export default function PlanActionDialog({ action, text, affectedCount, onClose, onConfirm }) {
  const copy = getActionCopy(action ?? {}, text);

  return (
    <ConfirmDialog
      testID="plan-action-dialog"
      isOpen={Boolean(action)}
      onClose={onClose}
      onConfirm={onConfirm}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      tone={copy.tone}
      loading={Boolean(action?.running)}
      dismissible={!action?.running}
    >
      <View style={styles.body}>
        <AffectsNoticeLine count={affectedCount} />
        {action?.type === PlanAction.deactivateRefused && action.refusedMessage ? (
          <Text style={styles.refused}>{action.refusedMessage}</Text>
        ) : null}
        {action?.error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorTitle}>{action.error.title}</Text>
            <Text style={styles.errorMessage}>{action.error.message}</Text>
          </View>
        ) : null}
      </View>
    </ConfirmDialog>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
  },
  refused: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  errorBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  errorTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  errorMessage: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
