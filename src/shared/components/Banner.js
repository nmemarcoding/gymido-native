import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radii, spacing } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';

// RN-SPEC-v2-foundation §5 Banners (OnHoldBox, the inactive-plan banner):
// warning fill 0.08 + border 0.28, radius 16, title 15/600, body 13
// secondary. `warningTitle` draws the title in warning with its icon (the
// inactive banner). Copy comes from the caller, unchanged from v1.
export default function Banner({ title, warningTitle = false, children, testID, accessibilityRole = 'summary', accessibilityLiveRegion, style }) {
  return (
    <View testID={testID} accessibilityRole={accessibilityRole} accessibilityLiveRegion={accessibilityLiveRegion} style={[styles.box, style]}>
      <View style={styles.titleRow}>
        {warningTitle ? <FeedbackIcon testID={testID ? `${testID}-icon` : undefined} name="warning" size={16} color={colors.warning} /> : null}
        <Text style={[styles.title, warningTitle && styles.titleWarning]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function BannerText({ children }) {
  return <Text style={styles.body}>{children}</Text>;
}

export const bannerStyles = StyleSheet.create({
  box: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningFill,
    padding: spacing[4],
    gap: spacing[1],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
  },
  title: {
    ...font(600),
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  titleWarning: {
    color: colors.warning,
  },
  body: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});

const styles = bannerStyles;
