import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import { CAP_BODY } from '../../../shared/components/largeText';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, font, gradients, radii, spacing, textScale, typography } from '../../../shared/theme/tokens';
import GradientFill from '../../../shared/components/GradientFill';
import { formatClock } from './restEngine';
import { isFinalTen, ringCircumference, ringDashOffset } from './restPresentation';

// v2 Phase 3 §4 (UX F2) building blocks for the Rest screen, the minimised
// disc and Workout complete. Look only; the rest logic stays in
// useRestTimer / restAlerts.

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_EASING = Easing.linear;
const PULSE_EASING = Easing.out(Easing.ease);
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

// ---- Icons (react-native-svg, explicit sizes; the board paths) ----------

export function ChevronDownIcon({ size = 18, color = colors.textPrimary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 18, color = colors.onLight }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function ShareIcon({ size = 17, color = colors.textPrimary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </Svg>
  );
}

export function CheckIcon({ size = 40, color = colors.onGold, strokeWidth = 3 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12l5 5L20 7" />
    </Svg>
  );
}

export function AlarmIcon({ size = 34, color = colors.teal }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={13} r={8} />
      <Path d="M12 9v4l2 2M5 3L2 6M22 6l-3-3" />
    </Svg>
  );
}

export function SpeakerIcon({ size = 34, color = colors.gold }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 5L6 9H2v6h4l5 4V5z" />
      <Path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </Svg>
  );
}

export function TrashIcon({ size = 26, color = colors.dangerText }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Svg>
  );
}

// ---- Rest ring ------------------------------------------------------------

// The depleting arc (time remaining), rotated −90° so it starts at 12
// o'clock. 500 ms linear between ticks; under reduced motion it steps.
// `geometry` = { viewBox, radius, stroke }.
export function RestRing({ size, geometry, secondsLeft, totalSeconds, track = colors.track, testID = 'rest-ring' }) {
  const reducedMotion = useReducedMotion();
  const { viewBox, radius, stroke } = geometry;
  const circumference = ringCircumference(radius);
  const offset = ringDashOffset(secondsLeft, totalSeconds, radius);
  const animated = useRef(new Animated.Value(offset)).current;
  useEffect(() => {
    if (reducedMotion) {
      animated.setValue(offset);
      return undefined;
    }
    const animation = Animated.timing(animated, { toValue: offset, duration: 500, easing: RING_EASING, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [animated, offset, reducedMotion]);
  const centre = viewBox / 2;
  return (
    <View testID={testID} {...hidden} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rotated]}>
      <Svg width={size} height={size} viewBox={`0 0 ${viewBox} ${viewBox}`}>
        <Circle cx={centre} cy={centre} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <AnimatedCircle
          testID={`${testID}-arc`}
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke={colors.gold}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={reducedMotion ? offset : animated}
        />
      </Svg>
    </View>
  );
}

// ---- Countdown digits ----------------------------------------------------

// F2 last 10 s (0 < s ≤ 10): danger-text digits and a 1 → 1.06 → 1 pulse,
// 1 s, ease-out, infinite; no pulse under reduced motion (the colour still
// changes). Capped at textScale.timer (fixed-geometry chrome, UX §9).
//
// T-72: iOS sizes the Text box with the negative tracking after every glyph,
// the last one too, but draws the line one tracking step wider, centred, and
// clips the ink to the box: the outer edges of the first and last digits were
// cut. Side padding of one tracking step plus 5 % of the size (the bold digits'
// overhang; it also covers the 1.2 text-scale cap) keeps the ink inside the
// box. The text stays centred, so the size and tracking look the same.
export function digitsInkPad(style) {
  const { fontSize = 0, letterSpacing = 0 } = StyleSheet.flatten(style) || {};
  return Math.ceil(Math.max(-letterSpacing, 0) + fontSize * 0.05);
}

// T-72 round 2: the tops were cut too. With lineHeight = fontSize (92/92,
// tablet 100/100), iOS puts the baseline one Geist descent (0.295 em) above
// the box bottom, so the digit tops (0.726 em) rise ~1.9 pt above the box and
// are clipped. Geist Bold digits span 1.03 em from the box bottom; the excess
// over the lineHeight plus 5 % of the size is padded top and bottom, and an
// equal negative margin keeps the layout, so the digits and "of m:ss" stay put.
const DIGIT_SPAN_EM = 1.03;

export function digitsInkPadVertical(style) {
  const { fontSize = 0, lineHeight } = StyleSheet.flatten(style) || {};
  const excess = lineHeight ? Math.max(DIGIT_SPAN_EM * fontSize - lineHeight, 0) : 0;
  return Math.ceil(excess + fontSize * 0.05);
}

// T-146: the full Rest passes `warn` (red in its last 5 s, colour only, no
// pulse; rev 23) and its spoken label; the minimised disc passes neither and
// keeps the last-10-s danger + pulse (FE Q4).
// `maxScale`: the large-text cap (T-153 sheet 1.3; the timer token elsewhere).
export function Countdown({ seconds, style, testID = 'rest-countdown', warn, accessibilityLabel, maxScale = textScale.timer }) {
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  const fullRest = warn !== undefined;
  const finalTen = !fullRest && isFinalTen(seconds);
  const padVertical = digitsInkPadVertical([styles.digits, style]);
  useEffect(() => {
    if (!finalTen || reducedMotion) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 500, easing: PULSE_EASING, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, easing: PULSE_EASING, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [finalTen, pulse, reducedMotion]);
  return (
    <Animated.Text
      testID={testID}
      accessibilityRole="timer"
      accessibilityLabel={accessibilityLabel}
      maxFontSizeMultiplier={maxScale}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      textBreakStrategy="simple"
      style={[
        styles.digits,
        style,
        {
          paddingHorizontal: digitsInkPad([styles.digits, style]),
          paddingVertical: padVertical,
          marginVertical: -padVertical,
        },
        (fullRest ? warn : finalTen) && styles.danger,
        { transform: [{ scale: pulse }] },
      ]}
    >
      {formatClock(seconds)}
    </Animated.Text>
  );
}

// ---- Next card (U4) ----------------------------------------------------------

// Phone: photo 48 + "Next · {exercise}" / "Set 3 · 8–10 reps · 135 lb".
// Tablet: "Next" / the line on the left, photo 44 + the full name (one line,
// ellipsis) on the right. Read as one item; the photo is decorative.
export function NextCard({ next, tablet }) {
  if (!next) {
    return null;
  }
  const label = `Next, ${next.exerciseName}, ${next.line}`;
  if (tablet) {
    return (
      <View testID="rest-next" accessible accessibilityLabel={label} style={styles.nextTablet}>
        <View style={styles.nextText}>
          <Text {...CAP_BODY} style={styles.nextEyebrowTablet}>Next</Text>
          <Text {...CAP_BODY} style={styles.nextLineTablet}>{next.line}</Text>
        </View>
        <View style={styles.nextSide}>
          <ExerciseImage exercise={next.exercise} name={next.exerciseName} size={44} testID="rest-next-image" />
          <Text {...CAP_BODY} numberOfLines={1} ellipsizeMode="tail" style={styles.nextNameTablet}>{next.exerciseName}</Text>
        </View>
      </View>
    );
  }
  return (
    <View testID="rest-next" accessible accessibilityLabel={label} style={styles.nextPhone}>
      <ExerciseImage exercise={next.exercise} name={next.exerciseName} size={48} testID="rest-next-image" />
      <View style={styles.nextText}>
        <Text {...CAP_BODY} numberOfLines={2} ellipsizeMode="tail" style={styles.nextEyebrow}>{`Next · ${next.exerciseName}`}</Text>
        <Text {...CAP_BODY} style={styles.nextLine}>{next.line}</Text>
      </View>
    </View>
  );
}

// ---- Minimised disc face -------------------------------------------------------

// The dark disc: radial surface-high → surface (the board's two greys fold
// onto these, UX §8.6), mounted with the disc so it never appears on a state
// change (Android gradient hazard).
export function DiscFill({ size }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: size / 2, overflow: 'hidden' }]}>
      <GradientFill radial={DISC_RADIAL} colors={[colors.surfaceHigh, colors.surface]} stops={[0, 0.75]} />
    </View>
  );
}

