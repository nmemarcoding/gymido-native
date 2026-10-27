import { StyleSheet, Text } from 'react-native';

import { typography } from '../theme/tokens';
import { CAP_BODY, TITLE_TEXT } from './largeText';

// UX §9: Eyebrow and Body are text people read (2.0× cap); Heading follows
// the title rule (1.6× cap, word wrap, max 3 lines, a long word shrinks).

export function Eyebrow({ children, style }) {
  return <Text {...CAP_BODY} textBreakStrategy="simple" style={[styles.eyebrow, style]}>{children}</Text>;
}

export function Heading({ children, style }) {
  return (
    <Text {...TITLE_TEXT} accessibilityRole="header" style={[styles.heading, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style }) {
  return <Text {...CAP_BODY} style={[styles.body, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  eyebrow: typography.eyebrow,
  heading: typography.heading,
  body: typography.bodyText,
});
