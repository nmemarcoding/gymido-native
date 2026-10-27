import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import { CAP_BODY, CAP_PILL } from '../../../shared/components/largeText';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, font, motion, radii, spacing, typography } from '../../../shared/theme/tokens';
// Review M4/M5: the v2 image chain (w400 first) and media_type.
import { thumbImageProps } from '../planImages';
import { dayMetaLabel, estimateMinutes, exerciseNotes, formatSetSummary, muscleFocus } from '../libraryFormat';
import PlanIcon from './planIcons';
import { PressOverlay } from './planUi';

const EASE = Easing.bezier(0.4, 0, 0.2, 1);
const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };
// Tablet exercise grid: repeat(auto-fill, minmax(200px, 1fr)), gap 10.
const CARD_MIN = 200;
const CARD_GAP = spacing['2_5'];

export function exerciseLabel(item, position) {
  const exercise = item.exercise ?? {};
  return [`Exercise ${position}: ${exercise.name ?? ''}`, exercise.primary_muscle_group?.name, formatSetSummary(item)].filter(Boolean).join(', ');
}

// §4.4 accordion row (UX H "Workout days"): content appears instantly, the
// chevron turns 180° in 200 ms (instant under reduced motion). Phone: radius
// 24, a 40 number badge (open = gold), rows of 56 photos. Tablet: radius 28
// when open, a 42 badge and a grid of large exercise cards (150 photos with
// the order badge).
export default function DayRow({ day, exercises, isOpen, onToggle, onOpenExercise, tablet = false }) {
  const reducedMotion = useReducedMotion();
  const turn = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      turn.setValue(isOpen ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(turn, { toValue: isOpen ? 1 : 0, duration: motion.durationBase, easing: EASE, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [isOpen, reducedMotion, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const minutes = estimateMinutes(exercises);
  const focus = muscleFocus(exercises).slice(0, 3);
  const title = day.title || `Day ${day.day_number}`;

  return (
    <View testID={`plan-day-${day.id}`} style={[styles.card, tablet && isOpen && styles.cardTabletOpen]}>
      <Pressable
        testID={`plan-day-toggle-${day.id}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={onToggle}
        style={[styles.header, tablet && styles.headerTablet]}
      >
        {({ pressed }) => (
          <>
            <PressOverlay pressed={pressed} radius={0} />
            <View style={[styles.badge, tablet && styles.badgeTablet, isOpen ? styles.badgeOpen : styles.badgeClosed]}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.badgeText, tablet && styles.badgeTextTablet, { color: isOpen ? colors.onGold : colors.textSecondary }]}
              >
                {day.day_number || '•'}
              </Text>
            </View>
            <View style={styles.textColumn}>
              <Text {...CAP_BODY} textBreakStrategy="simple" style={styles.dayTitle}>
                {title}
              </Text>
              <Text {...CAP_BODY} style={styles.meta}>
                {dayMetaLabel(exercises.length, minutes)}
              </Text>
            </View>
            <Animated.View {...HIDDEN} testID={`plan-day-chevron-${day.id}`} style={{ transform: [{ rotate }] }}>
              <PlanIcon name="chevronDown" size={20} color={colors.textMuted} />
            </Animated.View>
          </>
        )}
      </Pressable>
      {isOpen ? (
        <View style={[styles.body, tablet && styles.bodyTablet]}>
          {focus.length ? (
            <View style={styles.focusRow}>
              {focus.map((name) => (
                <View key={name} style={styles.focusChip}>
                  <Text {...CAP_PILL} style={styles.focusText}>
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {exercises.length === 0 ? (
            <View style={styles.emptyDay}>
              <Text {...CAP_BODY} style={styles.emptyDayText}>{`No exercises were returned for ${day.title || 'this day'}.`}</Text>
            </View>
          ) : tablet ? (
            <ExerciseGrid exercises={exercises} onOpenExercise={onOpenExercise} />
          ) : (
            <View style={styles.exerciseList}>
              {exercises.map((item, index) => (
                <ExerciseRow key={item.id} item={item} position={index + 1} onPress={() => onOpenExercise(item)} />
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

// Phone row: radius 20, padding 12, fill-subtle; the 56 photo (or the §8.1
// tile), name 15/600 (one line), the set summary 12 secondary, notes 12/20.
export function ExerciseRow({ item, position, onPress }) {
  const notes = exerciseNotes(item);
  const exercise = item.exercise ?? {};
  return (
    <Pressable
      testID={`plan-exercise-${item.id}`}
      accessibilityRole="link"
      accessibilityLabel={exerciseLabel(item, position)}
      onPress={onPress}
      style={styles.row}
    >
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} radius={radii.lg} />
          <View style={styles.rowTop}>
            <View {...HIDDEN}>
              <ExerciseImage exercise={exercise} {...thumbImageProps(exercise)} size={56} testID={`plan-exercise-image-${item.id}`} />
            </View>
            <View style={styles.textColumn}>
              <Text {...CAP_BODY} numberOfLines={1} ellipsizeMode="tail" style={styles.exerciseName}>
                {exercise.name}
              </Text>
              {notes ? (
                <Text {...CAP_BODY} style={styles.notes}>
                  {notes}
                </Text>
              ) : null}
              <Text {...CAP_BODY} style={styles.setSummary}>
                {formatSetSummary(item)}
              </Text>
            </View>
            <PlanIcon name="chevronRight" size={18} color={colors.textMuted} />
          </View>
        </>
      )}
    </Pressable>
  );
}

function ExerciseGrid({ exercises, onOpenExercise }) {
  const [width, setWidth] = useState(0);
  const columns = width ? Math.max(1, Math.floor((width + CARD_GAP) / (CARD_MIN + CARD_GAP))) : 1;
  const cardWidth = width ? (width - CARD_GAP * (columns - 1)) / columns : '100%';
  return (
    <View testID="plan-exercise-grid" style={styles.grid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {exercises.map((item, index) => (
        <ExerciseCard key={item.id} item={item} position={index + 1} width={cardWidth} onPress={() => onOpenExercise(item)} />
      ))}
    </View>
  );
}

// Tablet card: radius 24, padding 10 10 16, fill-subtle; a 150 photo
// (radius 20) with the order badge, name 19/23/700, muscle 13 secondary,
// the set summary 13 muted.
function ExerciseCard({ item, position, width, onPress }) {
  const exercise = item.exercise ?? {};
  const notes = exerciseNotes(item);
  const muscle = exercise.primary_muscle_group?.name;
  return (
    <Pressable
      testID={`plan-exercise-${item.id}`}
      accessibilityRole="link"
      accessibilityLabel={exerciseLabel(item, position)}
      onPress={onPress}
      style={[styles.exerciseCard, { width }]}
    >
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} radius={radii.xl} />
          <View {...HIDDEN}>
            <ExerciseImage exercise={exercise} {...thumbImageProps(exercise)} size={150} testID={`plan-exercise-image-${item.id}`} style={styles.cardImage} />
            <View style={styles.orderBadge}>
              <Text allowFontScaling={false} style={styles.orderText}>
                {position}
              </Text>
            </View>
          </View>
          <View style={styles.cardText}>
            <View style={styles.textColumn}>
              <Text {...CAP_BODY} textBreakStrategy="simple" style={styles.cardName}>
                {exercise.name}
              </Text>
              {muscle ? (
                <Text {...CAP_BODY} style={styles.cardMuscle}>
                  {muscle}
                </Text>
              ) : null}
              <Text {...CAP_BODY} style={styles.cardSummary}>
                {formatSetSummary(item)}
              </Text>
              {notes ? (
                <Text {...CAP_BODY} style={styles.notes}>
                  {notes}
                </Text>
              ) : null}
            </View>
            <PlanIcon name="chevronRight" size={18} color={colors.textMuted} />
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  cardTabletOpen: {
    borderRadius: radii.xxl,
  },
  // 64+ tall, padding 16 (tablet 16 18).
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
  },
  headerTablet: {
    paddingHorizontal: spacing['4_5'],
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 42 × 42 (the drawn radius 13 has no token: sm 12).
  badgeTablet: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
  },
  badgeOpen: {
    backgroundColor: colors.gold,
  },
  badgeClosed: {
    backgroundColor: colors.fillSkeleton,
  },
  badgeText: {
    ...font(700),
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  badgeTextTablet: {
    fontSize: 15,
    lineHeight: 20,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  dayTitle: {
    ...font(600),
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  meta: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  // 1 px top hairline, padding 12 16 16 (tablet 0 14 14, as drawn).
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
  },
  bodyTablet: {
    paddingHorizontal: spacing['3_5'],
    paddingTop: spacing['3_5'],
    paddingBottom: spacing['3_5'],
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['1_5'],
    marginBottom: spacing[3],
  },
  // 26 tall, pad 0 10, gold tint, 12/600 gold.
  focusChip: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: spacing['2_5'],
    borderRadius: radii.full,
    backgroundColor: colors.goldTint,
  },
  focusText: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.gold,
  },
  exerciseList: {
    gap: spacing[2],
  },
  row: {
    borderRadius: radii.lg,
    backgroundColor: colors.fillWell,
    padding: spacing[3],
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  exerciseName: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  notes: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 12,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  setSummary: {
    ...typography.caption,
    marginTop: spacing['0_5'],
    color: colors.textSecondary,
  },
  emptyDay: {
    borderRadius: radii.lg,
    backgroundColor: colors.fillWell,
    padding: spacing[4],
  },
  emptyDayText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  exerciseCard: {
    gap: spacing[3],
    paddingTop: spacing['2_5'],
    paddingHorizontal: spacing['2_5'],
    paddingBottom: spacing[4],
    borderRadius: radii.xl,
    backgroundColor: colors.fillWell,
  },
  // 150 tall, radius 20 (the drawn 18 folds into 20).
  cardImage: {
    width: '100%',
    height: 150,
    borderRadius: radii.lg,
  },
  // 30 × 30 at left 5 top 5 (the drawn radius 10: sm 12; 0.7 ink → on-photo-strong).
  orderBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onPhotoStrong,
  },
  orderText: {
    ...font(700),
    fontSize: 13,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  cardText: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing['1_5'],
  },
  cardName: {
    ...font(700),
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: -0.38,
    color: colors.textPrimary,
  },
  cardMuscle: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  cardSummary: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
