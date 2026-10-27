import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, findNodeHandle } from 'react-native';

import { getStatus } from '../../shared/api/apiError';
import AppModal, { ModalActions } from '../../shared/components/AppModal';
import ErrorAlert from '../../shared/components/ErrorAlert';
import FormField from '../../shared/components/FormField';
import PillButton from '../../shared/components/PillButton';
import Spinner from '../../shared/components/Spinner';
import { colors } from '../../shared/theme/tokens';
import { deleteAccount } from './api/profileApi';

export const DeletePhase = Object.freeze({ idle: 'idle', sending: 'sending', error: 'error', deleted: 'deleted' });

const NO_AUTOFILL = { autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no' };

// P1b.3: the trimmed field equals DELETE, any case ("  delete " matches).
export function matchesDeleteConfirm(text) {
  return String(text ?? '').trim().toUpperCase() === 'DELETE';
}

// P1b.5 error text. The network copy only when the request got no HTTP
// response (offline, blocked, timeout). A failed token fetch is not network:
// the web sends the call without auth and handles the 401, so it reads
// "Please try again." (FE ac21d959).
export function deleteAccountErrorMessage(error) {
  if (!error?.response) {
    return error?.isAxiosError ? 'Check your connection and try again.' : 'Please try again.';
  }
  if (getStatus(error) >= 500) {
    return 'Please try again.';
  }
  const message = error.response.data?.message;
  return typeof message === 'string' && message.trim().length > 0 ? message : 'Please try again.';
}

const BULLETS = [
  'Your workout history and personal records',
  'Your weight log and body measurements',
  'Your profile',
  'Plans you made and your plan-generator answers',
  'Your link to your trainer',
];
const TRAINER_BULLET = "Your clients will be disconnected from you. Plans they're using, and their history, stay with them.";

// RN-SPEC-profile P1b.3–P1b.6 (T-43): the type-DELETE dialog. `profileLess`
// is the Create-profile variant (P1b.4). `onDeleted` runs right after a 200.
export default function DeleteAccountDialog({ isOpen, onClose, onDeleted, profileLess = false, isTrainer = false, googleOnly = false }) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState(DeletePhase.idle);
  const [errorMessage, setErrorMessage] = useState('');
  // One request only: presses while sending (button or Return) are ignored.
  const busy = useRef(false);
  const alertRef = useRef(null);

  // Every opening starts empty (field, error, state).
  useEffect(() => {
    if (isOpen) {
      setText('');
      setPhase(DeletePhase.idle);
      setErrorMessage('');
      busy.current = false;
    }
  }, [isOpen]);

  // P1b.5 error: the alert takes focus.
  useEffect(() => {
    if (phase !== DeletePhase.error) {
      return undefined;
    }
    const timer = setTimeout(() => {
      const node = alertRef.current ? findNodeHandle(alertRef.current) : null;
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [phase]);

  const sending = phase === DeletePhase.sending;
  const deleted = phase === DeletePhase.deleted;
  const matches = matchesDeleteConfirm(text);

  // Close is blocked while sending and after the delete.
  const close = () => {
    if (!busy.current && !deleted) {
      onClose();
    }
  };

  async function submit() {
    if (busy.current || !matches) {
      return;
    }
    busy.current = true;
    setErrorMessage('');
    setPhase(DeletePhase.sending);
    try {
      await deleteAccount();
    } catch (error) {
      setErrorMessage(deleteAccountErrorMessage(error));
      setPhase(DeletePhase.error);
      busy.current = false;
      return;
    }
    // P1b.6: no extra tap; `busy` stays set so nothing can send again.
    setPhase(DeletePhase.deleted);
    onDeleted();
  }

  const undone = <Text style={styles.undone}>This can't be undone.</Text>;

  return (
    <AppModal
      testID="delete-account-dialog"
      isOpen={isOpen}
      onClose={close}
      title="Delete your account?"
      size="lg"
      hideClose={sending || deleted}
      footer={
        deleted ? null : (
          <ModalActions>
            <PillButton testID="delete-account-cancel" title="Cancel" variant="secondary" disabled={sending} onPress={close} />
            <PillButton
              testID="delete-account-submit"
              title={sending ? 'Deleting…' : 'Delete account'}
              variant="danger"
              loading={sending}
              disabled={!matches}
              onPress={submit}
            />
          </ModalActions>
        )
      }
    >
      {deleted ? (
        <View testID="delete-account-deleted" role="status" accessibilityLiveRegion="polite" style={styles.deletedRow}>
          <Spinner size={16} thickness={2} />
          <Text style={styles.deletedText}>Account deleted. Signing you out…</Text>
        </View>
      ) : (
        <View style={styles.body} accessibilityState={{ busy: sending }}>
          <View style={styles.textBlock}>
            {profileLess ? (
              <Text style={styles.secondary}>
                {'This permanently deletes your Gymido account and your sign-in. '}
                {undone}
              </Text>
            ) : (
              <>
                <Text style={styles.secondary}>This permanently deletes your Gymido account and everything in it:</Text>
                <View style={styles.list}>
                  {(isTrainer ? [...BULLETS, TRAINER_BULLET] : BULLETS).map((item) => (
                    <View key={item} style={styles.bulletRow}>
                      <Text style={styles.bullet} accessibilityElementsHidden importantForAccessibility="no">
                        •
                      </Text>
                      <Text style={styles.bulletText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {googleOnly ? <Text style={styles.secondary}>Your Google account itself isn't affected.</Text> : null}
            {profileLess ? null : (
              <Text style={styles.secondary}>
                {'Plans your trainer made stay with your trainer. '}
                {undone}
              </Text>
            )}
          </View>
          <FormField
            testID="delete-account-confirm"
            label="Type DELETE to confirm"
            value={text}
            onChangeText={setText}
            readOnly={sending}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={submit}
            {...NO_AUTOFILL}
          />
          {phase === DeletePhase.error ? (
            <View ref={alertRef} testID="delete-account-error" accessible>
              <ErrorAlert title="Couldn't delete your account" description={errorMessage} />
            </View>
          ) : null}
        </View>
      )}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 16,
  },
  textBlock: {
    gap: 8,
  },
  secondary: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  undone: {
    fontWeight: '600',
    color: colors.danger700,
  },
  // Disc list, padding-left 20: the 12pt marker column sits inside it.
  list: {
    paddingLeft: 8,
    gap: 4,
  },
  bulletRow: {
    flexDirection: 'row',
  },
  bullet: {
    width: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  deletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deletedText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
