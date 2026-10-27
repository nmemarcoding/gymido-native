import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Screen from '../../../shared/components/Screen';
import Spinner from '../../../shared/components/Spinner';
import { colors, font, gradients, radii, textScale, typography } from '../../../shared/theme/tokens';

const LOADING_LABEL = 'Restoring your session and preparing the app';

// v2 §5 session variant (board "Session loading"): a 96 ring around the 52 px
// gold "G" tile, the label below. The tile sits at the SCREEN centre, where the
// splash draws the same tile, so splash → this screen only adds the ring (UX).
export const RING = 96;
export const TILE = 52;
const LABEL_GAP = 24;

// Colours: the ring track is color-track (board white 0.08). Large text (UX
// §9): the G glyph is fixed-geometry chrome (no scaling); the label (the
// Typography Body look, 15/22 text-secondary) caps at textScale.body and
// grows downward from under the ring, never clipped by a fixed height.

export default function SessionLoadingScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(LOADING_LABEL);
  }, []);

  // The content area starts below the top inset; place the ring's centre on
  // the window's centre.
  const ringTop = height / 2 - insets.top - RING / 2;

  return (
    <Screen glow={gradients.sessionGlow}>
      <View
        testID="session-loading"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={LOADING_LABEL}
        accessibilityLiveRegion="polite"
        style={StyleSheet.absoluteFill}
      >
        <View testID="session-loading-ring" style={[styles.ring, { top: ringTop }]}>
          <View style={StyleSheet.absoluteFill}>
            <Spinner size={RING} thickness={4} color={colors.gold} track={colors.track} />
          </View>
          <View style={styles.tile}>
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
});