const DISC_RADIAL = Object.freeze({ cx: 0.5, cy: 0.3, rx: 0.75, ry: 0.75 });

// The ambient gold wash behind the phone Rest screen (glow-gold-ambient).
export function RestGlow() {
  return <GradientFill radial={gradients.goldAmbient.radial} colors={gradients.goldAmbient.colors} stops={gradients.goldAmbient.stops} />;
}

const styles = StyleSheet.create({
  rotated: {
    transform: [{ rotate: '-90deg' }],
  },
  digits: {
    ...typography.displayTimer,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    textAlign: 'center',
  },
  danger: {
    color: colors.dangerText,
  },
  nextPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingTop: spacing['2_5'],
    paddingBottom: spacing['2_5'],
    paddingLeft: spacing['2_5'],
    paddingRight: spacing[4],
    borderRadius: radii.lgPlus,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.glass,
  },
  nextText: {
    flex: 1,
    minWidth: 0,
  },
  nextEyebrow: {
    ...typography.caption,
    color: colors.textMuted,
  },
  nextLine: {
    ...typography.body,
    ...font(600),
    marginTop: spacing['0_5'],
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  nextTablet: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderRadius: radii.lgPlus,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.fillWell,
  },
  nextEyebrowTablet: {
    ...typography.label,
    ...font(400),
    color: colors.textMuted,
  },
  nextLineTablet: {
    ...typography.bodyLg,
    ...font(600),
    marginTop: spacing['0_5'],
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  nextSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flexShrink: 1,
    maxWidth: '50%',
  },
  nextNameTablet: {
    ...typography.bodySm,
    flexShrink: 1,
    color: colors.textStrong2,
  },
});
