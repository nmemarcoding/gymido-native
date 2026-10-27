import AppModal, { ModalActions } from './AppModal';
import PillButton from './PillButton';

// Trainer plans spec §A3.2. `dismissible` false (B4: while a request runs)
// makes Cancel, the scrim and Android back do nothing. `boardClose` keeps
// the phone × beside Cancel where the board draws both (UX R2-2).
// `hideClose` (27 Oct 2026, UX R2-3): the boards draw no × at ANY width, so
// the tablet header Close goes too; Cancel / scrim / Back still close it.
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  dismissible = true,
  children,
  testID,
  // Optional explicit testIDs for the two buttons (default `${testID}-cancel`
  // and `${testID}-confirm`).
  cancelTestID,
  confirmTestID,
  entrance,
  compact,
  boardClose = false,
  hideClose = false,
}) {
  const close = () => {
    if (dismissible) {
      onClose();
    }
  };

  return (
    <AppModal
      testID={testID}
      isOpen={isOpen}
      onClose={close}
      title={title}
      description={description}
      size="md"
      entrance={entrance}
      compact={compact}
      // FINAL-AUDIT batch 1 (5): the footer has the dismiss, so no phone ×.
      footerDismiss={!boardClose}
      hideClose={hideClose}
      footer={
        <ModalActions>
          <PillButton testID={cancelTestID ?? (testID ? `${testID}-cancel` : undefined)} title={cancelLabel} variant="secondary" onPress={close} />
          <PillButton
            testID={confirmTestID ?? (testID ? `${testID}-confirm` : undefined)}
            title={confirmLabel}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            onPress={onConfirm}
          />
        </ModalActions>
      }
    >
      {children}
    </AppModal>
  );
}
