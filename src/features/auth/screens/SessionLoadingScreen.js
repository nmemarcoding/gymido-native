import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Screen from '../../../shared/components/Screen';
import Spinner from '../../../shared/components/Spinner';
import { colors, font, gradients, radii, shadows, textScale, typography } from '../../../shared/theme/tokens';
import { isTabletWidth } from '../components/AuthArt';

const LOADING_LABEL = 'Restoring your session and preparing the app';

// v2 §5 session variant (board "Session loading"): a 96 ring around the 52 px
// gold "G" tile, the label below. The tile sits at the SCREEN centre, where the
// splash draws the same tile, so splash → this screen only adds the ring (UX).
export const RING = 96;
export const TILE = 52;
// UX A §Session loading: the column gap between the ring and the label is 28.
export const LABEL_GAP = 28;

// RN-SPEC-v2-phase2 A4 tablet (board TabletSessionLoading, UX A §Tablet:
// Session loading): a 260 loader box, a 120 tile, the label 20/28, the column
// (ring, gap 44, label) centred both ways. The phone structure stays: the
// whole container is the one status region, and the spin period is the kit's
// (1 s, 3 s under reduced motion, never stops; the board's 1.4 s is not used).
export const TABLET_RING = 260;
export const TABLET_TILE = 120;
export const TABLET_GAP = 44;
// The board's ring is r 118 with a 12 stroke inside the 260 box, so the drawn
// ring is 248 across (Spinner draws r = size / 2 − stroke / 2).
export const TABLET_STROKE = 12;
export const TABLET_SPINNER = 2 * 118 + TABLET_STROKE;
// Board glow: radial 55% 38% at 50% 45%, gold 0.24 → 0 at 70%. The geometry
// is the board's; the colour folds on the §8.5 ladder (0.24 → glow-gold-orb
// 0.26, as welcomeGlow 0.24 did).
export const TABLET_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.5, cy: 0.45, rx: 0.55, ry: 0.38 }),
  colors: gradients.heroGlow.colors,
  stops: Object.freeze([0, 0.7]),
});

// Colours: the ring track is color-track (board white 0.08; the tablet's 0.06
// folds into it, §8.5). The tablet tile is SOLID gold (§7.1 / §8.7 U3: the
// board's 150° gradient is not built) with shadow-gold-glow-lg (§8.7 U11: the
// 0.65 tile shadow). The tablet label is text-strong-2 as drawn.
// Large text (UX §9): the G glyph is fixed-geometry chrome (no scaling); the
// label caps at textScale.body and grows downward, never clipped by a fixed
// height.

export default function SessionLoadingScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = isTabletWidth(width);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(LOADING_LABEL);
  }, []);

  const statusProps = {
    testID: 'session-loading',
    accessible: true,
    accessibilityRole: 'progressbar',
    accessibilityLabel: LOADING_LABEL,
    accessibilityLiveRegion: 'polite',
  };

  if (tablet) {
    return (
      <Screen glow={TABLET_GLOW}>
        <View {...statusProps} style={[StyleSheet.absoluteFill, styles.columnTablet]}>
          <View testID="session-loading-ring" style={styles.ringTablet}>
            <Spinner size={TABLET_SPINNER} thickness={TABLET_STROKE} color={colors.gold} track={colors.track} />
            <View style={[StyleSheet.absoluteFill, styles.centre]}>
              <View testID="session-loading-tile" style={styles.tileTablet}>
                <Text allowFontScaling={false} style={styles.tileTextTablet}>
                  G
                </Text>
              </View>
            </View>
          </View>
          <Text testID="session-loading-label" maxFontSizeMultiplier={textScale.body} style={styles.labelTablet}>
            {LOADING_LABEL}
          </Text>
        </View>
      </Screen>
    );
  }

  // The content area starts below the top inset; place the ring's centre on
  // the window's centre.
  const ringTop = height / 2 - insets.top - RING / 2;

  return (
    <Screen glow={gradients.sessionGlow}>
      <View {...statusProps} style={StyleSheet.absoluteFill}>
        <View testID="session-loading-ring" style={[styles.ring, { top: ringTop }]}>
          <View style={StyleSheet.absoluteFill}>
            <Spinner size={RING} thickness={4} color={colors.gold} track={colors.track} />
          </View>
          <View testID="session-loading-tile" style={styles.tile}>
            <Text allowFontScaling={false} style={styles.tileText}>
              G
            </Text>
          </View>
        </View>
        <Text testID="session-loading-label" maxFontSizeMultiplier={textScale.body} style={[styles.label, { top: ringTop + RING + LABEL_GAP }]}>
          {LOADING_LABEL}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    alignSelf: 'center',
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radii.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    ...font(700),
    fontSize: 26,
    lineHeight: 30,
    color: colors.onGold,
  },
  label: {
    ...typography.bodyText,
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 260,
    textAlign: 'center',
  },
  // Tablet
  columnTablet: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: TABLET_GAP,
    paddingHorizontal: 40,
  },
  ringTablet: {
    width: TABLET_RING,
    height: TABLET_RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Board: 120, radius 38 (radii.tile).
  tileTablet: {
    width: TABLET_TILE,
    height: TABLET_TILE,
    borderRadius: radii.tile,
    backgroundColor: colors.gold,
    boxShadow: shadows.goldGlowLarge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Board: "G" 60/700, −0.04em.
  tileTextTablet: {
    ...font(700),
    fontSize: 60,
    lineHeight: 72,
    letterSpacing: -2.4,
    color: colors.onGold,
  },
  labelTablet: {
    ...font(500),
    fontSize: 20,
    lineHeight: 28,
    maxWidth: 420,
    textAlign: 'center',
    color: colors.textStrong2,
  },
});
