import { StyleSheet, Text, View } from 'react-native';

import GradientFill from '../../../shared/components/GradientFill';
import { CAP_BODY, CAP_PILL, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';
import RemoteImage from '../../../shared/components/RemoteImage';
import { colors, font, gradients, radii, spacing, textScale } from '../../../shared/theme/tokens';
import { planPhotoUrl } from '../libraryFormat';
import { imageCandidates } from '../planImages';
import { useReflow } from './planUi';

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };
// glow-gold-ambient (0.18) as a 340 circle, top-right of the tablet hero.
const HERO_GLOW = Object.freeze({ radial: Object.freeze({ cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5 }), colors: gradients.accountGlow.colors, stops: Object.freeze([0, 1]) });

// UX H Plan detail (phone): eyebrow, the 38/40 name, the description (3
// lines), the 3 stat tiles and the "{d}× / week" pill.
export function PlanSummary({ plan, dayCount, totalExercises }) {
  return (
    <>
      <View testID="plan-summary" style={styles.summary}>
        <Text {...CAP_BODY} style={styles.eyebrow}>
          {plan?.category?.name || 'Workout plan'}
        </Text>
        <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={styles.name}>
          {plan?.name}
        </Text>
        {plan?.description ? (
          <Text {...CAP_BODY} numberOfLines={3} ellipsizeMode="tail" style={styles.description}>
            {plan.description}
          </Text>
        ) : null}
      </View>
      <StatRow plan={plan} dayCount={dayCount} totalExercises={totalExercises} />
      <View style={styles.pill}>
        <Text {...CAP_PILL} style={styles.pillText}>{`${dayCount}× / week`}</Text>
      </View>
    </>
  );
}

function statItems(plan, dayCount, totalExercises) {
  return [
    { key: 'days', value: String(dayCount), label: 'Days' },
    { key: 'exercises', value: String(totalExercises), label: 'Exercises' },
    { key: 'level', value: plan?.difficulty_level?.name || '—', label: 'Level', text: true },
  ];
}

// UX NATIVE-P4 N2: the stat-tile shrink floor.
export const STAT_VALUE_MIN_SCALE = 0.75;

// One line per word, at most 2: a single word is one line (adjustsFontSizeToFit
// shrinks it) so iOS never char-wraps it ("Intermediat/e").
export function statValueLines(value) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.min(Math.max(words, 1), 2);
}

