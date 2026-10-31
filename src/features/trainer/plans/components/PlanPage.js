import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../../../shared/theme/tokens';
import ShellPage from '../../../shell/ShellPage';
import { HeroTitleMark } from '../../../shell/heroTitle';
import { CAP_BODY } from '../../../../shared/components/largeText';

// Page column shared by T1, T2 and T3 inside the shell: centred, max-width,
// gap 20. `nestable` hosts a draggable list (T3's sortable exercises).
// `gap` overrides the 20 (the v2 builder draws 12 phone / 18 tablet); an
// undefined maxWidth keeps the 896 default.
export function PlanPage({ maxWidth = 896, gap, nestable = false, children, testID = 'app-root' }) {
  return (
    <ShellPage nestable={nestable} testID={testID}>
      <View style={[styles.column, { maxWidth }, gap !== undefined && { gap }]}>{children}</View>
    </ShellPage>
  );
}

// "← All plans" style text link.
export function TextLink({ label, onPress, testID, style }) {
  return (
    <Pressable testID={testID} accessibilityRole="link" onPress={onPress} hitSlop={8} style={style}>
      {({ pressed }) => <Text {...CAP_BODY} style={[styles.link, pressed && styles.linkPressed]}>{label}</Text>}
    </Pressable>
  );
}

export function PageEyebrow({ children }) {
  return <Text {...CAP_BODY} style={styles.eyebrow}>{children}</Text>;
}

export function PageTitle({ children, style }) {
  return (
    <>
      <HeroTitleMark />
      <Text {...CAP_BODY} textBreakStrategy="simple" accessibilityRole="header" style={[styles.title, style]}>
        {children}
      </Text>
    </>
  );
}

export function PageSubtitle({ children }) {
  return <Text {...CAP_BODY} style={styles.subtitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    alignSelf: 'center',
    gap: 20,
    paddingBottom: 24,
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
  linkPressed: {
    opacity: 0.7,
  },
  eyebrow: typography.eyebrow,
  title: {
    marginTop: 4,
    fontSize: 30,
    lineHeight: 37.5,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
