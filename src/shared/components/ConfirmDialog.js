import AppModal, { ModalActions } from './AppModal';
import PillButton from './PillButton';

// Trainer plans spec §A3.2. `dismissible` false (B4: while a request runs)
// makes Cancel, the scrim and Android back do nothing.
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
