import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../theme/tokens';

const TONES = {
  error: { borderColor: colors.dangerBorder, backgroundColor: colors.errorFill, color: colors.errorText },
  success: { borderColor: colors.successBorder, backgroundColor: colors.successFill, color: colors.successText },
};

// InlineError and SuccessState (profile-create spec §6): a title (600) and
// the message under it.
function FeedbackBox({ tone, title, message, testID }) {
  const look = TONES[tone];
  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
      style={[styles.box, { borderColor: look.borderColor, backgroundColor: look.backgroundColor }]}
    >
      <Text style={[styles.title, { color: look.color }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: look.color }]}>{message}</Text> : null}
    </View>
  );
}

export function InlineError({ title = 'Something went wrong', message, testID }) {
  return <FeedbackBox tone="error" title={title} message={message} testID={testID} />;
}

export function SuccessState({ title = 'Success', message, testID }) {
  return <FeedbackBox tone="success" title={title} message={message} testID={testID} />;
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  message: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
  },
});
