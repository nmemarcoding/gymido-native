import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import GradientFill from '../../../shared/components/GradientFill';
import Spinner from '../../../shared/components/Spinner';
import { CAP_BODY, CAP_PILL, TITLE_TEXT } from '../../../shared/components/largeText';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { breakpoints, colors, font, gradients, radii, spacing, titleTracking } from '../../../shared/theme/tokens';
import { dayTitle } from '../workoutFormat';

const RISE = Easing.bezier(0.22, 1, 0.36, 1);

// H5 (RN-SPEC-workout §2.3), v2 look per UX G "Day card". The card is not
// pressable; only Start is (also on done days). Android render rule: the
// done gradient (phone gradient-gold-card, tablet the gold corner glow) is
// ALWAYS drawn and a solid layer above it fades out when the day is done, so
// completing never creates a gradient; the outer card (whose border changes)
// never clips, the inner clip layer (fixed style) rounds the layers.
export default function PlanDayCard({ day, weekdays, isDone, starting, onStart, index, style }) {
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  const rise = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      rise.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(rise, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index, 6) * 45,
      easing: RISE,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, reducedMotion, rise]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const title = dayTitle(day);
  const donePill = isDone ? (
    <View testID={`workout-day-done-${day.id}`} style={[styles.donePill, tablet && styles.donePillTablet]}>
      <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={colors.onGold} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M20 6 9 17l-5-5" />
      </Svg>
      {/* UX native final audit 27 Oct 2026, A110: one line at 320 (the 2-up
          card left it ~107 wide); the label shrinks, it never wraps out. */}
      <Text {...CAP_PILL} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.doneText}>
        Done this week
      </Text>
    </View>
  ) : null;

  return (
    <Animated.View style={[styles.fill, style, { opacity: rise, transform: [{ translateY }] }]}>
      <View testID={`workout-day-${day.id}`} style={[styles.card, isDone ? styles.cardDone : styles.cardRest]}>
        <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {tablet ? (
            <>
              <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
              <View style={[StyleSheet.absoluteFill, styles.surface, { opacity: isDone ? 1 : 0 }]} />
              <GradientFill radial={DONE_GLOW.radial} colors={gradients.cardCornerGlow.colors} stops={[0, 0.6]} style={{ opacity: isDone ? 1 : 0 }} />
            </>
          ) : (
            <>
              <GradientFill angle={gradients.goldCard.angle} colors={gradients.goldCard.colors} />
              <View testID={`workout-day-solid-${day.id}`} style={[StyleSheet.absoluteFill, styles.surface, { opacity: isDone ? 0 : 1 }]} />
            </>
          )}
        </View>
        <View style={[styles.body, tablet && styles.bodyTablet]}>
          {tablet ? (
            <View style={styles.titleRow}>
              <Text accessibilityRole="header" {...TITLE_TEXT} style={styles.titleTablet}>
                {title}
              </Text>
              {donePill}
            </View>
          ) : (
            <>
              {donePill}
              <Text accessibilityRole="header" {...TITLE_TEXT} style={[styles.title, isDone ? styles.titleDone : styles.titleRest]}>
                {title}
              </Text>
            </>
          )}
          <View style={[styles.pills, tablet && styles.pillsTablet]}>
            {(weekdays.length ? weekdays : [{ id: 'none', name: 'Unscheduled' }]).map((weekday) => (
              <View key={weekday.id} style={[styles.pill, isDone && !tablet ? styles.pillDone : styles.pillRest]}>
                <Text {...CAP_PILL} style={styles.pillText}>
                  {weekday.name}
                </Text>
              </View>
            ))}
          </View>
          <Pressable
            testID={`workout-day-start-${day.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Start ${title}`}
            accessibilityState={{ disabled: starting, busy: starting }}
            disabled={starting}
            onPress={onStart}
            style={[styles.start, tablet && styles.startTablet, starting && styles.startLoading]}
          >
            {({ pressed }) => (
              <>
                {pressed && !starting ? <View testID={`workout-day-start-pressed-${day.id}`} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
                {starting ? <Spinner size={16} thickness={2} color={colors.textPrimary} track="transparent" /> : null}
                <Text {...CAP_BODY} style={[styles.startText, tablet && styles.startTextTablet]}>
                  Start
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// Tablet done: radial-gradient(90% 80% at 100% 0%, gold, 0 60%).
const DONE_GLOW = { radial: { cx: 1, cy: 0, rx: 0.9, ry: 0.8 } };

const styles = StyleSheet.create({
  fill: {
    flexGrow: 1,
  },
  card: {
    flexGrow: 1,
    minHeight: 188,
    borderRadius: radii.xxl,
  },
  // The board's inset 1.5 gold 0.6 ring → gold-strong.
  cardDone: {
    borderWidth: 1.5,
    borderColor: colors.goldStrong,
  },
  cardRest: {
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  clip: {
    borderRadius: radii.xxl,
    overflow: 'hidden',
  },
  surface: {
    backgroundColor: colors.surface,
  },
  body: {
    flexGrow: 1,
    padding: spacing[4],
  },
  bodyTablet: {
    padding: spacing['5_5'],
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    ...font(700),
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: titleTracking(28, -0.045),
    color: colors.textPrimary,
  },
  titleDone: {
    marginTop: spacing[4],
  },
  // Keeps the baseline of the done cards (no pill above).
  titleRest: {
    marginTop: 40,
  },
  titleTablet: {
    ...font(700),
    flexShrink: 1,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -1.2,
    color: colors.textPrimary,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: spacing[1],
    minHeight: 24,
    borderRadius: radii.full,
    backgroundColor: colors.gold,
    paddingHorizontal: 9,
    paddingVertical: spacing['0_5'],
  },
  donePillTablet: {
    minHeight: 22,
  },
  doneText: {
    ...font(700),
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 14,
    color: colors.onGold,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['1_5'],
    marginTop: spacing[2],
  },
  pillsTablet: {
    marginTop: spacing['2_5'],
  },
  pill: {
    minHeight: 26,
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: spacing['2_5'],
    paddingVertical: spacing['0_5'],
  },
  pillDone: {
    backgroundColor: colors.fillButton,
  },
  // The board's 0.06 → fill-glass 0.08 (UX §8.7 U8).
  pillRest: {
    backgroundColor: colors.fillGlass,
  },
  pillText: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textStrong2,
  },
  start: {
    marginTop: 'auto',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    overflow: 'hidden',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillGlass,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing['1_5'],
  },
  startTablet: {
    minHeight: 50,
    marginTop: spacing[4],
  },
  startLoading: {
    opacity: 0.5,
  },
  pressOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  startText: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  startTextTablet: {
    fontSize: 16,
  },
});
