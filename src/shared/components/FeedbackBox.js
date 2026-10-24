import { StyleSheet, Text, View } from 'react-native';

import { radii } from '../theme/tokens';

const TONES = {
  error: { borderColor: 'rgba(239, 68, 68, 0.30)', backgroundColor: '#fef2f2', color: '#c10007' },
  success: { borderColor: 'rgba(34, 197, 94, 0.30)', backgroundColor: '#f0fdf4', color: '#008236' },
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
    borderRadius: radii.xxl,
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
