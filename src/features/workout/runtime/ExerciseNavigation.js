import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import BlurLayer from '../../../shared/components/BlurLayer';
import GradientFill from '../../../shared/components/GradientFill';
import RemoteImage from '../../../shared/components/RemoteImage';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { exerciseName } from './sessionMath';

const GOLD = [colors.brand300, colors.brand500];
const SHEET_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// §19.8: swipe up anywhere on the bar (dy < −45 and |dy| > |dx|) opens the sheet.
export function isOpenSheetSwipe(gesture) {
  return gesture.dy < -45 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
}

// Sheet header drag: far or fast enough down closes it, else it springs back.
// Used on release AND on termination (another responder, e.g. the panel's
// ScrollView, took the gesture), so the panel never stays part-way down.
export function shouldDismissSheet(gesture) {
  return gesture.dy > 120 || gesture.vy > 1.2;
}

// A PanResponder created ONCE whose handlers always call the latest props.
// The runtime re-renders every 0.5–1 s (rest and elapsed ticks); recreating
// the responder mid-gesture restarts gestureState.dy at 0, which made slow
// swipes flaky. (ported from the 28 Sep build: callbacks held in refs)
function useStablePanResponder(config) {
  const latest = useRef(config);
  latest.current = config;
  const responder = useRef(null);
  if (responder.current === null) {
    const forward = {};
    for (const name of Object.keys(config)) {
      forward[name] = (...args) => latest.current[name]?.(...args);
    }
    responder.current = PanResponder.create(forward);
  }
  return responder.current;
}

function SegmentFill({ ratio }) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(ratio)).current;
  useEffect(() => {
    if (reducedMotion) {
      scale.setValue(ratio);
      return undefined;
    }
    const animation = Animated.timing(scale, { toValue: ratio, duration: 300, easing: EASE_OUT, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [ratio, reducedMotion, scale]);
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* §19.8: a full-width view scaled by scaleX from the left, never a width. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.segmentFill, { transform: [{ scaleX: scale }], transformOrigin: 'left' }]}>
        <GradientFill angle={90} colors={GOLD} />
      </Animated.View>
    </View>
  );
}

