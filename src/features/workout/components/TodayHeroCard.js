import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardSurface } from '../../../shared/components/Card';
import GradientFill from '../../../shared/components/GradientFill';
import RemoteImage from '../../../shared/components/RemoteImage';
import Spinner from '../../../shared/components/Spinner';
import StatusPill from '../../../shared/components/StatusPill';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';
import { breakpoints, colors, font, gradients, radii, shadows, spacing, textScale, titleTracking, typography } from '../../../shared/theme/tokens';
import { TODAY_BADGE_LABELS } from '../workoutFormat';
import ProgressRing from './ProgressRing';
import { formatCount, keepUnitsTogether } from '../../../shared/format/counts';

const PILL_TONE = { completed: 'completed', training: 'gold', rest: 'neutral' };
const NUMBER_TEXT = { maxFontSizeMultiplier: textScale.display };

function PlayIcon({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill={colors.gold} stroke={colors.gold} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

// The hub's gold Start (UX G: 60 tall, label left 16/700, a 44 ground disc
// with a gold play icon on the right). Starting: 0.5 + a 20 spinner before
// the label. Pressed = gold + the ink 4 % overlay (§8.6 state rule).
function HeroStart({ tablet, starting, onPress }) {
  return (
    <Pressable
      testID="workout-hero-start"
      accessibilityRole="button"
      accessibilityState={{ disabled: starting, busy: starting }}
      disabled={starting}
      onPress={onPress}
      style={[styles.start, tablet && styles.startTablet, starting && styles.starting]}
    >
      {({ pressed }) => (
        <>
          {pressed && !starting ? <View testID="workout-hero-start-pressed" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.inkOverlay]} /> : null}
          {starting ? <Spinner size={20} thickness={2} color={colors.onGold} track={colors.inkLine} /> : null}
          <Text {...CAP_BODY} style={[styles.startText, tablet && styles.startTextTablet]}>
            Start today's workout
          </Text>
          <View style={[styles.disc, tablet && styles.discTablet]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <PlayIcon size={16} />
          </View>
        </>
      )}
    </Pressable>
  );
}

// H3 (RN-SPEC-workout §2.2), v2 look per UX G "Workout hub" / "Tablet:
// Workout hub". ND-1: the tablet hero shows today's exercise photo
// (`imageUrl`) on the right 60 % under the surface fade; none → no photo
// layer. The phone hero has no photo.
export default function TodayHeroCard({ planName, dayCountLabel, state, detail, ringValue, ringTotal, showStart, starting, onStart, imageUrl }) {
  const { width, fontScale } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  const reflow = fontScale > textScale.reflowAbove;
  // Fixed per mount (Android: a gradient never appears on a later change).
  const [photo] = useState(() => (tablet ? imageUrl || null : null));
  const ringSize = tablet ? 132 : 104;
  const ringStroke = tablet ? (8 * 100) / 84 : (11 * 100) / 104;
  const pill = <StatusPill testID="workout-hero-badge" tone={PILL_TONE[state] ?? 'neutral'} label={TODAY_BADGE_LABELS[state]} />;
  return (
    <CardSurface hero testID="workout-hero" style={[styles.card, tablet && styles.cardTablet]}>
      {photo ? (
        <View testID="workout-hero-photo" pointerEvents="none" style={styles.photo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <RemoteImage url={photo} style={[StyleSheet.absoluteFill, styles.photoImage]} />
          <GradientFill angle={90} colors={[gradients.surfaceFade.colors[1], gradients.surfaceFade.colors[0]]} stops={[0, 1]} />
        </View>
      ) : null}
      <View pointerEvents="none" style={tablet ? styles.glowTablet : styles.glow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <GradientFill radial={gradients.heroGlow.radial} colors={gradients.heroGlow.colors} stops={[0, 0.7]} />
      </View>
      {tablet ? null : (
        <View style={[styles.labelRow, reflow && styles.stacked]}>
          <Text {...CAP_BODY} style={styles.eyebrow}>
            Your plan
          </Text>
          {pill}
        </View>
      )}
      <View testID="workout-hero-top" style={[styles.topRow, !tablet && styles.topRowPhone, reflow && styles.stacked]}>
        <View style={styles.textColumn}>
          {tablet ? (
            <Text {...CAP_BODY} style={styles.eyebrowTablet}>
              Your plan
            </Text>
          ) : null}
          <Text testID="workout-hero-plan" accessibilityRole="header" {...DISPLAY_TITLE_TEXT} style={tablet ? styles.planNameTablet : styles.planName}>
            {keepUnitsTogether(planName)}
          </Text>
          <Text {...CAP_BODY} style={tablet ? styles.dayCountTablet : styles.dayCount}>
            {dayCountLabel}
          </Text>
          {tablet ? <View style={styles.pillTablet}>{pill}</View> : null}
        </View>
        <ProgressRing
          flat
          value={ringValue}
          total={ringTotal}
          size={ringSize}
          thickness={ringStroke}
          label={`${ringValue} of ${formatCount(ringTotal, 'training day', 'training days')} completed this week`}
        >
          <Text {...NUMBER_TEXT} numberOfLines={1} textBreakStrategy="simple" style={tablet ? styles.ringValueTablet : styles.ringValue}>
            {ringValue}
          </Text>
          <Text {...NUMBER_TEXT} style={tablet ? styles.ringTotalTablet : styles.ringTotal}>{`of ${ringTotal}`}</Text>
        </ProgressRing>
      </View>
      <Text testID="workout-hero-detail" {...CAP_BODY} style={tablet ? styles.detailTablet : styles.detail}>
        {detail}
      </Text>
      {showStart ? <HeroStart tablet={tablet} starting={starting} onPress={onStart} /> : null}
    </CardSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxxl,
    borderColor: colors.hairlineStrong,
    padding: spacing['5_5'],
  },
  cardTablet: {
    padding: spacing[8],
  },
  photo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '60%',
  },
  photoImage: {
    opacity: 0.5,
  },
  glow: {
    position: 'absolute',
    top: -80,
    right: -70,
    width: 280,
    height: 280,
  },
  glowTablet: {
    position: 'absolute',
    bottom: -140,
    left: -90,
    width: 380,
    height: 380,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  stacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  eyebrow: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
  },
  eyebrowTablet: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[5],
  },
  topRowPhone: {
    alignItems: 'flex-end',
    gap: spacing[3],
    marginTop: spacing['3_5'],
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  planName: {
    ...font(700),
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: titleTracking(40, -0.055),
    color: colors.textPrimary,
  },
  planNameTablet: {
    ...font(700),
    marginTop: spacing[2],
    fontSize: 60,
    lineHeight: 58,
    letterSpacing: titleTracking(60, -0.055),
    color: colors.textPrimary,
  },
  dayCount: {
    ...typography.body,
    marginTop: spacing['2_5'],
    color: colors.textSecondary,
  },
  dayCountTablet: {
    ...typography.bodyLg,
    marginTop: spacing[2],
    color: colors.textSecondary,
  },
  pillTablet: {
    marginTop: spacing['3_5'],
  },
  ringValue: {
    ...font(700),
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  ringValueTablet: {
    ...font(700),
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  ringTotal: {
    ...typography.caption,
    marginTop: spacing['0_5'],
    color: colors.textMuted,
  },
  ringTotalTablet: {
    ...typography.caption,
    marginTop: spacing['0_5'],
    color: colors.textSecondary,
  },
  detail: {
    ...font(500),
    marginTop: spacing['4_5'],
    fontSize: 15,
    lineHeight: 22,
    color: colors.textStrong2,
  },
  detailTablet: {
    ...font(500),
    marginTop: spacing['4_5'],
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  start: {
    minHeight: 60,
    marginTop: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    overflow: 'hidden',
    borderRadius: radii.full,
    backgroundColor: colors.gold,
    boxShadow: shadows.goldGlowLarge,
    paddingLeft: spacing['5_5'],
    paddingRight: spacing[2],
    paddingVertical: spacing[2],
  },
  startTablet: {
    minHeight: 62,
    maxWidth: 420,
    marginTop: spacing['5_5'],
    paddingLeft: 26,
  },
  starting: {
    opacity: 0.5,
  },
  inkOverlay: {
    backgroundColor: colors.pressOverlayInk,
  },
  startText: {
    ...font(700),
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: colors.onGold,
  },
  startTextTablet: {
    fontSize: 18,
    lineHeight: 24,
  },
  disc: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discTablet: {
    width: 46,
    height: 46,
  },
});
