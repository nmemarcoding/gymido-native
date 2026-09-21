import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, plansMotion, radii, shadows, textStyles } from '../../../shared/theme/tokens';
import { estimateMinutes, formatSetSummary, muscleFocus, plural } from '../planRules';
import { ColorPressable } from './PlanBits';

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

function Chevron({ open }) {
  const reducedMotion = useReducedMotion();
  const [rotation] = useState(() => new Animated.Value(open ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      rotation.setValue(open ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(rotation, {
      toValue: open ? 1 : 0,
      duration: plansMotion.chevronMs,
      easing: EASE,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [open, reducedMotion, rotation]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return (
    <Animated.Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.chevron, { transform: [{ rotate }] }]}
    >
      ⌄
    </Animated.Text>
  );
}

// ExerciseRow (§4.4). The muscle code overflows its 44px tile uncropped (⚠11):
// the tile is drawn before the name column so the column paints over it.
function ExerciseRow({ item }) {
  const code = item?.exercise?.primary_muscle_group?.code || 'EX';
  return (
    <View style={styles.exerciseRow}>
      <View style={styles.codeTile}>
        <View style={styles.codeFrame} pointerEvents="none">
          <Text numberOfLines={1} style={styles.codeText}>
            {code}
          </Text>
        </View>
      </View>
      <View style={styles.exerciseColumn}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={[textStyles.exerciseName, styles.primary]}>
          {item?.exercise?.name}
        </Text>
        <Text style={styles.setSummary}>{formatSetSummary(item)}</Text>
      </View>
    </View>
  );
}

// DayRow (§4.4): accordion row; the parent keeps only one open.
export default function DayRow({ day, exercises, isOpen, onToggle }) {
  const minutes = estimateMinutes(exercises);
  const focus = muscleFocus(exercises).slice(0, 3);
  const title = day.title || `Day ${day.day_number}`;

  return (
    <View testID={`day-row-${day.id}`} style={styles.card}>
      <ColorPressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={onToggle}
        colorsFor={(pressed) => ({ backgroundColor: pressed ? colors.pressedTint : 'rgba(239,241,244,0)' })}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.numberBadge, isOpen ? styles.numberBadgeOpen : styles.numberBadgeClosed]}>
            <Text style={[styles.numberText, { color: isOpen ? colors.navy : colors.textSecondary }]}>
              {day.day_number || '•'}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={[textStyles.dayTitle, styles.primary]}>
              {title}
            </Text>
            <Text style={styles.meta}>
              {`${exercises.length} ${plural(exercises.length, 'exercise')}`}
              {minutes ? ` · ~${minutes} min` : ''}
            </Text>
          </View>
        </View>
        <Chevron open={isOpen} />
      </ColorPressable>

      {isOpen ? (
        <View style={styles.body}>
          {focus.length ? (
            <View style={styles.focusRow}>
              {focus.map((name) => (
                <View key={name} style={styles.focusChip}>
                  <Text style={styles.focusText}>{name}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.exerciseList}>
            {exercises.map((item) => (
              <ExerciseRow key={item.id} item={item} />
            ))}
            {exercises.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  {`No exercises were returned for ${day.title || 'this day'}.`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const CODE_FRAME_WIDTH = 200;

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.plansCard,
    overflow: 'hidden',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
    minWidth: 0,
  },
  numberBadge: {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadgeOpen: {
    backgroundColor: colors.brand400,
  },
  numberBadgeClosed: {
    backgroundColor: colors.surfaceMuted,
  },
  numberText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  headerText: {
    flexShrink: 1,
    minWidth: 0,
  },
  primary: {
    color: colors.textPrimary,
  },
  meta: {
    ...textStyles.meta,
    color: colors.textMuted,
  },
  chevron: {
    flexShrink: 0,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  focusChip: {
    borderRadius: radii.full,
    backgroundColor: colors.brand50,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  focusText: {
    ...textStyles.pill,
    color: colors.brand700,
  },
  exerciseList: {
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  codeTile: {
    flexShrink: 0,
    width: 44,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceMuted,
    overflow: 'visible',
  },
  codeFrame: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: CODE_FRAME_WIDTH,
    left: (44 - CODE_FRAME_WIDTH) / 2,
    justifyContent: 'center',
  },
  codeText: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
    color: colors.brand600,
  },
  exerciseColumn: {
    flex: 1,
    minWidth: 0,
  },
  setSummary: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  emptyBox: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
