import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import BlurLayer from '../../../shared/components/BlurLayer';
import GradientFill from '../../../shared/components/GradientFill';
import RemoteImage from '../../../shared/components/RemoteImage';
import { CAP_BODY, CAP_FIT, FIT_CAP, useLiveLargeText } from '../../../shared/components/largeText';
import { exerciseImageProps } from '../../../shared/images/remoteImageSources';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, font, spacing, titleTracking } from '../../../shared/theme/tokens';
import { Countdown } from './RestParts';
import { isRestWarn, remainingRatio, restTimerLabel } from './restPresentation';
import { setsWord } from './sessionMath';

// T-153 (owner-approved, ruling §0–§6): the phone rest timer is a bottom-sheet POP-UP over the live workout (never a
// page): the live screen stays rendered behind a blurred, dimmed backdrop. From the sheet's top: the handle zone (48,
// the drag-down + accessible minimise control; owner: no chevron) → the banner ("{n} sets left", or gold "Get ready for
// the next exercise!") → the exercise photo (contain, untouched) → the draining bar → the countdown → −5 · Skip Rest ▶▶
// · +5. T-162 (spec §12 P2, approved): the controls are pinned 40 above the bottom inset in EVERY state; the photo card,
// bar and digits stay anchored to the top and all leftover height goes between the digits and the controls (min 16).
// Minimise (drag, activate, Android Back) only slides the sheet into today's
// disc: the rest keeps counting. Skip and 0 end it as today. No photo: the name shows instead (the only place it does).
// Below a window height of 844 the three gaps go short together; the photo shrinks to fit (floor 160). Large text: the
// body scrolls (the handle stays), Skip takes its own row and the squares go below it.

const SHEET_GAP = 44;
const HANDLE = 48;
const BANNER = 60;
const PHOTO_MAX = 295;
const PHOTO_FLOOR = 160;
const BAR = 23;
const DIGITS = 76;
const CONTROL = 55;
// The ±5 captions (8 + an 18 line) under the squares.
const CAPTIONS = 26;
const CONTROLS_BOTTOM = 40;
// §6.3: 14 under the handle zone, always.
const BODY_TOP = 14;
// Banner → photo, photo → bar, bar → digits; v1.3: short below a window height of 844 (status bar included).
const GAPS = Object.freeze({ banner: 14, photo: 28, bar: 13 });
const GAPS_SHORT = Object.freeze({ banner: 8, photo: 16, bar: 8 });
const SHORT_WINDOW = 844;
// P2: the least room between the digits and the pinned controls.
const CONTROLS_GAP_MIN = 16;
const DRAG_MINIMISE = 80;
const DRAG_VELOCITY = 0.5;
const OPEN_MS = 260;
const CLOSE_MS = 200;
const FADE_MS = 150;
const SHEET_COLORS = Object.freeze([colors.restSheetTop, colors.restSheetMid, colors.restSheetBottom]);

// §1: a drag past 80 or a flick (> 0.5) minimises; less springs back.
export function dragMinimises({ dy, vy }) {
  return dy > DRAG_MINIMISE || vy > DRAG_VELOCITY;
}

// The sheet's layout (§6.3 + P2): the gaps by the window height; the photo (295, contain) shrinks to keep the 16 above
// the pinned controls (floor 160).
export function restSheetLayout({ sheetHeight, windowHeight, insetsBottom, photoAspect, width, hasPhoto }) {
  const gaps = windowHeight < SHORT_WINDOW ? GAPS_SHORT : GAPS;
  if (!hasPhoto) {
    return { gaps, photo: 0 };
  }
  // The ±5 captions live inside the 40 under the buttons.
  const fixed = HANDLE + BODY_TOP + BANNER + gaps.banner + gaps.photo + BAR + gaps.bar + DIGITS + CONTROLS_GAP_MIN + CONTROL + CONTROLS_BOTTOM + insetsBottom;
  const natural = Math.min(PHOTO_MAX, Math.round((width - 2 * spacing[3]) / (photoAspect || 1)));
  const room = sheetHeight - fixed;
  const photo = Math.max(Math.min(natural, PHOTO_FLOOR), Math.min(natural, Math.floor(room)));
  return { gaps, photo };
}

function DumbbellIcon({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </Svg>
  );
}

function SparkIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke={colors.restSpark} strokeWidth={2.2} strokeLinecap="round">
      <Path d="M11 2v5M4 8l3.5 3M18 8l-3.5 3" />
    </Svg>
  );
}