// 3 tiles (radius 20, padding 12): value 22/26/700 + a 12 muted label; the
// Level value 16/26. Past 1.3× text: stacked label → value rows (§9 rule 4).
function StatRow({ plan, dayCount, totalExercises, hero = false }) {
  const reflow = useReflow();
  const items = statItems(plan, dayCount, totalExercises);
  if (reflow) {
    return (
      <View testID="plan-stats-stacked" style={[styles.stackedStats, hero && styles.heroStacked]}>
        {items.map((item) => (
          <View key={item.key} testID={`plan-stat-${item.key}`} style={styles.stackedRow}>
            <Text {...CAP_BODY} style={hero ? styles.heroStatLabel : styles.statLabel}>
              {item.label}
            </Text>
            <Text maxFontSizeMultiplier={textScale.title} style={[styles.stackedValue, styles.tabular]}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View testID="plan-stats" style={[styles.stats, hero && styles.heroStats]}>
      {items.map((item) => (
        <View key={item.key} testID={`plan-stat-${item.key}`} style={[styles.statTile, hero && styles.heroStatTile]}>
          <Text
            maxFontSizeMultiplier={hero ? textScale.display : textScale.title}
            // UX NATIVE-P4 N2: wrap at words only. A line per word (max 2),
            // so one word that doesn't fit shrinks (0.75) and never splits.
            numberOfLines={statValueLines(item.value)}
            adjustsFontSizeToFit
            minimumFontScale={STAT_VALUE_MIN_SCALE}
            textBreakStrategy="simple"
            style={[
              hero ? (item.text ? styles.heroLevelValue : styles.heroStatValue) : item.text ? styles.levelValue : styles.statValue,
              styles.tabular,
            ]}
          >
            {item.value}
          </Text>
          <Text {...CAP_BODY} style={hero ? styles.heroStatLabel : styles.statLabel}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// UX H Tablet: Plan detail hero: radius 36, min 340, padding 32; the plan
// photo (N3: the first exercise's photo, opacity 0.5 under the photo fade)
// or gradient-card, the ambient gold glow, content at the bottom.
export function PlanHero({ plan, dayCount, totalExercises }) {
  // Review M4: the v2 chain (no uc link; none → the gradient card at once).
  const photoSources = imageCandidates(planPhotoUrl(plan));
  const photo = photoSources.length > 0;
  return (
    <View testID="plan-hero" style={styles.hero}>
      <View {...HIDDEN} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
        {photo ? (
          <>
            <RemoteImage url={planPhotoUrl(plan)} sources={photoSources} style={[StyleSheet.absoluteFill, styles.heroPhoto]} />
            <GradientFill angle={gradients.photoFade.angle} colors={gradients.photoFade.colors} />
          </>
        ) : null}
        <View testID="plan-hero-glow" style={styles.heroGlow}>
          <GradientFill radial={HERO_GLOW.radial} colors={HERO_GLOW.colors} stops={HERO_GLOW.stops} />
        </View>
      </View>
      <View style={styles.heroContent}>
        <View>
          <Text {...CAP_BODY} style={styles.heroEyebrow}>
            {plan?.category?.name || 'Workout plan'}
          </Text>
          <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={styles.heroName}>
            {plan?.name}
          </Text>
          {plan?.description ? (
            <Text {...CAP_BODY} numberOfLines={3} ellipsizeMode="tail" style={styles.heroDescription}>
              {plan.description}
            </Text>
          ) : null}
          <View style={styles.heroPill}>
            <Text {...CAP_PILL} style={styles.heroPillText}>{`${dayCount}× / week`}</Text>
          </View>
        </View>
        <StatRow plan={plan} dayCount={dayCount} totalExercises={totalExercises} hero />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    paddingTop: spacing[2],
    paddingHorizontal: spacing[1],
    paddingBottom: spacing[1],
  },
  eyebrow: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
  },
  // 38/40/700 −0.045em (no type token, as drawn).
  name: {
    ...font(700),
    marginTop: spacing[2],
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.71,
    color: colors.textPrimary,
  },
  description: {
    ...font(400),
    marginTop: spacing[2],
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  statValue: {
    ...font(700),
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.66,
    color: colors.textPrimary,
  },
  levelValue: {
    ...font(700),
    fontSize: 16,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  stackedStats: {
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  stackedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: spacing[3],
  },
  stackedValue: {
    ...font(700),
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  // 28 tall, pad 0 12, fill 0.07, 13/600 secondary.
  pill: {
    alignSelf: 'flex-start',
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    backgroundColor: colors.fillSkeleton,
  },
  pillText: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  hero: {
    minHeight: 340,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: spacing[8],
    borderRadius: radii.xxxxl,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  heroPhoto: {
    opacity: 0.5,
  },
  heroGlow: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 340,
    height: 340,
  },
  heroContent: {
    gap: spacing['5_5'],
  },
  heroEyebrow: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  // 60/58/700 −0.055em (as drawn).
  heroName: {
    ...font(700),
    marginTop: spacing[2],
    fontSize: 60,
    lineHeight: 62,
    letterSpacing: -3.3,
    color: colors.textPrimary,
  },
  heroDescription: {
    ...font(400),
    maxWidth: 520,
    marginTop: spacing[3],
    fontSize: 17,
    lineHeight: 25,
    color: colors.textStrong2,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    justifyContent: 'center',
    marginTop: spacing['3_5'],
    paddingHorizontal: spacing['3_5'],
    borderRadius: radii.full,
    backgroundColor: colors.hairlineButton,
  },
  heroPillText: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  heroStats: {
    gap: spacing['2_5'],
  },
  // radius 22, on-photo fill (0.5 folds into 0.55), hairline-strong, pad 14 16.
  heroStatTile: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
    borderRadius: radii.lgPlus,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.onPhoto,
  },
  heroStacked: {
    borderRadius: radii.lgPlus,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.onPhoto,
  },
  heroStatValue: {
    ...font(700),
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -2,
    color: colors.textPrimary,
  },
  heroLevelValue: {
    ...font(700),
    fontSize: 22,
    lineHeight: 42,
    color: colors.textPrimary,
  },
  heroStatLabel: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
