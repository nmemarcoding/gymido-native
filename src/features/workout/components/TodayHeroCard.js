import { StyleSheet, Text, View } from 'react-native';

import { useLayoutMetrics } from '../../../navigation/shell/layoutMetrics';
import Spinner from '../../../shared/components/Spinner';
import { colors, radii, textStyles } from '../../../shared/theme/tokens';
import { ColorPressable } from '../../plans/components/PlanBits';
import { plural, TODAY_BADGE_LABELS, todayDetail, todayState } from '../workoutRules';
import { hubStyles, PressedGradient, PRESS_SHADOW, SHADOW_BRAND, SHADOW_EMBOSS } from './hubChrome';
import ProgressRing, { ringLabelStyles } from './ProgressRing';

// §3.1 badge variants.
const BADGE_VARIANTS = {
  completed: { dot: colors.success, text: colors.success, background: colors.successTint },
  training: { dot: colors.brand400, text: colors.brand700, background: colors.brand50 },
  rest: { dot: colors.textMuted, text: colors.textMuted, background: colors.surfaceMuted },
};

// TodayHeroCard (RN-SPEC-workout §2.2).
export default function TodayHeroCard({
  planName,
  planDayCount,
  todayStatus,
  completedCount,
  showStart,
  isStarting,
  onStart,
}) {
  const { gutter } = useLayoutMetrics();
  const wide = gutter >= 20;
  const state = todayState(todayStatus);
  const badge = BADGE_VARIANTS[state];

  return (
    <View testID="today-hero-card" style={[hubStyles.card3d, styles.card]}>
      <View style={[styles.inner, wide && styles.innerWide]}>
        <View style={styles.topRow}>
          <View style={styles.column}>
            <Text style={styles.eyebrow}>Your plan</Text>
            {/* [O11] two lines then ellipsis. The column's minWidth/flexShrink
                pair below is what stops a long unbroken word overflowing and
                pushing the ring off the card. */}
            <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.planName, wide && styles.planNameWide]}>
              {planName}
            </Text>
            <Text style={styles.dayCount}>{`${planDayCount} training ${plural(planDayCount, 'day')}`}</Text>
            <View style={[styles.badge, { backgroundColor: badge.background }]}>
              <View
                importantForAccessibility="no"
                accessibilityElementsHidden
                style={[styles.badgeDot, { backgroundColor: badge.dot }]}
              />
              <Text style={[styles.badgeLabel, { color: badge.text }]}>{TODAY_BADGE_LABELS[state]}</Text>
            </View>
          </View>
          <ProgressRing
            value={completedCount}
            total={planDayCount}
            size={84}
            thickness={9}
            label={`${completedCount} of ${planDayCount} training days completed this week`}
          >
            <Text style={ringLabelStyles.heroCount}>{completedCount}</Text>
            <Text style={ringLabelStyles.heroTotal}>{`of ${planDayCount}`}</Text>
          </ProgressRing>
        </View>

        <Text style={styles.detail}>{todayDetail(todayStatus)}</Text>

        {showStart ? (
          <View style={[styles.ctaWrap, isStarting && styles.ctaDisabled]}>
            <ColorPressable
              testID="hero-start"
              accessibilityRole="button"
              accessibilityState={{ disabled: isStarting, busy: isStarting }}
              disabled={isStarting}
              onPress={onStart}
              colorsFor={() => ({})}
              style={({ pressed }) => [styles.cta, pressed && !isStarting && styles.ctaPressed]}
            >
              {(pressed) => (
                <>
                  <PressedGradient pressed={pressed && !isStarting} radius={24} />
                  {isStarting ? (
                    <Spinner size={20} thickness={2} trackColor={colors.spinnerTrackNavy} arcColor={colors.navy} />
                  ) : null}
                  <Text style={styles.ctaLabel}>START TODAY&apos;S WORKOUT</Text>
                </>
              )}
            </ColorPressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  inner: {
    experimental_backgroundImage: 'linear-gradient(135deg, #fef8e7, #ffffff, #ffffff)',
    padding: 20,
  },
  innerWide: {
    padding: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  column: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  eyebrow: {
    ...textStyles.eyebrow,
    color: colors.brand600,
  },
  planName: {
    marginTop: 6,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  planNameWide: {
    fontSize: 30,
    lineHeight: 36,
  },
  dayCount: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  badge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    boxShadow: SHADOW_EMBOSS,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  detail: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  ctaWrap: {
    marginTop: 20,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 24,
    paddingVertical: 16,
    experimental_backgroundImage: 'linear-gradient(to bottom, #f7ce4f, #f4b400)',
    boxShadow: SHADOW_BRAND,
  },
  // The pressed stops come from the PressedGradient layer (§19.10).
  ctaPressed: {
    boxShadow: PRESS_SHADOW,
    transform: [{ translateY: 1 }],
  },
  ctaLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: colors.navy,
  },
});
