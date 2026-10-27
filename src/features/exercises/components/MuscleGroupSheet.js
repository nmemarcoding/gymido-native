import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Path } from 'react-native-svg';

import { muscleColor, muscleTextColor } from '../../../shared/components/ExerciseImage';
import GradientFill from '../../../shared/components/GradientFill';
import { CAP_BODY, TITLE_TEXT } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { breakpoints, colors, font, gradients, muscleGlow, radii, shadows, spacing, textScale } from '../../../shared/theme/tokens';
import { countFor } from '../exercisesCatalog';

const NUMBER = { maxFontSizeMultiplier: textScale.display };
const SHEET_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// RN-SPEC-exercises §E2 "Muscle group" bottom sheet. Opens over everything
// (its own Modal window, above the tab bar). No drag-to-dismiss (⚠E-8):
// it closes via the scrim, "Close", an option or Android back.
export default function MuscleGroupSheet({ open, categories, categoryCounts, total, value, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  const { height, width, fontScale } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  const reflow = fontScale > textScale.reflowAbove;
  const reducedMotion = useReducedMotion();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  // translateY 100% → 0 of the sheet's own height, so wait for its layout.
  const [sheetHeight, setSheetHeight] = useState(0);

  useEffect(() => {
    if (!open) {
      fade.setValue(0);
      slide.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      fade.setValue(1);
      slide.setValue(1);
      return undefined;
    }
    if (!sheetHeight) {
      return undefined;
    }
    const animation = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 240, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 1, duration: 300, easing: SHEET_EASE, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
    // Only (re)start when the sheet opens or is first measured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reducedMotion, sheetHeight > 0]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight || height, 0] });
  const groups = categories.map((category) => ({ value: category, label: category, count: countFor(categoryCounts, category) }));
  const allActive = value === '';
  const columns = tablet ? 3 : 2;

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Pressable
          testID="muscle-sheet-scrim"
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Animated.View>
      <View pointerEvents="box-none" style={[styles.host, tablet && styles.hostTablet]}>
        <Animated.View
          testID="muscle-sheet"
          role="dialog"
          accessibilityViewIsModal
          accessibilityLabel="Filter by muscle group"
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            tablet ? styles.sheetTablet : [styles.sheetPhone, { marginBottom: 10 + insets.bottom }],
            { maxHeight: height * (tablet ? 0.85 : 0.75), transform: [{ translateY }] },
          ]}
        >
          {tablet ? <GradientFill angle={165} colors={gradients.card.colors} /> : null}
          <ScrollView bounces={false} contentContainerStyle={tablet ? styles.contentTablet : styles.content}>
            {tablet ? null : <View testID="muscle-sheet-handle" style={styles.handle} accessibilityElementsHidden importantForAccessibility="no" />}
            <View testID="muscle-sheet-title-row" style={[styles.titleRow, reflow && styles.titleRowStacked]}>
              <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.title}>
                Muscle group
              </Text>
              <PillButton testID="muscle-sheet-close" title="Close" variant="secondary" size="compact" onPress={onClose} />
            </View>
            <Pressable
              testID="muscle-sheet-option-all"
              accessibilityRole="button"
              accessibilityLabel={`All muscle groups, ${total} exercises`}
              accessibilityState={{ selected: allActive }}
              onPress={() => onSelect('')}
              style={[styles.allTile, tablet && styles.allTileTablet, allActive ? styles.allActive : styles.tileIdle]}
            >
              {({ pressed }) => (
                <>
                  {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressOverlay, styles.allOverlay]} /> : null}
                  {tablet && allActive ? <Check size={18} color={colors.gold} /> : null}
                  <View style={styles.allText}>
                    <Text {...CAP_BODY} style={[styles.allLabel, tablet && styles.allLabelTablet]}>
                      All muscle groups
                    </Text>
                    {tablet ? null : (
                      <Text {...NUMBER} style={styles.allCount}>
                        {total}
                      </Text>
                    )}
                  </View>
                  {tablet ? (
                    <Text {...NUMBER} style={styles.allCountTablet}>
                      {total}
                    </Text>
                  ) : allActive ? (
                    <View testID="muscle-sheet-all-check" style={styles.allCheck}>
                      <Check size={15} color={colors.gold} />
                    </View>
                  ) : (
                    <View style={styles.ring} />
                  )}
                </>
              )}
            </Pressable>
            <View testID="muscle-sheet-grid" accessibilityLabel="Muscle groups" style={styles.grid}>
              {groups.map((group) => {
                const active = group.value === value;
                const hue = muscleColor(group.value) ?? colors.textSecondary;
                const glow = muscleGlow(muscleColor(group.value) ?? colors.textSecondary);
                return (
                  <Pressable
                    key={group.value}
                    testID={`muscle-sheet-option-${group.value}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${group.label}, ${group.count} exercises`}
                    accessibilityState={{ selected: active }}
                    onPress={() => onSelect(group.value)}
                    style={[styles.tile, tablet && styles.tileTablet, { width: `${100 / columns}%` }]}
                  >
                    {({ pressed }) => (
                      // Android: the view whose border changes never clips; the
                      // fixed clip layer below rounds the glow.
                      <View testID={`muscle-sheet-tile-${group.value}`} style={[styles.tileInner, tablet && styles.tileInnerTablet, styles.tileIdle, active && { borderColor: hue }]}>
                        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tileClip, tablet && styles.tileClipTablet]}>
                          <GradientFill
                            radial={tablet ? GLOW_TABLET : GLOW_PHONE}
                            colors={glow.colors}
                            stops={glow.stops}
                            style={tablet ? styles.glowTablet : null}
                          />
                          {pressed ? <View style={[StyleSheet.absoluteFill, styles.pressOverlay]} /> : null}
                        </View>
                        <View style={styles.tileTop}>
                          <Text {...CAP_BODY} style={[styles.groupLabel, tablet ? styles.groupLabelTablet : { color: muscleTextColor(group.value) ?? hue }]}>
                            {group.label}
                          </Text>
                          {tablet ? null : active ? (
                            <View testID={`muscle-sheet-check-${group.value}`} style={[styles.ringOn, { backgroundColor: hue }]}>
                              <Check size={14} color={colors.onGold} />
                            </View>
                          ) : (
                            <View style={styles.ring} />
                          )}
                        </View>
                        <Text {...NUMBER} style={styles.groupCount}>
                          {group.count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Check({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L20 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Corner glows (UX G): phone top-right at the muscle colour 0.30 (glow-muscle);
// tablet top-left, drawn at 0.20 (= the 0.30 glow at 2/3 opacity).
const GLOW_PHONE = { cx: 1, cy: 0, rx: 0.9, ry: 0.9 };
const GLOW_TABLET = { cx: 0.2, cy: 0.1, rx: 0.9, ry: 0.9 };

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: colors.scrim,
  },
  host: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // §G: the tablet sheet is a centred card.
  hostTablet: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  sheetPhone: {
    marginHorizontal: 10,
    borderRadius: radii.xxxl,
    backgroundColor: colors.surfaceCard2,
    boxShadow: shadows.sheetUp,
  },
  sheetTablet: {
    width: 620,
    maxWidth: '100%',
    borderRadius: radii.xxxxl,
    boxShadow: shadows.sheet,
  },
  content: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  contentTablet: {
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.hairlineBright,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginTop: 14,
    paddingHorizontal: spacing[1],
  },
  titleRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  title: {
    ...font(700),
    flexShrink: 1,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -1.6,
    color: colors.textPrimary,
  },
  allTile: {
    minHeight: 84,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  allTileTablet: {
    minHeight: 76,
    marginTop: 22,
    paddingHorizontal: 22,
  },
  // UX ruling (open question a): the gold TINT, not gradient-gold.
  allActive: {
    backgroundColor: colors.goldTint,
    borderColor: colors.goldLine,
  },
  tileIdle: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairlineStrong,
  },
  pressOverlay: {
    backgroundColor: colors.pressOverlay,
  },
  allText: {
    flex: 1,
    minWidth: 0,
  },
  allLabel: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  allLabelTablet: {
    ...font(700),
    fontSize: 19,
    lineHeight: 22,
  },
  allCount: {
    ...font(700),
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.7,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  allCountTablet: {
    ...font(700),
    fontSize: 26,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  allCheck: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.hairlineBright,
  },
  ringOn: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginHorizontal: -4,
  },
  tile: {
    padding: 4,
  },
  tileTablet: {
    padding: 6,
  },
  tileInner: {
    minHeight: 96,
    justifyContent: 'space-between',
    gap: spacing[2],
    borderRadius: radii.lgPlus,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tileInnerTablet: {
    minHeight: 104,
    borderRadius: radii.xl,
    padding: 16,
  },
  tileClip: {
    overflow: 'hidden',
    borderRadius: radii.lgPlus - 1,
  },
  tileClipTablet: {
    borderRadius: radii.xl - 1,
  },
  allOverlay: {
    borderRadius: radii.xl - 1,
  },
  glowTablet: {
    opacity: 2 / 3,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  groupLabel: {
    ...font(600),
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  groupLabelTablet: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  groupCount: {
    ...font(700),
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
});
