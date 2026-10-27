import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';

import { getStatus } from '../../shared/api/apiError';
import AppModal, { ModalActions, isTabletWidth } from '../../shared/components/AppModal';
import ErrorAlert from '../../shared/components/ErrorAlert';
import FormField from '../../shared/components/FormField';
import PillButton from '../../shared/components/PillButton';
import Spinner from '../../shared/components/Spinner';
import { CAP_BODY } from '../../shared/components/largeText';
import { colors, font, radii, spacing, typography } from '../../shared/theme/tokens';
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
  const tablet = isTabletWidth(useWindowDimensions().width);
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
  // UX K Delete account: phone 14/20 copy and a well-backed bullet list;
  // tablet 16/24 intro, a plain 15/24 list and 15/22 lines.
  const secondary = [styles.secondary, tablet && styles.secondaryTablet];

  return (
    <AppModal
      testID="delete-account-dialog"
      isOpen={isOpen}
      onClose={close}
      title="Delete your account?"
      size="lg"
      // UX K Tablet: Delete account draws no Close: Cancel is the exit
      // (blocked while sending, as before). Phones never had one.
      hideClose
      footer={
        deleted ? null : (
          <ModalActions fill>
            <PillButton testID="delete-account-cancel" title="Cancel" variant="secondary" size={tablet ? 'cta' : 'default'} disabled={sending} onPress={close} />
            <PillButton
              testID="delete-account-submit"
              size="cta"
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
          <Text {...CAP_BODY} style={styles.deletedText}>
            Account deleted. Signing you out…
          </Text>
        </View>
      ) : (
        <View style={styles.body} accessibilityState={{ busy: sending }}>
          <View style={styles.textBlock}>
            {profileLess ? (
              <Text {...CAP_BODY} style={secondary}>
                {'This permanently deletes your Gymido account and your sign-in. '}
                {undone}
              </Text>
            ) : (
              <>
                <Text {...CAP_BODY} style={secondary}>
                  This permanently deletes your Gymido account and everything in it:
                </Text>
                <View testID="delete-account-bullets" style={tablet ? styles.listTablet : styles.list}>
                  {(isTrainer ? [...BULLETS, TRAINER_BULLET] : BULLETS).map((item) => (
                    <View key={item} style={styles.bulletRow}>
                      <View
                        style={[styles.dot, tablet && styles.dotTablet]}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      />
                      <Text {...CAP_BODY} style={[styles.bulletText, tablet && styles.bulletTextTablet]}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {googleOnly ? (
              <Text {...CAP_BODY} style={[secondary, tablet && styles.lineTablet]}>
                Your Google account itself isn't affected.
              </Text>
            ) : null}
            {profileLess ? null : (
              <Text {...CAP_BODY} style={[secondary, tablet && styles.lineTablet]}>
                {'Plans your trainer made stay with your trainer. '}
                {undone}
              </Text>
            )}
          </View>
          <FormField
            testID="delete-account-confirm"
            label="Type DELETE to confirm"
            labelStyle={[styles.fieldLabel, tablet && styles.fieldLabelTablet]}
            variant="well"
            style={tablet ? styles.confirmInputTablet : styles.confirmInput}
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
    gap: spacing[4],
  },
  textBlock: {
    gap: spacing[3],
  },
  // Intro / lines 14/20 text-secondary (tablet intro 16/24).
  secondary: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  secondaryTablet: {
    ...typography.bodyLg,
  },
  lineTablet: {
    ...typography.body,
  },
  undone: {
    ...font(600),
    color: colors.dangerText,
  },
  // Phone: the bullets sit in a fill-subtle well (padding 14 16, radius 20,
  // gap 8); tablet: a plain list.
  list: {
    gap: spacing[2],
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: colors.fillWell,
  },
  listTablet: {
    gap: spacing[1],
    paddingLeft: spacing[2],
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2_5'],
  },
  // 6 × 6 text-muted dots (mt 7 centres them on the 20 line).
  dot: {
    width: 6,
    height: 6,
    marginTop: 7,
    borderRadius: radii.full,
    backgroundColor: colors.textMuted,
  },
  dotTablet: {
    marginTop: 9,
  },
  bulletText: {
    ...typography.bodySm,
    flex: 1,
    color: colors.textPrimary,
  },
  bulletTextTablet: {
    ...typography.body,
    lineHeight: 24,
    color: colors.textStrong2,
  },
  fieldLabel: {
    ...typography.label,
    ...font(600),
    color: colors.textStrong2,
  },
  fieldLabelTablet: {
    ...typography.bodySm,
    ...font(600),
  },
  // Phone: 52 (inside the 1 px edge), 16/600, tracked 0.12em, on surface-well.
  confirmInput: {
    ...font(600),
    minHeight: 50,
    paddingVertical: 0,
    paddingHorizontal: spacing[4],
    fontSize: 16,
    letterSpacing: 1.92,
    color: colors.textPrimary,
  },
  // Tablet: 58 tall, 18/700, tracked 0.12em.
  confirmInputTablet: {
    ...font(700),
    minHeight: 56,
    paddingVertical: 0,
    paddingHorizontal: spacing[4],
    fontSize: 18,
    letterSpacing: 2.16,
    color: colors.textPrimary,
  },
  deletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  deletedText: {
    ...typography.bodySm,
    ...font(600),
    flexShrink: 1,
    color: colors.textPrimary,
  },
});
