import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import GradientFill from '../../../shared/components/GradientFill';
import { breakpoints, colors } from '../../../shared/theme/tokens';
import { TODAY_BADGE_LABELS } from '../workoutFormat';
import BrandButton from './BrandButton';
import Card3D from './Card3D';
import ProgressRing from './ProgressRing';

const BADGES = {
  completed: { dot: colors.success, text: colors.success, background: colors.successTint },
  training: { dot: colors.brand400, text: colors.brand700, background: colors.brand50 },
  // A1: text-secondary on the muted pill.
  rest: { dot: colors.textMuted, text: colors.textSecondary, background: colors.surfaceMuted },
};

// H3 (RN-SPEC-workout §2.2). [O11]/A4: the plan name takes 2 lines, then an
// ellipsis; the ring keeps its size.
export default function TodayHeroCard({ planName, dayCountLabel, state, detail, ringValue, ringTotal, showStart, starting, onStart }) {
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  const badge = BADGES[state];
  return (
    <Card3D testID="workout-hero" style={styles.card}>
      <View style={[styles.inner, { padding: wide ? 24 : 20 }]}>
        <GradientFill angle={135} colors={['#fef8e7', '#ffffff', '#ffffff']} />
        <View style={styles.topRow}>
          <View style={styles.textColumn}>
            <Text style={styles.eyebrow}>Your plan</Text>
            <Text textBreakStrategy="simple" numberOfLines={2} ellipsizeMode="tail" style={[styles.planName, wide && styles.planNameWide]}>
              {planName}
            </Text>
            <Text style={styles.dayCount}>{dayCountLabel}</Text>
            <View testID="workout-hero-badge" style={[styles.badge, { backgroundColor: badge.background }]}>
              <View style={[styles.badgeDot, { backgroundColor: badge.dot }]} accessibilityElementsHidden importantForAccessibility="no" />
              <Text style={[styles.badgeText, { color: badge.text }]}>{TODAY_BADGE_LABELS[state]}</Text>
            </View>
          </View>
          <ProgressRing
            value={ringValue}
            total={ringTotal}
            size={84}
            thickness={9}
            label={`${ringValue} of ${ringTotal} training days completed this week`}
          >
            <Text numberOfLines={1} textBreakStrategy="simple" style={styles.ringValue}>{ringValue}</Text>
            <Text style={styles.ringTotal}>{`of ${ringTotal}`}</Text>
          </ProgressRing>
        </View>
        <Text style={styles.detail}>{detail}</Text>
        {showStart ? (
          <BrandButton
            testID="workout-hero-start"
            label="START TODAY'S WORKOUT"
            loading={starting}
            onPress={onStart}
            style={styles.cta}
            labelStyle={styles.ctaLabel}
          />
        ) : null}
      </View>
    </Card3D>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  inner: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand700,
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
    lineHeight: 37.5,
  },
  dayCount: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    boxShadow: 'inset 0px 1px 0px rgba(255, 255, 255, 0.9), 0px 1px 2px rgba(17, 24, 39, 0.05)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  ringValue: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  ringTotal: {
    marginTop: 2,
    fontSize: 9.6,
    lineHeight: 9.6,
    fontWeight: '700',
    letterSpacing: 1.34,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  detail: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  cta: {
    marginTop: 20,
    borderRadius: 24,
    paddingVertical: 16,
  },
  ctaLabel: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.4,
  },
});
