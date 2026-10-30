import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme/tokens';
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
  // T-80 (opt-in; UX, web parity): the gold play tile above the title (phone
  // 56 r16 centred with a 20 glyph; tablet 72 r18 left with a 24 glyph).
  playTile = false,
  // T-82 b (opt-in, default false): Cancel is DRAWN disabled (PillButton
  // `disabled`: dimmed, accessibilityState disabled) while a request runs.
  // Pair it with `dismissible` false, which also blocks the scrim and back.
  cancelDisabled = false,
  // T-91 (opt-in): the confirm's PillButton variant, when it isn't the tone's
  // (End plan's "Go to workout" is glass).
  confirmVariant,
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
      tile={playTile ? renderPlayTile : undefined}
      footer={
        <ModalActions>
          <PillButton testID={cancelTestID ?? (testID ? `${testID}-cancel` : undefined)} title={cancelLabel} variant="secondary" disabled={cancelDisabled} onPress={close} />
          <PillButton
            testID={confirmTestID ?? (testID ? `${testID}-confirm` : undefined)}
            title={confirmLabel}
            variant={confirmVariant ?? (tone === 'danger' ? 'danger' : 'primary')}
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

function renderPlayTile({ tablet }) {
  const glyph = tablet ? 24 : 20;
  return (
    <View testID="confirm-play-tile" style={[tileStyles.tile, tablet ? tileStyles.tablet : tileStyles.phone]}>
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill={colors.gold}>
        <Path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
      </Svg>
    </View>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldTint,
  },
  phone: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  tablet: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
});
