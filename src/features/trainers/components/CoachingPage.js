import { StyleSheet, Text, View } from 'react-native';

import BackPill from '../../../shared/components/BackPill';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';
import { colors, font, spacing, titleTracking, typography } from '../../../shared/theme/tokens';
import { HeroTitleMark } from '../../shell/heroTitle';

// v2 Phase 5 L shared page parts for the coaching pages (Find a trainer,
// Trainer detail, Trainer apply).

// §3 "One back-link rule": the parent ABOVE the heading, 8 above it; the
// link's name is just the parent. UX native final audit 27 Oct 2026, ruling 6
// (C307): native draws the boards' glass pill "‹ {parent}" (kit BackPill,
// 44 phone / 40 tablet), not the gold text link (R1 was web 834 only).
export function PageBackLink({ label, onPress, testID }) {
  return (
    <View style={styles.back}>
      <BackPill testID={testID} label={label} onPress={onPress} />
    </View>
  );
}

// The page heading (`accessibilityRole="header"`): the page's one title; the
// shell header shows none here (UX final audit X1). Phone and tablet sizes as the boards
// draw them; `accent` paints the last word gold ("Become a trainer").
export function PageHeading({ title, accent, subtitle, tablet = false, size = 'list', testID }) {
  const look = tablet ? TABLET_SIZES[size] : PHONE_SIZES[size];
  return (
    <View testID={testID} style={styles.heading}>
      <HeroTitleMark />
      <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={[styles.title, look.title]}>
        {title}
        {accent ? <Text style={styles.accent}>{` ${accent}`}</Text> : null}
      </Text>
      {subtitle ? (
        <Text {...CAP_BODY} style={[styles.subtitle, look.subtitle]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// Phone: Trainers "display-md" 44/44; Apply 48/48 (no token at 48: font() +
// the drawn size). Tablet: Trainers 60/60. The boards draw −0.05 / −0.055 /
// −0.06em; ruling 5 (UX native final audit 27 Oct 2026) holds every title at
// −0.04em (titleTracking clamps).
const PHONE_SIZES = {
  list: { title: typography.displayMd, subtitle: { marginTop: spacing['1_5'], fontSize: 15, lineHeight: 22 } },
  apply: {
    title: { ...font(700), fontSize: 48, lineHeight: 48, letterSpacing: titleTracking(48, -0.055) },
    subtitle: { marginTop: spacing['1_5'], fontSize: 15, lineHeight: 22 },
  },
};
const TABLET_SIZES = {
  list: {
    title: { ...font(700), fontSize: 60, lineHeight: 60, letterSpacing: titleTracking(60, -0.06) },
    subtitle: { marginTop: spacing['2_5'], fontSize: 17, lineHeight: 26 },
  },
  apply: PHONE_SIZES.apply,
};

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    marginBottom: spacing[2],
  },
  heading: {
    paddingHorizontal: spacing[1],
  },
  title: {
    color: colors.textPrimary,
  },
  accent: {
    color: colors.gold,
  },
  subtitle: {
    ...font(400),
    color: colors.textSecondary,
  },
});
