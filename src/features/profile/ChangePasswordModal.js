import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';

import { getApiErrorMessage } from '../../shared/api/apiError';
import AppModal, { ModalActions, isTabletWidth } from '../../shared/components/AppModal';
import ErrorAlert from '../../shared/components/ErrorAlert';
import PillButton from '../../shared/components/PillButton';
import { CAP_BODY } from '../../shared/components/largeText';
import { colors, font, radii, spacing, typography } from '../../shared/theme/tokens';
import ProfileIcon from './ProfileIcon';
import { sendPasswordResetEmail } from './api/profileApi';
import { markResetEmailSent, resetCooldownLeftMs, resetCooldownSeconds } from './passwordReset';

// RN-SPEC-profile P1a (25 Oct 2026, T-32 H1): no in-app password form; the
// modal asks for an Auth0 reset email and then counts down the 60 s cooldown.
export default function ChangePasswordModal({ visible, onClose, email }) {
  const tablet = isTabletWidth(useWindowDimensions().width);
  const [now, setNow] = useState(() => Date.now());
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const doneRef = useRef(null);
  const errorRef = useRef(null);

  const seconds = resetCooldownSeconds(resetCooldownLeftMs(now));

  // Reopening inside the cooldown shows the sent state with the time left;
  // after it, idle.
  useEffect(() => {
    if (visible) {
      const openedAt = Date.now();
      setNow(openedAt);
      setSent(resetCooldownSeconds(resetCooldownLeftMs(openedAt)) > 0);
      setError(null);
    }
  }, [visible]);

  // Re-render on each whole second of the cooldown (the label isn't announced).
  useEffect(() => {
    if (!visible || seconds <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setNow(Date.now()), resetCooldownLeftMs(now) % 1000 || 1000);
    return () => clearTimeout(timer);
  }, [visible, now, seconds]);

  // Focus: "Done" after a success, the ErrorAlert after a failure.
  useEffect(() => {
    if (!focusTarget) {
      return undefined;
    }
    const timer = setTimeout(() => {
      const node = findNodeHandle((focusTarget.kind === 'done' ? doneRef : errorRef).current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [focusTarget]);

  // The modal can't be dismissed while the request is in flight.
  const handleClose = () => {
    if (sending) {
      return;
    }
    setError(null);
    onClose();
  };

  const handleSend = async () => {
    if (sending) {
      return;
    }
    // A re-send goes back to the idle layout while it runs (FE e7effd0a).
    setError(null);
    setSent(false);
    setSending(true);
    try {
      await sendPasswordResetEmail();
    } catch (requestError) {
      // 404 / 502 / 503 carry their server message; the 200 message is never shown.
      setError(getApiErrorMessage(requestError, 'Please try again.'));
      setSent(false);
      setSending(false);
      setFocusTarget({ kind: 'error' });
      return;
    }
    const sentAt = Date.now();
    markResetEmailSent(sentAt);
    setNow(sentAt);
    setSent(true);
    setSending(false);
    setFocusTarget({ kind: 'done' });
  };

  // Web's Modal (the same AppModal as the weight log): bottom sheet below
  // 640, black/70 scrim with blur, a divider above the footer (G-PF1).
  return (
    <AppModal
      testID="change-password-modal"
      isOpen={visible}
      onClose={handleClose}
      // RN-SPEC-v2-phase5 §2: Reset password 520 at ≥ 768 (the kit's md).
      size="md"
      // UX K: the Reset password boards draw no Close; Cancel / Done are the
      // exits (and the scrim / Back, still refused while sending).
      hideClose
      title="Change password"
      // FINAL-AUDIT batch 1 (5): the footer has the dismiss, so no phone ×.
      footerDismiss
      footer={
        // The kit dialog footer (§6): phone stacked with the verb on top; the
        // tablet row shares the width (the board's flex:1 pair) and stacks
        // past 1.3× text (§9 rule 4).
        <ModalActions fill>
          {sent
            ? [
                <PillButton
                  key="resend"
                  testID="change-password-resend"
                  title={seconds > 0 ? `Send again in ${seconds}s` : 'Send again'}
                  variant="secondary"
                  size={tablet ? 'cta' : 'default'}
                  disabled={seconds > 0}
                  onPress={handleSend}
                />,
                <PillButton key="done" ref={doneRef} testID="change-password-done" title="Done" size="cta" onPress={handleClose} />,
              ]
            : [
                <PillButton
                  key="cancel"
                  testID="change-password-cancel"
                  title="Cancel"
                  variant="secondary"
                  size={tablet ? 'cta' : 'default'}
                  disabled={sending}
                  onPress={handleClose}
                />,
                <PillButton key="submit" testID="change-password-submit" title="Send reset email" size="cta" loading={sending} onPress={handleSend} />,
              ]}
        </ModalActions>
      }
    >
      {sent ? (
        // UX K: the success block (success green by ruling, not the canvas
        // teal): tint fill, success-line edge, a 40 solid check disc.
        <View testID="change-password-sent" role="status" accessibilityLiveRegion="polite" style={styles.sent}>
          <View testID="change-password-sent-disc" style={styles.disc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ProfileIcon name="check" size={20} color={colors.onGold} />
          </View>
          <View style={styles.sentText}>
            <Text {...CAP_BODY} style={styles.sentTitle}>
              Email sent
            </Text>
            <Text {...CAP_BODY} style={[styles.sentBody, tablet && styles.sentBodyTablet]}>
              Check your inbox for the link. It can take a few minutes, so look in spam too.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.idle}>
          <Text {...CAP_BODY} testID="change-password-body" style={[styles.body, tablet && styles.bodyTablet]}>
            We'll email a link to <Text style={styles.email}>{email}</Text> so you can set a new password.
          </Text>
          {error ? (
            // A focusable wrapper; the alert inside keeps its alert role.
            <View ref={errorRef} testID="change-password-error" accessible>
              <ErrorAlert title="Could not send the email" description={error} />
            </View>
          ) : null}
        </View>
      )}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  idle: {
    gap: spacing[4],
  },
  // 15/22 text-secondary (tablet 16/24); the email 600 text-primary.
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  bodyTablet: {
    ...typography.bodyLg,
  },
  email: {
    ...font(600),
    color: colors.textPrimary,
  },
  // radius 24, padding 18, gap 14; success tint + success-line edge.
  sent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['3_5'],
    padding: spacing['4_5'],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.successLine,
    backgroundColor: colors.successTint,
  },
  disc: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  sentText: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  sentTitle: {
    ...typography.labelLg,
    color: colors.success,
  },
  sentBody: {
    ...typography.bodySm,
    color: colors.textStrong2,
  },
  sentBodyTablet: {
    ...typography.bodyLg,
    color: colors.textSecondary,
  },
});
