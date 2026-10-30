import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import GradientFill from '../../../../shared/components/GradientFill';
import { CAP_BODY } from '../../../../shared/components/largeText';
import { useReducedMotion } from '../../../../shared/hooks/useReducedMotion';
import { colors, font, gradients, titleTracking } from '../../../../shared/theme/tokens';
import { dayA11y } from '../../pageModel';
import { CheckIcon } from '../hub/HubIcons';

// T-140 (UX build ruling §3–§5, board "A-balanced"): the week card. The ring
// holds ONLY "{done} of {total}" (two text runs, 8 apart, never wrapped); its
// label sits under it. The number's scale is capped at 1.3× and the ring
// grows with it (max(size, number width + 48)), so nothing crosses the arc.
// Then the 7 tappable days (each opens its day sheet).

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const CIRCUMFERENCE = 2 * Math.PI * 86;
const NUMBER_CAP = 1.3;
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

export function WeekRing({ done, total, size = 164, numberSize = 52, ofSize = 24 }) {
  const reducedMotion = useReducedMotion();
  const [numberWidth, setNumberWidth] = useState(0);
  const ratio = total > 0 ? Math.min(Math.max(done, 0), total) / total : 0;
  const target = CIRCUMFERENCE * (1 - ratio);
  // §4 motion: 0 → value in 600 ms ease-out on the first load; none under
  // Reduce Motion.
  const [offset] = useState(() => new Animated.Value(reducedMotion ? target : CIRCUMFERENCE));
  useEffect(() => {
    if (reducedMotion) {
      offset.setValue(target);
      return undefined;
    }
    const animation = Animated.timing(offset, { toValue: target, duration: 600, easing: EASE_OUT, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [offset, target, reducedMotion]);
  const box = Math.max(size, numberWidth + 48);

  return (
    <View
      testID="workout-ring"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${done} of ${total} workouts done this week`}
      style={{ width: box, height: box }}
    >
      <View {...hidden} style={styles.ringSvg}>
        <Svg width={box} height={box} viewBox="0 0 200 200" style={styles.rotate}>
          <Circle cx={100} cy={100} r={86} fill="none" stroke={colors.track} strokeWidth={16} />
          {ratio > 0 ? (
            <AnimatedCircle
              cx={100}
              cy={100}
              r={86}
              fill="none"
              stroke={colors.teal}
              strokeWidth={16}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          ) : null}
        </Svg>
      </View>
      <View {...hidden} style={styles.ringCenter}>
        <View testID="workout-ring-number" style={styles.number} onLayout={(event) => setNumberWidth(event.nativeEvent.layout.width)}>
          <Text maxFontSizeMultiplier={NUMBER_CAP} numberOfLines={1} style={[styles.done, { fontSize: numberSize, lineHeight: numberSize, letterSpacing: titleTracking(numberSize, -0.04) }]}>
            {String(done)}
          </Text>
          <Text maxFontSizeMultiplier={NUMBER_CAP} numberOfLines={1} style={[styles.of, { fontSize: ofSize, lineHeight: ofSize }]}>
            {`of ${total}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

// §5 the day circle by type (status reads by shape too: ✓ / dashed ! / ring /
// dot / empty).
function DayCircle({ cell, selected }) {
  const doneToday = cell.type === 'done' && cell.isToday;
  const look = [
    styles.circle,
    cell.type === 'done' && styles.circleDone,
    cell.type === 'missed' && styles.circleMissed,
    cell.type === 'today' && styles.circleToday,
    cell.type === 'rest' && (cell.isToday ? styles.circleTodayRest : styles.circleRest),
    cell.type === 'future' && styles.circleFuture,
  ];
  const circle = (
    <View testID={`workout-day-circle-${cell.type}`} style={look}>
      {cell.type === 'done' ? <CheckIcon size={18} color={colors.onGold} /> : null}
      {cell.type === 'missed' ? (
        <Text maxFontSizeMultiplier={NUMBER_CAP} style={styles.bang}>
          !
        </Text>
      ) : null}
      {cell.type === 'today' || cell.type === 'future' || (cell.type === 'rest' && cell.isToday) ? (
        <View style={[styles.dot, cell.type === 'future' && styles.dotFuture]} />
      ) : null}
    </View>
  );
  // The done-today gold ring (2 gap + 2 ring) and the open day's outline (3
  // offset + 2) are overlays, like the board's box-shadow / outline: the
  // 40 px circle keeps its size in a ~47 px column.
  return (
    <View>
      {circle}
      {doneToday ? <View pointerEvents="none" style={styles.todayRing} /> : null}
      {selected ? <View testID="workout-day-selected" pointerEvents="none" style={styles.selected} /> : null}
    </View>
  );
}

export default function WeekCard({ cells, progress, label, openIndex = -1, onOpenDay, dayRefs, ring }) {
  return (
    <View testID="workout-week-card" accessibilityLabel="This week" style={styles.card}>
      <View pointerEvents="none" style={styles.fill}>
        <GradientFill colors={gradients.card.colors} angle={gradients.card.angle} />
        <GradientFill radial={gradients.workoutWeekGlow.radial} colors={gradients.workoutWeekGlow.colors} stops={gradients.workoutWeekGlow.stops} />
      </View>
      <WeekRing done={progress.done} total={progress.total} {...ring} />
      <Text testID="workout-ring-label" {...CAP_BODY} style={styles.label}>
        {label}
      </Text>
      <View testID="workout-days" accessibilityLabel="Days this week. Tap a day to see its plan." style={styles.strip}>
        {cells.map((cell) => (
          <Pressable
            key={cell.key}
            ref={(node) => {
              if (dayRefs) {
                dayRefs.current[cell.index] = node;
              }
            }}
            testID={`workout-day-${cell.index}`}
            accessibilityRole="button"
            accessibilityLabel={dayA11y(cell)}
            accessibilityHint="Opens this day's plan"
            onPress={() => onOpenDay(cell)}
            style={styles.day}
          >
            <DayCircle cell={cell} selected={openIndex === cell.index} />
            <Text maxFontSizeMultiplier={NUMBER_CAP} {...hidden} style={[styles.letter, cell.isToday && styles.letterToday]}>
              {cell.letter}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardEdge,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 22,
  },
  fill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 32,
    overflow: 'hidden',
  },
  ringSvg: {
    ...StyleSheet.absoluteFill,
  },
  rotate: {
    transform: [{ rotate: '-90deg' }],
  },
  ringCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  done: {
    ...font(700),
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  of: {
    ...font(600),
    marginLeft: 8,
    color: colors.textFaint,
    letterSpacing: 0,
  },
  label: {
    ...font(400),
    marginTop: -10,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  strip: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  day: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: 'center',
    gap: 6,
  },
  selected: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: colors.teal,
  },
  todayRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  circleMissed: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.warning,
  },
  circleToday: {
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.goldTint,
  },
  circleTodayRest: {
    borderWidth: 2,
    borderColor: colors.gold,
  },
  circleFuture: {
    borderWidth: 2,
    borderColor: colors.dayFutureRing,
  },
  circleRest: {
    backgroundColor: colors.fillWell,
  },
  bang: {
    ...font(700),
    fontSize: 17,
    color: colors.warning,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  dotFuture: {
    backgroundColor: colors.textStrong2,
  },
  letter: {
    ...font(600),
    fontSize: 13,
    color: colors.textSecondary,
  },
  letterToday: {
    ...font(700),
    color: colors.gold,
  },
});
