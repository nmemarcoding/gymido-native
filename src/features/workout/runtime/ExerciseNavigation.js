import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import BlurLayer from '../../../shared/components/BlurLayer';
import GradientFill from '../../../shared/components/GradientFill';
import Chip from '../../../shared/components/Chip';
import ExerciseImage, { muscleColor, TILE_ALPHA } from '../../../shared/components/ExerciseImage';
import { usesSolidGlass } from '../../../shared/components/GlassSurface';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useSheetFocus } from '../../../shared/hooks/useSheetFocus';
import { blur, breakpoints, colors, font, gradients, radii, shadows, spacing, textScale, typography } from '../../../shared/theme/tokens';
import { exerciseName, setsWord } from './sessionMath';

const GOLD = [colors.brand300, colors.brand500];
const SHEET_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
// The sheet's drawn sizes (UX C §All exercises sheet / §Tablet); radii 22,
// 26, 32, 40 are off the 5-step scale ([no token], built as drawn).
const SHEET_RADIUS = 32;
const SHEET_TABLET_RADIUS = 40;
const SHEET_PHONE_MAX = 660;
const SHEET_TABLET_MAX = 1040;
const ROW_RADIUS = 22;
const THUMB = 52;
const CARD_HEIGHT = 220;
const CARD_CURRENT_HEIGHT = 250;
const CARD_RADIUS = 26;
// ExerciseImage sizes its tile glyph at ≈ 0.36–0.44 × size: a 150 box keeps
// the failed-photo icon readable on the big cards.
const CARD_GLYPH_BOX = 150;
// The current row's drawn 160° gradient: its start is surface-raised + the 4 %
// white overlay (UX §8.4: the drawn start = raised, pressed), its end surface-card-2.
// Drawn as the raised → card-2 gradient under a 4 % → clear white wash.
export const CURRENT_ROW_FILL = Object.freeze({ angle: 160, colors: Object.freeze([colors.surfaceRaised, colors.surfaceCard2]) });
export const CURRENT_ROW_WASH = Object.freeze({ angle: 160, colors: Object.freeze([colors.pressOverlay, colors.sheenClear]) });

// Large text (UX §9) for the All exercises sheet: role caps; titles wrap by
// word (max 3 lines) and a single long word shrinks the title.
const SHEET_TITLE = Object.freeze({
  textBreakStrategy: 'simple',
  maxFontSizeMultiplier: textScale.title,
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
});
const SHEET_DISPLAY = Object.freeze({ ...SHEET_TITLE, maxFontSizeMultiplier: textScale.display });
const BODY_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body });
const PILL_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.pill });
const BADGE_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.badge });

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
// v2 Phase 2 C4 (UX C §All exercises sheet / §Tablet): LOOK only. Phone: a
// glass bottom sheet with the ND-5 subtitle "{plan} · n/m sets done" and
// 52 px rows; tablet (≥ 768): the SAME sheet (ND-6: never a centred dialog)
// with a 2-column photo-card grid, the current card spanning both columns at
// its session position. Exercise images: a photo URL → ExerciseImage (its
// failed state is the muscle tile + workout icon, its loading state the
// skeleton); NO URL → the tile with the ROW NUMBER (kept as drawn).
// Focus (PM parity rule): the title gets focus on open; `returnFocusRef`
// (the "All (n)" control that opened it) gets it back on close; Android back
// closes (onRequestClose); the panel is modal for screen readers.
export function sheetProgress(exercises) {
  let done = 0;
  let total = 0;
  exercises.forEach((exercise) => {
    const sets = exercise.sets ?? [];
    total += sets.length;
    done += sets.filter((set) => set.is_completed).length;
  });
  return { done, total };
}

// ND-5: "{plan name} · {done}/{total} sets done" (SessionChrome's numbers);
// without a plan name only the count.
export function sheetSubtitle(planName, exercises) {
  const { done, total } = sheetProgress(exercises);
  const count = `${done}/${total} ${setsWord(total)} done`;
  return planName ? `${planName} · ${count}` : count;
}

