import { StyleSheet, Text } from 'react-native';

import { typography } from '../theme/tokens';

export function Eyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export function Heading({ children, style }) {
  return (
    <Text accessibilityRole="header" style={[styles.heading, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  eyebrow: typography.eyebrow,
  heading: typography.heading,
  body: typography.body,
});
