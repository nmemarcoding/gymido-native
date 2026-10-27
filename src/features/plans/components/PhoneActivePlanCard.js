import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import GradientFill from '../../../shared/components/GradientFill';
import { CAP_BODY, CAP_PILL, LINE_TEXT } from '../../../shared/components/largeText';
import RemoteImage from '../../../shared/components/RemoteImage';
import { keepUnitsTogether } from '../../../shared/format/counts';
import { imageSourceProps, mediaUrl } from '../../../shared/images/remoteImageSources';
import { colors, font, gradients, radii, spacing, textScale } from '../../../shared/theme/tokens';
import { weekDayLabel } from '../libraryFormat';
import PlanIcon from './planIcons';
import { PressOverlay } from './planUi';

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };
const PHOTO_HEIGHT = 150;
const GLOW_SIZE = 220;

// Dated change (27 Oct 2026, owner T-60; UX T60-plans-spec §2): the PHONE
// active plan card. A surface card with a gold 0.35 edge; a 150 photo header
// (the plan thumbnail = its first exercise's image, through the shared
// image chain) over the card gradient + gold glow, so a missing or failed
// photo is never an empty box; the "Your active plan" badge; the name (one
// line); the meta; "Your week"; the next workout row; Start + See full plan.
//   circles — weekCircles() (null → no week)
//   next    — { when, title, count, gold } (null → no row and no Start)
export default function PhoneActivePlanCard({ plan, meta, circles, next, compact = false, onStart, onView }) {
  const photo = imageSourceProps(mediaUrl(plan?.thumbnail));
  const [failedUrl, setFailedUrl] = useState(null);
  const showPhoto = Boolean(photo.url) && failedUrl !== photo.url;

  return (
    <View testID="plans-active-card" accessibilityLabel="Your active plan" style={styles.card}>
      <View testID="plans-active-photo" style={styles.photo}>
        {/* Always drawn (gradients are present from the first render): the
            photo covers it; a missing/failed photo leaves it showing. */}
        <View {...HIDDEN} testID="plans-active-photo-fallback" pointerEvents="none" style={StyleSheet.absoluteFill}>
          <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
          <View style={styles.glow}>
            <GradientFill radial={gradients.heroGlow.radial} colors={gradients.goldAmbient.colors} stops={gradients.heroGlow.stops} />
          </View>
        </View>
        {showPhoto ? (
          <View {...HIDDEN} testID="plans-active-photo-image" style={StyleSheet.absoluteFill}>
            <RemoteImage url={photo.url} sources={photo.sources} resizeMode="cover" style={styles.photoImage} onExhausted={() => setFailedUrl(photo.url)} />
          </View>
        ) : null}
        <View pointerEvents="none" style={styles.fade}>
          <GradientFill angle={gradients.surfaceFade.angle} colors={gradients.surfaceFade.colors} />
        </View>
        <View testID="plans-active-badge" style={styles.badge}>
          <PlanIcon name="check" size={12} strokeWidth={3.2} color={colors.onGold} />
          <Text {...CAP_PILL} style={styles.badgeText}>
            Your active plan
          </Text>
        </View>
      </View>

      <View testID="plans-active-body" style={[styles.body, compact && styles.bodyCompact]}>
        <Text
          testID="plans-active-name"
          accessibilityRole="header"
          accessibilityLabel={plan?.name ?? ''}
          numberOfLines={1}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={textScale.title}
          style={styles.name}
        >
          {keepUnitsTogether(plan?.name)}
        </Text>
        {meta ? (
          <Text {...LINE_TEXT} testID="plans-active-meta" style={styles.meta}>
            {meta}
          </Text>
        ) : null}

        {circles ? <YourWeek circles={circles} compact={compact} /> : null}

        {next ? (
          <View
            testID="plans-next-workout"
            accessible
            accessibilityLabel={`Next workout · ${next.when}, ${next.title}${next.count ? ` · ${next.count}` : ''}`}
            style={styles.next}
          >
            <View {...HIDDEN} style={styles.nextIcon}>
              <PlanIcon name="dumbbell" size={16} strokeWidth={2.4} color={colors.gold} />
            </View>
            <View style={styles.nextText}>
              <Text {...LINE_TEXT} testID="plans-next-when" style={styles.nextWhen}>
                {`Next workout · ${next.when}`}
              </Text>
              <View testID="plans-next-line" style={styles.nextLine}>
                <Text {...CAP_BODY} testID="plans-next-title" numberOfLines={1} ellipsizeMode="tail" style={[styles.nextTitle, styles.shrink]}>
                  {next.title}
                </Text>
                {next.count ? (
                  <Text {...CAP_BODY} testID="plans-next-count" numberOfLines={1} style={[styles.nextTitle, styles.noShrink]}>
                    {` · ${next.count}`}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View testID="plans-active-actions" style={styles.actions}>
          {next ? (
            <Pressable
              testID="plans-start"
              accessibilityRole="button"
              accessibilityLabel={`Start ${next.title}`}
              onPress={onStart}
              style={[styles.start, next.gold ? styles.startGold : styles.startGlass]}
            >
              {({ pressed }) => (
                <>
                  <PressOverlay pressed={pressed} ink={next.gold} />
                  <PlanIcon name="play" size={14} filled color={next.gold ? colors.onGold : colors.textPrimary} />
                  <Text {...CAP_BODY} numberOfLines={1} ellipsizeMode="tail" style={[styles.startLabel, next.gold ? styles.onGoldText : styles.primaryText]}>
                    {`Start ${next.title}`}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
          {plan?.id ? (
            <Pressable testID="plans-see-full-plan" accessibilityRole="button" accessibilityLabel="See full plan" onPress={() => onView(plan.id)} style={styles.outline}>
              {({ pressed }) => (
                <>
                  <PressOverlay pressed={pressed} />
                  <Text {...CAP_BODY} numberOfLines={1} style={styles.outlineLabel}>
                    See full plan
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// "Your week": 7 columns Monday first. Each day is one accessible item
// ("Thu: training, today"; today also carries the selected = current-date
// state); its circle and label are hidden from the screen reader.
function YourWeek({ circles, compact }) {
  const size = compact ? 32 : 36;
  return (
    <View testID="plans-week" style={[styles.week, compact && styles.weekCompact]}>
      <Text {...CAP_BODY} testID="plans-week-heading" accessibilityRole="header" style={styles.weekHeading}>
        Your week
      </Text>
      <View testID="plans-week-days" accessibilityRole="list" accessibilityLabel="Your week" style={styles.days}>
        {circles.map((circle) => (
          <View
            key={circle.id}
            testID={`plans-week-day-${circle.id}`}
            accessible
            accessibilityLabel={weekDayLabel(circle)}
            accessibilityState={circle.today ? { selected: true } : undefined}
            style={styles.day}
          >
            <View {...HIDDEN} style={{ width: size, height: size }}>
              {circle.today ? <View testID={`plans-week-ring-${circle.id}`} style={[styles.ring, { width: size + 10, height: size + 10 }]} /> : null}
              <View
                testID={`plans-week-circle-${circle.id}`}
                style={[styles.circle, { width: size, height: size }, circle.training ? styles.circleTraining : styles.circleRest]}
              >
                <Text
                  testID={`plans-week-letter-${circle.id}`}
                  maxFontSizeMultiplier={textScale.badge}
                  style={[circle.training ? styles.letterTraining : styles.letterRest, compact && styles.letterCompact]}
                >
                  {circle.letter}
                </Text>
              </View>
            </View>
            {/* 11 px: the owner's decision for these three labels only. */}
            <Text
              {...HIDDEN}
              testID={`plans-week-label-${circle.id}`}
              numberOfLines={1}
              maxFontSizeMultiplier={textScale.badge}
              style={circle.today ? styles.labelToday : circle.training ? styles.labelTraining : styles.labelRest}
            >
              {circle.today ? 'Today' : circle.training ? 'Train' : 'Rest'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.surface,
  },
  photo: {
    height: PHOTO_HEIGHT,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  // glow-gold-ambient: a 220 circle at the top right.
  glow: {
    position: 'absolute',
    top: -GLOW_SIZE / 2 + 20,
    right: -GLOW_SIZE / 2 + 20,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  // The photo's fade into the card (gradient-surface-fade, §8.6 fold).
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PHOTO_HEIGHT,
  },
  badge: {
    position: 'absolute',
    left: spacing['4_5'],
    top: spacing[4],
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    backgroundColor: colors.gold,
  },
  badgeText: {
    ...font(700),
    fontSize: 13,
    lineHeight: 18,
    color: colors.onGold,
  },
  // padding 0 20 20, pulled up 34 over the fade.
  body: {
    marginTop: -34,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },
  bodyCompact: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },
  // 30/34/700 −0.04em.
  name: {
    ...font(700),
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1.2,
    color: colors.textPrimary,
  },
  meta: {
    ...font(400),
    marginTop: spacing[2],
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  week: {
    marginTop: spacing['4_5'],
    paddingTop: spacing['3_5'],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceWell,
  },
  weekCompact: {
    paddingTop: spacing[3],
    paddingHorizontal: spacing[2],
    paddingBottom: spacing['2_5'],
  },
  weekHeading: {
    ...font(600),
    marginHorizontal: spacing[1],
    marginBottom: spacing[3],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  days: {
    flexDirection: 'row',
  },
  day: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing['1_5'],
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  circleTraining: {
    backgroundColor: colors.gold,
  },
  // Dashed white 0.22 → hairline-bright (the §8.5 white ladder fold).
  circleRest: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.hairlineBright,
  },
  // The today ring: 3 px gap, 2 px gold.
  ring: {
    position: 'absolute',
    top: -5,
    left: -5,
    borderWidth: 2,
    borderRadius: radii.full,
    borderColor: colors.gold,
  },
  letterTraining: {
    ...font(700),
    fontSize: 14,
    lineHeight: 18,
    color: colors.onGold,
  },
  letterRest: {
    ...font(600),
    fontSize: 14,
    lineHeight: 18,
    color: colors.textFaint,
  },
  letterCompact: {
    fontSize: 13,
  },
  labelTraining: {
    ...font(600),
    fontSize: 11,
    lineHeight: 14,
    color: colors.textStrong2,
  },
  labelRest: {
    ...font(400),
    fontSize: 11,
    lineHeight: 14,
    color: colors.textFaint,
  },
  labelToday: {
    ...font(600),
    fontSize: 11,
    lineHeight: 14,
    color: colors.gold,
  },
  // Gold 0.10 → gold-faint; radius 18 → 20 (§3 fold).
  next: {
    marginTop: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing['3_5'],
    borderRadius: radii.lg,
    backgroundColor: colors.goldFaint,
  },
  // Gold 0.18 → gold-tint 0.14.
  nextIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.goldTint,
  },
  nextText: {
    flex: 1,
    minWidth: 0,
  },
  nextWhen: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  nextLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  nextTitle: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  shrink: {
    flexShrink: 1,
  },
  noShrink: {
    flexShrink: 0,
  },
  actions: {
    flexDirection: 'column',
    gap: spacing['2_5'],
    marginTop: spacing[4],
  },
  start: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2_5'],
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  startGold: {
    backgroundColor: colors.gold,
  },
  startGlass: {
    borderWidth: 1,
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillGlass,
  },
  startLabel: {
    ...font(700),
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 22,
  },
  onGoldText: {
    color: colors.onGold,
  },
  primaryText: {
    color: colors.textPrimary,
  },
  // White 0.16 → hairline-bright (the §8.5 white ladder fold).
  outline: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineBright,
    overflow: 'hidden',
  },
  outlineLabel: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
});