export function setsLabel(count) {
  return `${count} ${count === 1 ? 'Set' : 'Sets'}`;
}

// The row's state and its texts. `View` when every set is done (even on the
// current exercise), `Resume` on the current one, else `Go` (code).
export function sheetRowState(exercise, current) {
  const sets = exercise.sets ?? [];
  const done = sets.filter((set) => set.is_completed).length;
  const allDone = sets.length > 0 && done === sets.length;
  const kind = allDone ? 'complete' : current ? 'current' : 'other';
  const name = exerciseName(exercise);
  const muscle = exercise.exercise?.primary_muscle_group?.name || '';
  const stateWord = kind === 'complete' ? ', complete' : kind === 'current' ? ', current' : '';
  return {
    kind,
    done,
    total: sets.length,
    name,
    muscle,
    action: kind === 'complete' ? 'View' : kind === 'current' ? 'Resume' : 'Go',
    accessibilityLabel: `${name}, ${done} of ${sets.length} sets done${stateWord}`,
  };
}

export function ExerciseSheet({
  open,
  exercises,
  muscleGroups,
  activeMuscle,
  onMuscle,
  currentIndex,
  onSelect,
  onClose,
  planName,
  returnFocusRef,
}) {
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  // UX §9 reflow past 1.3×: one card column, trailing actions below the text,
  // and the chip row wraps instead of scrolling sideways.
  const stacked = fontScale > textScale.reflowAbove;
  // glass-strong + blur 24 (UX §8.4); the low-end Android fallback stays the
  // solid glass (no blur).
  const solidGlass = usesSolidGlass();
  const reducedMotion = useReducedMotion();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const titleRef = useRef(null);

  useSheetFocus(open, { initialRef: titleRef, returnRef: returnFocusRef });

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
  // Phone max 660 (board) within 85 % of the window; tablet up to 1040.
  const maxHeight = Math.min(tablet ? SHEET_TABLET_MAX : SHEET_PHONE_MAX, height * (tablet ? 0.88 : 0.85));

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <BlurLayer blurPx={tablet ? 6 : 8} overApp />
        <Pressable style={[StyleSheet.absoluteFill, styles.sheetScrim]} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <View pointerEvents="box-none" style={styles.sheetHost}>
        <Animated.View
          testID="exercise-sheet"
          accessibilityViewIsModal
          style={[styles.panel, tablet && styles.panelTablet, { maxHeight, transform: [{ translateY }] }]}
        >
          {solidGlass ? null : <BlurLayer blurPx={blur.glassStrong} overApp />}
          <View
            testID="exercise-sheet-fill"
            style={[StyleSheet.absoluteFill, solidGlass ? styles.panelFillSolid : styles.panelFill]}
          />
          <ScrollView
            contentContainerStyle={[
              styles.panelContent,
              tablet && styles.panelContentTablet,
              { paddingBottom: Math.max(tablet ? 32 : 32, insets.bottom + 12) },
            ]}
          >
            <View {...headerPan.panHandlers}>
              <View
                testID="exercise-sheet-handle"
                style={[styles.handle, tablet && styles.handleTablet]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <View style={[styles.sheetHeader, tablet && styles.sheetHeaderTablet]}>
                <View style={styles.sheetHeaderText}>
                  <Text
                    {...(tablet ? SHEET_DISPLAY : SHEET_TITLE)}
                    ref={titleRef}
                    testID="exercise-sheet-title"
                    accessibilityRole="header"
                    style={tablet ? styles.sheetTitleTablet : styles.sheetTitle}
                  >
                    All Exercises
                  </Text>
                  {/* ND-5 applies to the phone only (the tablet board draws none). */}
                  {tablet ? null : (
                    <Text {...BODY_TEXT} testID="exercise-sheet-subtitle" style={styles.sheetSubtitle}>
                      {sheetSubtitle(planName, exercises)}
                    </Text>
                  )}
                </View>
                <Pressable
                  testID="exercise-sheet-close"
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onClose}
                  hitSlop={tablet ? 0 : 2}
                  style={[styles.closePill, tablet && styles.closePillTablet]}
                >
                  {({ pressed }) => (
                    <>
                      {pressed ? <PressOverlay testID="exercise-sheet-close-pressed" /> : null}
                      <Text {...BODY_TEXT} style={[styles.closeText, tablet && styles.closeTextTablet]}>
                        Close
                      </Text>
                      <Svg
                        width={14}
                        height={14}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={colors.textSecondary}
                        strokeWidth={3}
                        strokeLinecap="round"
                      >
                        <Path d="M18 6 6 18M6 6l12 12" />
                      </Svg>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
            {muscleGroups.length > 0
              ? (() => {
                  const chips = ['all', ...muscleGroups].map((group) => (
                    <Chip
                      key={group}
                      testID={`exercise-sheet-chip-${group}`}
                      label={group === 'all' ? 'All' : group}
                      selected={group === activeMuscle}
                      onPress={() => onMuscle(group)}
                      style={tablet ? styles.chipTablet : null}
                    />
                  ));
                  // Past 1.3× the chips wrap: nothing hides off-screen (UX §9).
                  return stacked ? (
                    <View
                      testID="exercise-sheet-chips"
                      accessibilityLabel="Muscle group"
                      style={[styles.chipsWrap, tablet && styles.chipsWrapTablet]}
                    >
                      {chips}
                    </View>
                  ) : (
                    <ScrollView
                      testID="exercise-sheet-chips"
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={[styles.chipsScroll, tablet && styles.chipsScrollTablet]}
                      contentContainerStyle={styles.chips}
                      accessibilityLabel="Muscle group"
                    >
                      {chips}
                    </ScrollView>
                  );
                })()
              : null}
            <View testID="exercise-sheet-list" style={[styles.cards, tablet && styles.grid]}>
              {visible.length === 0 ? (
                <Text {...BODY_TEXT} style={styles.emptyText}>
                  No exercises in this group.
                </Text>
              ) : null}
              {visible.map(({ exercise, idx }) =>
                tablet ? (
                  <SheetPhotoCard
                    key={exercise.id}
                    exercise={exercise}
                    idx={idx}
                    current={idx === currentIndex}
                    stacked={stacked}
                    onSelect={() => onSelect(idx)}
                  />
                ) : (
                  <SheetRow
                    key={exercise.id}
                    exercise={exercise}
                    idx={idx}
                    current={idx === currentIndex}
                    stacked={stacked}
                    onSelect={() => onSelect(idx)}
                  />
                ),
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function CheckGlyph({ size = 12 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.onGold}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

// No photo URL: the tile with the ROW NUMBER (kept as drawn). The phone tile
// is the neutral fill; the tablet card is tinted with the muscle colour.
// The v2 state rule: pressed = the rest look + a 4 % overlay (white on dark,
// ink on gold); never a new alpha. Every parent clips it (overflow hidden).
function PressOverlay({ ink = false, testID }) {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, ink ? styles.pressOverlayInk : styles.pressOverlayWhite]}
    />
  );
}

// Glass over a photo: on-photo + blur 12 (UX §8.4); before Android 12 the
// fill alone (the GlassSurface rule).
function PhotoGlass() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.photoGlass]}>
      {usesSolidGlass() ? null : <BlurLayer blurPx={blur.onPhoto} />}
      <View style={[StyleSheet.absoluteFill, styles.onPhotoFill]} />
    </View>
  );
}

