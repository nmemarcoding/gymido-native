import { StyleSheet, Text, View } from 'react-native';

import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';
import TextLink from '../../../shared/components/TextLink';
import { colors, font, spacing, typography } from '../../../shared/theme/tokens';
import { HeroTitleMark } from '../../shell/heroTitle';

// v2 Phase 5 L shared page parts for the coaching pages (Find a trainer,
// Trainer detail, Trainer apply).

// §3 "One back-link rule": "← {parent}", 14/600 gold, 44 hit, 8 above the
// heading; the arrow is decorative (the link's name is just the parent).
export function PageBackLink({ label, onPress, testID }) {
  return (
    <View style={styles.back}>
      <TextLink testID={testID} label={`← ${label}`} accessibilityLabel={label} onPress={onPress} />
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

// Phone: Trainers "display-md" 44/44 −0.05em; Apply 48/48 −0.055em (no token
// at 48: font() + the drawn size). Tablet: Trainers 60/60 −0.06em.
const PHONE_SIZES = {
  list: { title: typography.displayMd, subtitle: { marginTop: spacing['1_5'], fontSize: 15, lineHeight: 22 } },
  apply: {
    title: { ...font(700), fontSize: 48, lineHeight: 48, letterSpacing: -2.64 },
    subtitle: { marginTop: spacing['1_5'], fontSize: 15, lineHeight: 22 },
  },
};
const TABLET_SIZES = {
  list: {
    title: { ...font(700), fontSize: 60, lineHeight: 60, letterSpacing: -3.6 },
    subtitle: { marginTop: spacing['2_5'], fontSize: 17, lineHeight: 26 },
  },
  apply: PHONE_SIZES.apply,
};

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    marginBottom: spacing[2] - spacing['3_5'],
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
