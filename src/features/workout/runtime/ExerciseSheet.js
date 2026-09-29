import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import RemoteImage from '../../../shared/components/RemoteImage';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { ColorPressable } from '../../plans/components/PlanBits';
import {
  PRESS_SHADOW,
  SHADOW_BRAND,
  SHADOW_EMBOSS,
  SHADOW_LIFT_2,
  SHADOW_LIFT_2_HOVER,
} from '../components/hubChrome';
import { exerciseName, muscleGroups } from './runtimeRules';

// ExerciseSheet, "All Exercises" (§19.7). A card list, not a text list.
//
// The two things easiest to get wrong, both pinned by tests:
// - the gold highlight follows the ACTIVE exercise, never the one being browsed;
// - `idx` is the exercise's position in the SESSION, so badge numbers keep their
//   gaps under a filter (2, 5, 7) instead of renumbering.
export default function ExerciseSheet({
  visible,
  session,
  muscle,
  activeIndex,
  onChangeMuscle,
  onSelect,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const exercises = session?.exercises || [];
  const groups = muscleGroups(session);

  // §19.7: already-filtered entries carrying their session index.
  const visibleExercises = exercises
    .map((exercise, index) => ({ exercise, index }))
    .filter(
      ({ exercise }) =>
        muscle === 'all' || exercise?.exercise?.primary_muscle_group?.name === muscle
    );

  // `activeIdx === -1 ? exercises.length - 1 : activeIdx` (§26).
  const currentIndex = activeIndex >= 0 ? activeIndex : exercises.length - 1;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close exercises" onPress={onClose} style={styles.scrimFill} />
        <View
          testID="exercise-sheet"
          style={[styles.panel, { paddingBottom: Math.max(32, insets.bottom) }]}
        >
          <BlurView
            tint="light"
            intensity={20}
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.panelVeil]} />

          <ScrollView contentContainerStyle={styles.panelContent}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>All Exercises</Text>
              <ColorPressable
                testID="sheet-close"
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                colorsFor={(pressed) => ({
                  backgroundColor: pressed ? colors.border : colors.surfaceMuted,
                })}
                style={({ pressed }) => [styles.closePill, pressed && styles.sunk]}
              >
                <Text style={styles.closeLabel}>Close</Text>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18 6 6 18M6 6l12 12"
                    stroke={colors.textSecondary}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                </Svg>
              </ColorPressable>
            </View>

            {groups.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroller}
                contentContainerStyle={styles.chipRow}
              >
                {['all', ...groups].map((group) => {
                  const active = muscle === group;
                  return (
                    <ColorPressable
                      key={group}
                      testID={`sheet-chip-${group}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => onChangeMuscle(group)}
                      colorsFor={(pressed) => ({
                        // §19.7: the active chip is NAVY with white text — the one
                        // place the app uses navy as a selected state, not gold.
                        backgroundColor: active
                          ? colors.navy
                          : pressed
                            ? colors.border
                            : colors.surfaceMuted,
                      })}
                      style={({ pressed }) => [
                        styles.chip,
                        active ? styles.chipActive : styles.chipInactive,
                        pressed && !active && styles.sunk,
                      ]}
                    >
                      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                        {group === 'all' ? 'All' : group}
                      </Text>
                    </ColorPressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {visibleExercises.length ? (
              <View style={styles.cardList}>
                {visibleExercises.map(({ exercise, index }) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    index={index}
                    isCurrent={index === currentIndex}
                    onSelect={() => onSelect(index)}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>No exercises in this group.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ExerciseCard({ exercise, index, isCurrent, onSelect }) {
  const [imageFailed, setImageFailed] = useState(false);
  const sets = exercise?.sets || [];
  const total = sets.length;
  const done = sets.filter((set) => set.is_completed).length;
  const allDone = total > 0 && done === total;
  const muscleName = exercise?.exercise?.primary_muscle_group?.name;
  const thumbnail = exercise?.exercise?.thumbnail?.url;
  // §19.7 (a) vs (b): the number stands in only when there was never a URL. A
  // URL that fails leaves the well empty, so a transient network failure cannot
  // masquerade as "no image was ever set".
  const showsNumberInWell = !thumbnail;
  const label = allDone ? 'View' : isCurrent ? 'Resume' : 'Go';

  return (
    <Pressable
      testID={`sheet-exercise-${exercise.id}`}
      accessibilityRole="button"
      onPress={onSelect}
      style={[styles.card, isCurrent && styles.cardCurrent]}
    >
      <View style={styles.cardTop}>
        <View style={styles.well}>
          {showsNumberInWell ? (
            <Text style={styles.wellNumber}>{index + 1}</Text>
          ) : imageFailed ? null : (
            <RemoteImage
              testID={`sheet-thumb-${exercise.id}`}
              uri={thumbnail}
              onExhausted={() => setImageFailed(true)}
              resizeMode="cover"
              style={styles.wellImage}
            />
          )}
          <View
            testID={`sheet-badge-${exercise.id}`}
            style={[styles.badge, isCurrent || allDone ? styles.badgeGold : styles.badgePlain]}
          >
            {allDone ? (
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 6 9 17l-5-5"
                  stroke={colors.navy}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : (
              <Text style={[styles.badgeText, (isCurrent || allDone) && styles.badgeTextGold]}>
                {index + 1}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.cardColumn}>
          {/* §19.7: two lines then ellipsis — line-clamp-2, not truncate. */}
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.cardName}>
            {exerciseName(exercise)}
          </Text>
          {muscleName ? (
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.cardMuscle}>
              {muscleName}
            </Text>
          ) : null}
        </View>

        {/* Completed sets over total sets for this exercise — never exercises,
            never reps. The same pair the ExerciseStage ring shows. */}
        <Text
          testID={`sheet-count-${exercise.id}`}
          style={[styles.count, allDone && styles.countDone]}
        >
          {`${done}/${total}`}
        </Text>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.setsChip}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6.5 6.5h11M6.5 12h11M6.5 17.5h11"
              stroke={colors.textSecondary}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.setsLabel}>{`${total} ${total === 1 ? 'Set' : 'Sets'}`}</Text>
        </View>

        <ColorPressable
          testID={`sheet-action-${exercise.id}`}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onSelect}
          colorsFor={(pressed) => ({
            backgroundColor: isCurrent
              ? 'rgba(0,0,0,0)'
              : pressed
                ? colors.surfaceMuted
                : colors.surface,
          })}
          style={({ pressed }) => [
            styles.action,
            isCurrent ? styles.actionCurrent : styles.actionOther,
            pressed && styles.sunk,
          ]}
        >
          <Text style={[styles.actionLabel, isCurrent && styles.actionLabelCurrent]}>{label}</Text>
        </ColorPressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17,24,39,0.50)',
  },
  scrimFill: {
    ...StyleSheet.absoluteFill,
  },
  panel: {
    maxHeight: '85%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    // shadow-lift-3.
    boxShadow: SHADOW_LIFT_2_HOVER,
  },
  panelVeil: {
    backgroundColor: 'rgba(255,255,255,0.80)',
  },
  panelContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: radii.full,
    alignSelf: 'center',
    backgroundColor: colors.surfaceMuted,
    boxShadow: PRESS_SHADOW,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  closePill: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    boxShadow: SHADOW_EMBOSS,
  },
  closeLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  // Bleeds to the panel edges so the chips scroll edge to edge.
  chipScroller: {
    marginHorizontal: -20,
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  chip: {
    height: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: 16,
  },
  chipActive: {
    boxShadow: SHADOW_LIFT_2,
  },
  chipInactive: {
    boxShadow: SHADOW_EMBOSS,
  },
  chipLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: '#ffffff',
  },
  cardList: {
    gap: 12,
  },
  card: {
    borderRadius: 28,
    padding: 12,
    backgroundColor: colors.surface,
    boxShadow: SHADOW_LIFT_2,
  },
  // An INSET ring: a border drawn inside the radius, not an outer shadow.
  cardCurrent: {
    borderWidth: 2,
    borderColor: colors.brand400,
    borderRadius: 26,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  well: {
    width: 96,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    boxShadow: PRESS_SHADOW,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellImage: {
    width: '100%',
    height: '100%',
  },
  wellNumber: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textMuted,
  },
  badge: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 28,
    height: 28,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.lift1,
  },
  badgeGold: {
    experimental_backgroundImage: 'linear-gradient(135deg, #f7ce4f, #dda000)',
  },
  badgePlain: {
    backgroundColor: colors.surface,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  badgeTextGold: {
    color: colors.navy,
  },
  cardColumn: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  cardName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  cardMuscle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  count: {
    flexShrink: 0,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  countDone: {
    color: colors.brand600,
  },
  cardBottom: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  setsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    boxShadow: SHADOW_EMBOSS,
  },
  setsLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  action: {
    height: 44,
    justifyContent: 'center',
    borderRadius: radii.xl,
    paddingHorizontal: 24,
  },
  actionCurrent: {
    // `to bottom`, as the web's bg-linear-to-b (§19.10.1).
    experimental_backgroundImage: 'linear-gradient(to bottom, #f7ce4f, #f4b400)',
    boxShadow: SHADOW_BRAND,
  },
  actionOther: {
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: shadows.lift1,
  },
  actionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  actionLabelCurrent: {
    color: colors.navy,
  },
  sunk: {
    boxShadow: PRESS_SHADOW,
    transform: [{ translateY: 1 }],
  },
  empty: {
    paddingVertical: 32,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