function NumberTile({ idx, hue, style, numberStyle, testID }) {
  return (
    <View
      testID={testID}
      style={[styles.numberTile, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {hue ? <View style={[StyleSheet.absoluteFill, styles.numberTileTint, { backgroundColor: hue }]} /> : null}
      <Text {...BADGE_TEXT} textBreakStrategy="simple" style={[styles.numberTileText, hue ? { color: hue } : null, numberStyle]}>
        {idx + 1}
      </Text>
    </View>
  );
}

function SheetRow({ exercise, idx, current, stacked = false, onSelect }) {
  const row = sheetRowState(exercise, current);
  const url = exercise.exercise?.thumbnail?.url;
  const gold = row.kind === 'current';
  const sub = [row.muscle, setsLabel(row.total), `${row.done}/${row.total}`].filter(Boolean).join(' · ');
  return (
    <Pressable
      testID={`exercise-sheet-card-${idx}`}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      onPress={onSelect}
      style={[styles.row, gold ? styles.rowCurrent : styles.rowPlain]}
    >
      {({ pressed }) => (
        <>
          {/* The current row's gradient is mounted from the first render; only its opacity follows the state. */}
          <View
            testID={`exercise-sheet-current-fill-${idx}`}
            style={[StyleSheet.absoluteFill, { opacity: gold ? 1 : 0 }]}
            pointerEvents="none"
          >
            <GradientFill angle={CURRENT_ROW_FILL.angle} colors={CURRENT_ROW_FILL.colors} />
            <GradientFill angle={CURRENT_ROW_WASH.angle} colors={CURRENT_ROW_WASH.colors} />
          </View>
          {pressed && !gold ? <PressOverlay testID={`exercise-sheet-card-${idx}-pressed`} /> : null}
          <View style={styles.thumb}>
            <View style={row.kind === 'complete' ? styles.thumbDone : null}>
              {url ? (
                <ExerciseImage
                  testID={`exercise-sheet-image-${idx}`}
                  url={url}
                  name={row.name}
                  muscleCode={exercise.exercise?.primary_muscle_group?.code}
                  size={THUMB}
                  style={styles.thumbImage}
                />
              ) : (
                <NumberTile testID={`exercise-sheet-number-${idx}`} idx={idx} style={styles.thumbImage} />
              )}
            </View>
            {row.kind === 'complete' ? (
              <View testID={`exercise-sheet-done-${idx}`} style={[styles.badge, styles.badgeGold]}>
                <CheckGlyph />
              </View>
            ) : null}
            {gold ? (
              <View testID={`exercise-sheet-badge-${idx}`} style={[styles.badge, styles.badgeNumber]}>
                <Text {...BADGE_TEXT} style={styles.badgeNumberText}>
                  {idx + 1}
                </Text>
              </View>
            ) : null}
          </View>
          <View testID={`exercise-sheet-text-${idx}`} style={styles.rowText}>
            <Text
              {...BODY_TEXT}
              textBreakStrategy="simple"
              numberOfLines={2}
              ellipsizeMode="tail"
              style={[styles.rowName, row.kind === 'complete' && styles.rowNameDone]}
            >
              {row.name}
            </Text>
            <Text
              {...BODY_TEXT}
              testID={`exercise-sheet-sub-${idx}`}
              style={[styles.rowSub, row.kind === 'complete' ? styles.rowSubDone : gold ? styles.rowSubCurrent : null]}
            >
              {sub}
            </Text>
            {stacked ? <SheetAction idx={idx} row={row} gold={gold} onSelect={onSelect} below /> : null}
          </View>
          {stacked ? null : <SheetAction idx={idx} row={row} gold={gold} onSelect={onSelect} />}
        </>
      )}
    </Pressable>
  );
}

// The row's trailing action (36 visual, 44 hit); past 1.3× it sits below the
// text (`below`). Its label wraps, never truncates (UX §9).
function SheetAction({ idx, row, gold, onSelect, below = false }) {
  return (
    <Pressable
      testID={`exercise-sheet-action-${idx}`}
      accessibilityRole="button"
      accessibilityLabel={`${row.action} ${row.name}`}
      onPress={onSelect}
      hitSlop={4}
      style={[styles.action, gold ? styles.actionGold : styles.actionPlain, below && styles.actionBelow]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <PressOverlay ink={gold} testID={`exercise-sheet-action-${idx}-pressed`} /> : null}
          <Text {...BODY_TEXT} textBreakStrategy="simple" style={[styles.actionText, gold && styles.actionTextGold]}>
            {row.action}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function SheetPhotoCard({ exercise, idx, current, stacked = false, onSelect }) {
  const row = sheetRowState(exercise, current);
  const url = exercise.exercise?.thumbnail?.url;
  const code = exercise.exercise?.primary_muscle_group?.code;
  const gold = row.kind === 'current';
  const sub = [row.muscle, setsLabel(row.total)].filter(Boolean).join(' · ');
  const countLabel = `${row.done} of ${row.total} sets done`;
  return (
    <Pressable
      testID={`exercise-sheet-card-${idx}`}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.photoCard,
        gold ? styles.photoCardCurrent : styles.photoCardOther,
        stacked && styles.photoCardFull,
        pressed && styles.photoCardPressed,
      ]}
    >
      {url ? (
        <ExerciseImage
          testID={`exercise-sheet-image-${idx}`}
          url={url}
          name={row.name}
          muscleCode={code}
          size={CARD_GLYPH_BOX}
          style={styles.cardFill}
        />
      ) : (
        <NumberTile
          testID={`exercise-sheet-number-${idx}`}
          idx={idx}
          hue={muscleColor(code)}
          style={styles.cardFill}
          numberStyle={styles.cardNumber}
        />
      )}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <GradientFill
          angle={180}
          colors={[gradients.photoFade.colors[0], ...gradients.photoFade.colors]}
          stops={gold ? [0, 0.2, 1] : [0, 0.25, 1]}
        />
      </View>
      {row.kind === 'complete' ? (
        <View testID={`exercise-sheet-done-${idx}`} style={[styles.cardBadge, styles.badgeGold]}>
          <CheckGlyph size={14} />
        </View>
      ) : (
        <View
          testID={`exercise-sheet-badge-${idx}`}
          style={[styles.cardBadge, gold ? styles.cardBadgeCurrent : styles.cardBadgeOther]}
        >
          <Text {...BADGE_TEXT} style={[styles.cardBadgeText, gold && styles.cardBadgeTextCurrent]}>
            {idx + 1}
          </Text>
        </View>
      )}
      {gold ? null : (
        <View testID={`exercise-sheet-count-${idx}`} accessibilityLabel={countLabel} style={styles.countPill}>
          <PhotoGlass />
          <Text {...PILL_TEXT} style={[styles.countPillText, row.kind === 'complete' && styles.countPillTextDone]}>
            {`${row.done}/${row.total}`}
          </Text>
        </View>
      )}
      <View
        testID={`exercise-sheet-bottom-${idx}`}
        style={[styles.cardBottomRow, gold && styles.cardBottomRowCurrent, stacked && styles.cardBottomRowStacked]}
      >
        <View style={stacked ? null : styles.rowText}>
          <Text
            {...(gold ? SHEET_TITLE : BODY_TEXT)}
            numberOfLines={gold ? 3 : 2}
            style={gold ? styles.cardNameCurrent : styles.cardNameOther}
          >
            {row.name}
          </Text>
          <Text {...BODY_TEXT} style={styles.cardSub}>
            {sub}
          </Text>
        </View>
        {gold ? (
          <Text
            {...SHEET_TITLE}
            testID={`exercise-sheet-count-${idx}`}
            accessibilityLabel={countLabel}
            style={styles.cardCountCurrent}
          >
            {`${row.done}/${row.total}`}
          </Text>
        ) : null}
        <Pressable
          testID={`exercise-sheet-action-${idx}`}
          accessibilityRole="button"
          accessibilityLabel={`${row.action} ${row.name}`}
          onPress={onSelect}
          style={[styles.cardAction, gold ? styles.cardActionGold : styles.cardActionGlass]}
        >
          {({ pressed }) => (
            <>
              {gold ? null : <PhotoGlass />}
              {pressed ? <PressOverlay ink={gold} testID={`exercise-sheet-action-${idx}-pressed`} /> : null}
              <Text {...BODY_TEXT} textBreakStrategy="simple" style={[styles.cardActionText, gold && styles.actionTextGold]}>
                {row.action}
              </Text>
            </>
          )}
        </Pressable>
      </View>
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
  // Glass sheet: radius 32 top, top hairline-strong, sheet shadow.
  panel: {
    overflow: 'hidden',
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineStrong,
    boxShadow: shadows.float,
  },
  panelTablet: {
    borderTopLeftRadius: SHEET_TABLET_RADIUS,
    borderTopRightRadius: SHEET_TABLET_RADIUS,
    borderTopColor: colors.hairlineButton,
  },
  panelFill: {
    backgroundColor: colors.glassStrong,
  },
  panelFillSolid: {
    backgroundColor: colors.glassSolid,
  },
  pressOverlayWhite: {
    backgroundColor: colors.pressOverlay,
  },
  pressOverlayInk: {
    backgroundColor: colors.pressOverlayInk,
  },
  photoGlass: {
    overflow: 'hidden',
    borderRadius: radii.full,
  },
  onPhotoFill: {
    backgroundColor: colors.onPhoto,
  },
  panelContent: {
    paddingHorizontal: spacing[4],
    paddingTop: 10,
  },
  panelContentTablet: {
    paddingHorizontal: spacing[8],
    paddingTop: spacing[3],
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.hairlineBright,
  },
  handleTablet: {
    width: 48,
    height: 6,
  },
  sheetHeader: {
    marginTop: 14,
    paddingHorizontal: spacing[1],
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  sheetHeaderTablet: {
    marginTop: 18,
    paddingHorizontal: 0,
    alignItems: 'flex-end',
  },
  sheetHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    ...typography.titleLg,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.84,
    color: colors.textPrimary,
  },
  sheetTitleTablet: {
    ...typography.displayMd,
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: -2.4,
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    ...typography.bodySm,
    marginTop: spacing[1],
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  // The code's "Close" + ✕ text pill (44 tall on phones, 46 on tablets) in
  // the board's close-button colours (0.07 fill, 0.10 edge).
  closePill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    paddingHorizontal: spacing[4],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.fillSkeleton,
  },
  closePillTablet: {
    minHeight: 46,
    paddingHorizontal: spacing['4_5'],
  },
  closeText: {
    ...typography.bodySm,
    ...font(600),
    color: colors.textPrimary,
  },
  closeTextTablet: {
    ...typography.body,
    ...font(600),
  },
  chipsScroll: {
    marginTop: 14,
    marginHorizontal: -spacing[4],
  },
  chipsScrollTablet: {
    marginTop: 18,
    marginHorizontal: -spacing[8],
  },
  chips: {
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  chipsWrap: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chipsWrapTablet: {
    marginTop: 18,
  },
  chipTablet: {
    minHeight: 44,
    paddingHorizontal: spacing[5],
  },
  cards: {
    marginTop: 14,
    gap: spacing[2],
  },
  grid: {
    marginTop: spacing[5],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  // D2/W4: the empty line at 17/600 with the code's text.
  emptyText: {
    width: '100%',
    paddingVertical: spacing[6],
    textAlign: 'center',
    ...typography.labelLg,
    fontSize: 17,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: 10,
    paddingHorizontal: spacing[3],
    borderRadius: ROW_RADIUS,
    overflow: 'hidden',
  },
  rowPlain: {
    backgroundColor: colors.fillWell,
  },
  rowCurrent: {
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  thumbDone: {
    opacity: 0.6,
  },
  thumbImage: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.sm + 2,
  },
  numberTile: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fillSkeleton,
  },
  numberTileTint: {
    opacity: TILE_ALPHA,
  },
  numberTileText: {
    ...typography.labelLg,
    ...font(700),
    fontSize: 17,
    lineHeight: 22,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  // The badge sits on the thumbnail's bottom-right corner (4 in).
  badge: {
    position: 'absolute',
    right: spacing[1],
    bottom: spacing[1],
    minWidth: 20,
    minHeight: 20,
    paddingHorizontal: 5,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGold: {
    backgroundColor: colors.gold,
  },
  badgeNumber: {
    backgroundColor: colors.ground,
  },
  badgeNumberText: {
    ...typography.micro,
    ...font(700),
    color: colors.gold,
    fontVariant: ['tabular-nums'],
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    ...typography.body,
    ...font(600),
    color: colors.textPrimary,
  },
  rowNameDone: {
    color: colors.textSecondary,
  },
  rowSub: {
    ...typography.label,
    ...font(400),
    marginTop: 2,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  rowSubDone: {
    color: colors.textFaint,
  },
  rowSubCurrent: {
    color: colors.gold,
  },
  // 36 visual, 44 hit area (hitSlop 4).
  action: {
    minHeight: 36,
    overflow: 'hidden',
    paddingHorizontal: 14,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPlain: {
    backgroundColor: colors.fillSkeleton,
  },
  actionBelow: {
    marginTop: spacing[2],
    alignSelf: 'flex-start',
  },
  actionGold: {
    backgroundColor: colors.gold,
    boxShadow: shadows.goldGlow,
  },
  actionText: {
    ...typography.bodySm,
    ...font(600),
    color: colors.textPrimary,
  },
  actionTextGold: {
    ...font(700),
    color: colors.onGold,
  },
  // minHeight (UX §9): large text grows the card instead of clipping.
  photoCard: {
    minHeight: CARD_HEIGHT,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.surface,
  },
  photoCardOther: {
    width: '47%',
    flexGrow: 1,
  },
  photoCardCurrent: {
    width: '100%',
    minHeight: CARD_CURRENT_HEIGHT,
    borderRadius: radii.xxl,
    borderWidth: 2,
    borderColor: colors.gold,
    boxShadow: shadows.goldGlowLarge,
  },
  photoCardFull: {
    width: '100%',
  },
  photoCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  cardNumber: {
    fontSize: 64,
    lineHeight: 72,
  },
  cardBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A solid badge on the photo: 0.7 → on-photo-strong (UX §8.6).
  cardBadgeOther: {
    backgroundColor: colors.onPhotoStrong,
  },
  cardBadgeCurrent: {
    top: spacing[4],
    left: spacing[4],
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.gold,
  },
  cardBadgeText: {
    ...typography.bodySm,
    ...font(700),
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  cardBadgeTextCurrent: {
    ...typography.labelLg,
    ...font(700),
    color: colors.onGold,
  },
  // On-photo glass (UX §8.4): the fill and blur come from PhotoGlass.
  countPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    minHeight: 30,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
  },
  countPillText: {
    ...typography.body,
    ...font(700),
    color: colors.textStrong2,
    fontVariant: ['tabular-nums'],
  },
  countPillTextDone: {
    color: colors.gold,
  },
  // In flow at the card's foot (the card grows with large text); the top
  // padding clears the corner badges.
  cardBottomRow: {
    paddingTop: 58,
    paddingHorizontal: spacing[4],
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  cardBottomRowCurrent: {
    paddingTop: 66,
    paddingHorizontal: spacing[5],
    paddingBottom: 18,
    alignItems: 'center',
    gap: spacing[4],
  },
  cardBottomRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  cardNameOther: {
    ...typography.titleXs,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  cardNameCurrent: {
    ...typography.titleLg,
    color: colors.textPrimary,
  },
  cardSub: {
    ...typography.label,
    ...font(400),
    marginTop: 2,
    color: colors.textStrong2,
  },
  cardCountCurrent: {
    ...typography.titleMd,
    fontSize: 28,
    lineHeight: 32,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  cardAction: {
    minHeight: 44,
    overflow: 'hidden',
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // On-photo glass with the hairline-bright edge (UX §8.4; folds 0.5 / 0.18).
  cardActionGlass: {
    borderWidth: 1,
    borderColor: colors.hairlineBright,
  },
  cardActionGold: {
    minHeight: 50,
    paddingHorizontal: spacing[7],
    backgroundColor: colors.gold,
    boxShadow: shadows.goldGlow,
  },
  cardActionText: {
    ...typography.body,
    ...font(600),
    color: colors.textPrimary,
  },
});
