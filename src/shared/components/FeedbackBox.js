import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { colors, font, radii, spacing } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';
import { CAP_BODY } from './largeText';

// RN-SPEC-v2-foundation §5 FeedbackBox / ErrorBox (native inline result):
// radius 16, padding 12 14, the tone's fill + border at 0.25, always an icon,
// a bold title over the muted message.
export const FEEDBACK_TONES = Object.freeze({
  error: Object.freeze({ icon: 'error', iconColor: colors.dangerText, backgroundColor: colors.dangerTextFill, borderColor: colors.dangerTextBorder }),
  success: Object.freeze({ icon: 'check', iconColor: colors.success, backgroundColor: colors.successFeedbackFill, borderColor: colors.successFeedbackBorder }),
});

export function FeedbackBox({ tone, title, message, testID, accessibilityRole, accessibilityLiveRegion, titleStyle, messageStyle, ref }) {
  const look = FEEDBACK_TONES[tone] ?? FEEDBACK_TONES.error;
  return (
    <View
      ref={ref}
      testID={testID}
      accessibilityRole={accessibilityRole ?? (tone === 'success' ? 'summary' : 'alert')}
      accessibilityLiveRegion={accessibilityLiveRegion}
      style={[styles.box, { borderColor: look.borderColor, backgroundColor: look.backgroundColor }]}
    >
      <View style={styles.icon}>
        <FeedbackIcon name={look.icon} size={18} color={look.iconColor} />
      </View>
      <View style={styles.text}>
        {title ? <Text {...CAP_BODY} style={[styles.title, titleStyle]}>{title}</Text> : null}
        {message ? <Text {...CAP_BODY} style={[styles.message, messageStyle]}>{message}</Text> : null}
      </View>
    </View>
  );
}

// InlineError and SuccessState (profile-create spec §6): a title (600) and
// the message under it.
// InlineError (RN-SPEC-v2-phase2 §D1): the title in colors.dangerText and the
// message in textSecondary; role alert, announced when it mounts (and when
// its text changes), assertive on Android.
export function InlineError({ title = 'Something went wrong', message, testID, ref }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility([title, message].filter(Boolean).join('. '));
  }, [title, message]);
  return (
    <FeedbackBox
      ref={ref}
      tone="error"
      title={title}
      message={message}
      testID={testID}
      accessibilityLiveRegion="assertive"
      titleStyle={styles.inlineErrorTitle}
      messageStyle={styles.inlineErrorMessage}
    />
  );
}

export function SuccessState({ title = 'Success', message, testID }) {
  return <FeedbackBox tone="success" title={title} message={message} testID={testID} />;
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2_5'],
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing['3_5'],
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  inlineErrorTitle: {
    color: colors.dangerText,
  },
  inlineErrorMessage: {
    color: colors.textSecondary,
  },
  message: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