function StepIcon({ plus }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={2.8} strokeLinecap="round">
      <Path d={plus ? 'M5 12h14M12 5v14' : 'M5 12h14'} />
    </Svg>
  );
}

// ▶▶ after "Skip Rest" (the tablet card uses it too, §5).
export function SkipIcon({ color = colors.onGold, size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M3 6l9 6-9 6zM12 6l9 6-9 6z" />
    </Svg>
  );
}

function Banner({ next, left }) {
  return (
    <View testID="rest-banner" style={[styles.banner, next ? styles.bannerNext : styles.bannerCalm]}>
      <View style={[styles.bannerDisc, { backgroundColor: next ? colors.restBannerDiscNext : colors.restBannerDisc }]}>
        <DumbbellIcon color={next ? colors.onGold : colors.gold} />
      </View>
      <Text {...CAP_BODY} testID="rest-banner-text" style={[styles.bannerText, next && styles.bannerTextNext]}>
        {next ? 'Get ready for the next exercise!' : `${left} ${setsWord(left)} left`}
      </Text>
      {next ? (
        <View style={styles.spark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SparkIcon />
        </View>
      ) : null}
    </View>
  );
}

// §4: contain, nothing on it; the letterbox is the same image as cover, blurred and dimmed, clipped by the card.
function PhotoCard({ image, height, onLoad, opacity }) {
  return (
    <Animated.View testID="rest-photo" style={[styles.photo, { height, opacity }]}>
      <RemoteImage {...image} resizeMode="cover" blurRadius={18} style={styles.photoBlur} />
      <View style={[StyleSheet.absoluteFill, styles.photoDim]} />
      {/* Decorative: the banner says what is next. */}
      <RemoteImage {...image} resizeMode="contain" style={StyleSheet.absoluteFill} onLoad={onLoad} />
    </Animated.View>
  );
}

// §2 bar: remaining / total, draining right → left; colour only in the last 5 s.
function DrainBar({ timer, warn, reducedMotion }) {
  const [level] = useState(() => new Animated.Value(remainingRatio(timer.secondsLeft, timer.totalSeconds)));
  const target = remainingRatio(Math.max(0, timer.secondsLeft - 1), timer.totalSeconds);
  useEffect(() => {
    if (reducedMotion) {
      level.setValue(remainingRatio(timer.secondsLeft, timer.totalSeconds));
      return undefined;
    }
    const animation = Animated.timing(level, { toValue: target, duration: 1000, easing: Easing.linear, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [level, target, reducedMotion, timer.secondsLeft, timer.totalSeconds]);
  return (
    <View testID="rest-bar" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.bar}>
      <Animated.View testID="rest-bar-fill" style={[styles.barFill, warn && styles.barFillWarn, { transform: [{ scaleX: level }] }]} />
    </View>
  );
}

function Square({ testID, label, caption, plus, onPress }) {
  return (
    <View style={styles.squareColumn}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.square, pressed && styles.pressed]}>
        <StepIcon plus={plus} />
      </Pressable>
      <Text {...CAP_BODY} accessibilityElementsHidden importantForAccessibility="no" style={styles.caption}>
        {caption}
      </Text>
    </View>
  );
}

function SkipButton({ onPress, stacked }) {
  return (
    <Pressable
      testID="rest-timer-skip"
      accessibilityRole="button"
      accessibilityLabel="Skip Rest"
      onPress={onPress}
      style={({ pressed }) => [styles.skip, stacked && styles.skipStacked, pressed && styles.pressed]}
    >
      {/* §2: the label and ▶▶ never wrap apart: one row, the label shrinks first. */}
      <Text {...CAP_FIT} numberOfLines={stacked ? undefined : 1} style={styles.skipText}>
        Skip Rest
      </Text>
      <SkipIcon />
    </Pressable>
  );
}

export default function RestSheet({ timer, hero, onMinimize, onAdjust, onSkip, window, insets }) {
  const reducedMotion = useReducedMotion();
  const stacked = useLiveLargeText(false);
  const next = hero?.mode === 'next';
  const warn = isRestWarn(timer.secondsLeft, timer.totalSeconds);
  const image = useMemo(() => exerciseImageProps(hero?.exercise), [hero?.exercise]);
  const [photo, setPhoto] = useState(null);
  const loaded = image.url && photo?.url === image.url ? photo : null;
  const sheetTop = insets.top + SHEET_GAP;
  const sheetHeight = window.height - sheetTop;
  const layout = restSheetLayout({ sheetHeight, windowHeight: window.height, insetsBottom: insets.bottom, photoAspect: loaded?.aspect, width: window.width, hasPhoto: Boolean(loaded) });
  const [slide] = useState(() => new Animated.Value(reducedMotion ? 0 : sheetHeight));
  const [fade] = useState(() => new Animated.Value(reducedMotion ? 0 : 1));
  const [photoFade] = useState(() => new Animated.Value(0));

  // §1 open: slide up 260 ms ease-out (reduced motion: a 150 ms fade).
  useEffect(() => {
    const open = reducedMotion
      ? Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true })
      : Animated.timing(slide, { toValue: 0, duration: OPEN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    open.start();
    return () => open.stop();
  }, [fade, slide, reducedMotion]);

  // Slide down (or fade), then minimise to the disc.
  const leave = (then) => {
    const out = reducedMotion
      ? Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true })
      : Animated.timing(slide, { toValue: sheetHeight, duration: CLOSE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true });
    out.start(() => then());
  };

  // §1: the handle zone follows the finger; past 80 or a flick (> 0.5) minimises, else it springs back.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => slide.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_event, gesture) => {
          if (dragMinimises(gesture)) {
            leave(onMinimize);
          } else {
            Animated.timing(slide, { toValue: 0, duration: CLOSE_MS, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => Animated.timing(slide, { toValue: 0, duration: CLOSE_MS, useNativeDriver: true }).start(),
      }),
    // `leave` reads the latest props through onMinimize; the responder is made once per sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slide]
  );

  const onLoad = (source) => {
    const aspect = source?.width > 0 && source?.height > 0 ? source.width / source.height : null;
    if (!aspect) {
      return;
    }
    setPhoto({ url: image.url, aspect });
    photoFade.setValue(reducedMotion ? 1 : 0);
    if (!reducedMotion) {
      Animated.timing(photoFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  };

  const digits = (
    <Countdown
      seconds={timer.secondsLeft}
      warn={warn}
      maxScale={FIT_CAP}
      accessibilityLabel={restTimerLabel(timer.secondsLeft)}
      style={styles.digits}
    />
  );
  const minus = <Square testID="rest-timer-minus" label="Minus 5 seconds" caption="−5s" onPress={() => onAdjust(-5)} />;
  const plus = <Square testID="rest-timer-plus" label="Plus 5 seconds" caption="+5s" plus onPress={() => onAdjust(5)} />;
  // Web parity (PM 30 Oct): Skip closes at once, as today; only minimising slides the sheet down.
  const skip = <SkipButton stacked={stacked} onPress={onSkip} />;

  const body = (
    <>
      <View style={{ marginTop: BODY_TOP }}>
        <Banner next={next} left={hero?.left ?? 0} />
      </View>
      {image.url ? (
        <View style={[styles.photoSlot, loaded ? { marginTop: layout.gaps.banner, height: layout.photo } : styles.photoProbe]}>
          <PhotoCard image={image} height={loaded ? layout.photo : 1} onLoad={onLoad} opacity={loaded ? photoFade : 0} />
        </View>
      ) : null}
      {loaded ? null : hero?.name ? (
        // §4 no photo: the name, the only place it shows.
        <Text {...CAP_FIT} testID="rest-name" numberOfLines={2} style={styles.name}>
          {hero.name}
        </Text>
      ) : null}
      {/* P2: the bar + digits stay under the photo (or the name); the leftover goes above the pinned controls. */}
      <View testID="rest-timer-zone">
        <View testID="rest-timer-group" style={[styles.timerGroup, { marginTop: loaded ? layout.gaps.photo : spacing[6] }]}>
          <DrainBar timer={timer} warn={warn} reducedMotion={reducedMotion} />
          <View style={{ marginTop: layout.gaps.bar }}>{digits}</View>
        </View>
      </View>
    </>
  );

  return (
    <View testID="rest-timer" style={styles.overlay}>
      {/* §1 backdrop: the live screen stays rendered behind, blurred (iOS) and dimmed. */}
      {Platform.OS === 'ios' ? <BlurLayer blurPx={8} /> : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, Platform.OS === 'ios' ? styles.scrim : styles.scrimSolid]} />
      <Animated.View
        testID="rest-sheet"
        accessibilityViewIsModal
        role="dialog"
        accessibilityLabel="Rest timer"
        style={[styles.sheet, { top: sheetTop, opacity: fade, transform: [{ translateY: slide }] }]}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sheetClip]}>
          <GradientFill angle={180} colors={SHEET_COLORS} stops={[0, 0.32, 1]} />
        </View>
        {/* §1: the handle zone = the drag-down + the accessible minimise control (no chevron). */}
        <Pressable
          testID="rest-sheet-handle"
          {...pan.panHandlers}
          accessibilityRole="button"
          accessibilityLabel="Minimise rest timer"
          accessibilityHint="Drag down or activate to minimise"
          onPress={() => leave(onMinimize)}
          style={styles.handle}
        >
          <View style={styles.grip} />
        </Pressable>
        {stacked ? (
          <ScrollView testID="rest-sheet-scroll" contentContainerStyle={[styles.scrollBody, { paddingBottom: insets.bottom + spacing[6] }]}>
            {body}
            <View style={styles.stackedControls}>
              {skip}
              <View style={styles.squaresRow}>
                {minus}
                {plus}
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.body}>
            {body}
            <View style={[styles.controls, styles.controlsRow, { bottom: insets.bottom + CONTROLS_BOTTOM - CAPTIONS }]}>
              {minus}
              {skip}
              {plus}
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
  },
  scrim: {
    backgroundColor: colors.restSheetScrim,
  },
  scrimSolid: {
    backgroundColor: colors.restSheetScrimSolid,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: colors.restSheetEdge,
    boxShadow: `0px -16px 48px ${colors.restSheetShadow}`,
  },
  sheetClip: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handle: {
    height: HANDLE,
    alignItems: 'center',
  },
  grip: {
    marginTop: 12,
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.restSheetGrip,
  },
  body: {
    flex: 1,
  },
  scrollBody: {
    flexGrow: 1,
  },
  banner: {
    marginHorizontal: 14,
    minHeight: BANNER,
    borderRadius: 30,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  bannerCalm: {
    borderWidth: 1,
    borderColor: colors.restBannerCalmEdge,
    backgroundColor: colors.restBannerCalm,
  },
  bannerNext: {
    backgroundColor: colors.gold,
  },
  bannerDisc: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    ...font(800),
    flex: 1,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: titleTracking(18, -0.02),
    color: colors.textPrimary,
  },
  bannerTextNext: {
    color: colors.onGold,
  },
  spark: {
    position: 'absolute',
    right: 12,
    top: 6,
  },
  photoSlot: {
    marginHorizontal: spacing[3],
  },
  photoProbe: {
    height: 1,
    opacity: 0,
  },
  photo: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.restPhotoEdge,
    backgroundColor: colors.ground,
    overflow: 'hidden',
  },
  photoBlur: {
    position: 'absolute',
    top: -24,
    right: -24,
    bottom: -24,
    left: -24,
  },
  photoDim: {
    backgroundColor: colors.restPhotoDim,
  },
  name: {
    ...font(700),
    marginTop: 14,
    marginHorizontal: spacing[4],
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: titleTracking(28, -0.04),
    textAlign: 'center',
    color: colors.textPrimary,
  },
  timerGroup: {
    alignItems: 'center',
  },
  bar: {
    alignSelf: 'stretch',
    marginHorizontal: 19,
    height: BAR,
    borderRadius: 12,
    backgroundColor: colors.restBarTrack,
  },
  barFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 12,
    transformOrigin: 'left',
    backgroundColor: colors.gold,
    boxShadow: `0px 0px 18px ${colors.restBarGlow}`,
  },
  barFillWarn: {
    backgroundColor: colors.dangerText,
    boxShadow: `0px 0px 18px ${colors.restBarGlowWarn}`,
  },
  digits: {
    fontSize: DIGITS,
    lineHeight: DIGITS,
    letterSpacing: titleTracking(DIGITS, -0.03),
    color: colors.textPrimary,
  },
  // P2: pinned 40 above the bottom inset (the row's 20 side margins apply).
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  controlsRow: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 21,
  },
  stackedControls: {
    marginTop: spacing[6],
    marginHorizontal: 20,
    gap: spacing[4],
  },
  squaresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  squareColumn: {
    alignItems: 'center',
    gap: spacing[2],
  },
  square: {
    width: 59,
    height: CONTROL,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.restSquareEdge,
    backgroundColor: colors.restSquare,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    ...font(600),
    fontSize: 15,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  skip: {
    flex: 1,
    minWidth: 150,
    minHeight: CONTROL,
    borderRadius: 28,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    backgroundColor: colors.gold,
    boxShadow: `0px 10px 30px -8px ${colors.restBarGlow}`,
  },
  skipStacked: {
    flex: 0,
    alignSelf: 'stretch',
  },
  skipText: {
    ...font(800),
    flexShrink: 1,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: titleTracking(19, -0.02),
    color: colors.onGold,
  },
  pressed: {
    opacity: 0.85,
  },
});
