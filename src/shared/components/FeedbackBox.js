import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radii, spacing } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';

// RN-SPEC-v2-foundation §5 FeedbackBox / ErrorBox (native inline result):
// radius 16, padding 12 14, the tone's fill + border at 0.25, always an icon,
// a bold title over the muted message.
export const FEEDBACK_TONES = Object.freeze({
  error: Object.freeze({ icon: 'error', iconColor: colors.dangerText, backgroundColor: colors.dangerTextFill, borderColor: colors.dangerTextBorder }),
  success: Object.freeze({ icon: 'check', iconColor: colors.success, backgroundColor: colors.successFeedbackFill, borderColor: colors.successFeedbackBorder }),
});

export function FeedbackBox({ tone, title, message, testID, accessibilityRole }) {
  const look = FEEDBACK_TONES[tone] ?? FEEDBACK_TONES.error;
  return (
    <View
      testID={testID}
      accessibilityRole={accessibilityRole ?? (tone === 'success' ? 'summary' : 'alert')}
      style={[styles.box, { borderColor: look.borderColor, backgroundColor: look.backgroundColor }]}
    >
      <View style={styles.icon}>
        <FeedbackIcon name={look.icon} size={18} color={look.iconColor} />
      </View>
      <View style={styles.text}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

// InlineError and SuccessState (profile-create spec §6): a title (600) and
// the message under it.
export function InlineError({ title = 'Something went wrong', message, testID }) {
  return <FeedbackBox tone="error" title={title} message={message} testID={testID} />;
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
  message: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
