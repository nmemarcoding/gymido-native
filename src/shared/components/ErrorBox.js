import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/tokens';

export default function ErrorBox({ title, message }) {
  return (
    <View accessibilityRole="alert" style={styles.box}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.errorFill,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.errorText,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.errorText,
  },
});