// §19.8, pinned to the bottom (§19.0); it replaces the tab bar for the session.
export function WorkoutExerciseNav({ exercises, viewingIndex, onView, onOpenSheet, onHeight }) {
  const insets = useSafeAreaInsets();
  const swipe = useStablePanResponder({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy < -10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => {
      if (isOpenSheetSwipe(gesture)) {
        onOpenSheet();
      }
    },
  });
  return (
    <View
      testID="exercise-nav"
      {...swipe.panHandlers}
      onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}
      style={[styles.nav, { paddingBottom: Math.max(12, insets.bottom) }]}
    >
      <BlurLayer blurPx={24} />
      <View style={[StyleSheet.absoluteFill, styles.glassFill]} />
      <View style={styles.navInner}>
        <View style={styles.navRow}>
          <Text numberOfLines={1} textBreakStrategy="simple" style={styles.navLabel}>{`Exercise ${viewingIndex + 1} of ${exercises.length}`}</Text>
          <Pressable testID="exercise-nav-all" accessibilityRole="button" onPress={onOpenSheet} hitSlop={12}>
            <Text numberOfLines={1} textBreakStrategy="simple" style={styles.navAll}>{`All (${exercises.length})`}</Text>
          </Pressable>
        </View>
        <View style={styles.segments}>
          {exercises.map((exercise, index) => {
            const sets = exercise.sets ?? [];
            const done = sets.filter((set) => set.is_completed).length;
            const viewed = index === viewingIndex;
            return (
              <Pressable
                key={exercise.id}
                testID={`exercise-nav-segment-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Exercise ${index + 1}`}
                accessibilityState={{ selected: viewed }}
                onPress={() => onView(index)}
                hitSlop={{ top: 12, bottom: 12 }}
                style={[styles.segment, viewed && styles.segmentViewed]}
              >
                <SegmentFill ratio={sets.length > 0 ? done / sets.length : 0} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// §19.7 "All Exercises". `currentIndex` is the ACTIVE exercise.
export function ExerciseSheet({ open, exercises, muscleGroups, activeMuscle, onMuscle, currentIndex, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) {
      fade.setValue(0);
      slide.setValue(0);
      drag.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      fade.setValue(1);
      slide.setValue(1);
      return undefined;
    }
    const animation = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 1, duration: 320, easing: SHEET_EASE, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [open, reducedMotion, fade, slide, drag]);

  // Drag the header down past a threshold to dismiss (a standard bottom sheet).
  const settle = (_, gesture) => {
    if (shouldDismissSheet(gesture)) {
      onClose();
    } else {
      Animated.timing(drag, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  };
  const headerPan = useStablePanResponder({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4,
    onPanResponderMove: (_, gesture) => drag.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: settle,
    onPanResponderTerminate: settle,
  });

  const visible = exercises
    .map((exercise, idx) => ({ exercise, idx }))
    .filter(({ exercise }) => activeMuscle === 'all' || exercise.exercise?.primary_muscle_group?.name === activeMuscle);
  const translateY = Animated.add(slide.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }), drag);

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <BlurLayer blurPx={8} overApp />
        <Pressable style={[StyleSheet.absoluteFill, styles.sheetScrim]} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <View pointerEvents="box-none" style={styles.sheetHost}>
        <Animated.View testID="exercise-sheet" style={[styles.panel, { maxHeight: height * 0.85, transform: [{ translateY }] }]}>
          <BlurLayer blurPx={24} overApp />
          <View style={[StyleSheet.absoluteFill, styles.glassFill]} />
          <ScrollView contentContainerStyle={[styles.panelContent, { paddingBottom: Math.max(32, insets.bottom) }]}>
            <View {...headerPan.panHandlers}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <Text textBreakStrategy="simple" accessibilityRole="header" style={styles.sheetTitle}>
                  All Exercises
                </Text>
                <Pressable
                  testID="exercise-sheet-close"
                  accessibilityRole="button"
                  onPress={onClose}
                  style={({ pressed }) => [styles.closePill, pressed && styles.closePressed]}
                >
                  <Text style={styles.closeText}>Close</Text>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth={3} strokeLinecap="round">
                    <Path d="M18 6 6 18M6 6l12 12" />
                  </Svg>
                </Pressable>
              </View>
            </View>
            {muscleGroups.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
                {['all', ...muscleGroups].map((group) => {
                  const active = group === activeMuscle;
                  return (
                    <Pressable
                      key={group}
                      testID={`exercise-sheet-chip-${group}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => onMuscle(group)}
                      style={({ pressed }) => [styles.chip, active ? styles.chipActive : pressed ? styles.chipPressed : styles.chipIdle]}
                    >
                      <Text style={[styles.chipText, { color: active ? colors.onNavy : colors.textSecondary }]}>{group === 'all' ? 'All' : group}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            <View style={styles.cards}>
              {visible.length === 0 ? <Text style={styles.emptyText}>No exercises in this group.</Text> : null}
              {visible.map(({ exercise, idx }) => (
                <SheetCard key={exercise.id} exercise={exercise} idx={idx} current={idx === currentIndex} onSelect={() => onSelect(idx)} />
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SheetCard({ exercise, idx, current, onSelect }) {
  const sets = exercise.sets ?? [];
  const done = sets.filter((set) => set.is_completed).length;
  const allDone = sets.length > 0 && done === sets.length;
  const gold = current || allDone;
  const muscle = exercise.exercise?.primary_muscle_group?.name;
  const url = exercise.exercise?.thumbnail?.url;
  const label = allDone ? 'View' : current ? 'Resume' : 'Go';
  const goldButton = current && !allDone;
  return (
    <Pressable testID={`exercise-sheet-card-${idx}`} accessibilityRole="button" onPress={onSelect}>
      {({ pressed }) => (
        <View style={[styles.card, current && styles.cardCurrent, pressed && styles.cardPressed]}>
          <View style={styles.cardRow}>
            <View style={styles.thumb}>
              {url ? <RemoteImage url={url} style={styles.thumbImage} /> : <Text numberOfLines={1} textBreakStrategy="simple" style={styles.thumbNumber}>{idx + 1}</Text>}
              <View style={[styles.numberBadge, !gold && styles.numberBadgePlain]}>
                <View style={[StyleSheet.absoluteFill, styles.badgeClip, { opacity: gold ? 1 : 0 }]}>
                  <GradientFill angle={135} colors={GOLD} />
                </View>
                {allDone ? (
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.navy} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 6 9 17l-5-5" />
                  </Svg>
                ) : (
                  <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.numberText, { color: gold ? colors.navy : colors.textPrimary }]}>{idx + 1}</Text>
                )}
              </View>
            </View>
            <View style={styles.cardText}>
              <Text textBreakStrategy="simple" numberOfLines={2} ellipsizeMode="tail" style={styles.cardName}>
                {exerciseName(exercise)}
              </Text>
              {muscle ? (
                <Text numberOfLines={1} style={styles.cardMuscle}>
                  {muscle}
                </Text>
              ) : null}
            </View>
            <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.count, { color: allDone ? colors.brand700 : colors.textMuted }]}>{`${done}/${sets.length}`}</Text>
          </View>
          <View style={styles.cardBottom}>
            <View style={styles.setsChip}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth={2.5} strokeLinecap="round">
                <Path d="M6.5 6.5h11M6.5 12h11M6.5 17.5h11" />
              </Svg>
              <Text style={styles.setsChipText}>{`${sets.length} ${sets.length === 1 ? 'Set' : 'Sets'}`}</Text>
            </View>
            <Pressable
              testID={`exercise-sheet-action-${idx}`}
              accessibilityRole="button"
              onPress={onSelect}
              style={({ pressed: buttonPressed }) => [
                styles.cardAction,
                goldButton ? styles.cardActionGold : styles.cardActionPlain,
                buttonPressed && (goldButton ? styles.sink : styles.cardActionPlainPressed),
              ]}
            >
              {({ pressed: buttonPressed }) => (
                <>
                  <View style={[StyleSheet.absoluteFill, styles.actionClip, { opacity: goldButton ? 1 : 0 }]}>
                    <GradientFill colors={[colors.brand300, colors.brand400]} />
                    <View style={[StyleSheet.absoluteFill, { opacity: buttonPressed ? 1 : 0 }]}>
                      <GradientFill colors={[colors.brand400, colors.brand500]} />
                    </View>
                  </View>
                  <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.cardActionText, { color: goldButton ? colors.navy : colors.textPrimary }]}>{label}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: colors.glassEdge,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  glassFill: {
    backgroundColor: colors.glassFill,
  },
  navInner: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 1.92,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  navAll: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  segments: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 6,
    overflow: 'hidden',
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
  },
  segmentViewed: {
    height: 10,
  },
  segmentFill: {
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  sheetScrim: {
    backgroundColor: colors.scrim,
  },
  sheetHost: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    boxShadow: shadows.sheetUp,
  },
  panelContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 6,
    marginBottom: 16,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    boxShadow: shadows.press,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  closePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 16,
    boxShadow: shadows.emboss,
  },
  closePressed: {
    backgroundColor: colors.border,
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  closeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipsScroll: {
    marginHorizontal: -20,
    marginBottom: 16,
  },
  chips: {
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  chip: {
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: 16,
  },
  chipActive: {
    // v2 "on" chip: light fill, dark ink.
    backgroundColor: colors.textPrimary,
    boxShadow: shadows.lift2,
  },
  chipIdle: {
    backgroundColor: colors.surfaceMuted,
    boxShadow: shadows.emboss,
  },
  chipPressed: {
    backgroundColor: colors.border,
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  chipText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  cards: {
    gap: 12,
  },
  emptyText: {
    paddingVertical: 32,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  card: {
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    padding: 12,
    boxShadow: `${shadows.lift2}, ${shadows.ringInk}`,
  },
  cardCurrent: {
    borderWidth: 2,
    borderColor: colors.brand400,
    padding: 10,
  },
  cardPressed: {
    transform: [{ translateY: -2 }],
    boxShadow: shadows.lift3,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thumb: {
    width: 96,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    boxShadow: shadows.press,
  },
  thumbImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  thumbNumber: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textMuted,
  },
  numberBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 28,
    height: 28,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.lift1,
  },
  numberBadgePlain: {
    backgroundColor: colors.surface,
  },
  badgeClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  numberText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  cardText: {
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
    lineHeight: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
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
    boxShadow: shadows.emboss,
  },
  setsChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  // The button's border/background/shadow change with state and press, so
  // it never clips (Android stops drawing the children of a clipping, rounded
  // view whose background changes); actionClip clips the gold layers.
  cardAction: {
    height: 44,
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingHorizontal: 24,
  },
  actionClip: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  cardActionGold: {
    boxShadow: shadows.brand,
  },
  cardActionPlain: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.lift1,
  },
  cardActionPlainPressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  sink: {
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  cardActionText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
});
