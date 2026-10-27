import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Screen from '../../../shared/components/Screen';
import Spinner from '../../../shared/components/Spinner';
import { Body } from '../../../shared/components/Typography';
import { colors, font, gradients, radii } from '../../../shared/theme/tokens';

const LOADING_LABEL = 'Restoring your session and preparing the app';

// v2 §5 session variant (board "Session loading"): a 96 ring around the 52 px
// gold "G" tile, the label below. The tile sits at the SCREEN centre, where the
// splash draws the same tile, so splash → this screen only adds the ring (UX).
export const RING = 96;
export const TILE = 52;
const LABEL_GAP = 24;

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
            <Spinner size={RING} thickness={4} color={colors.gold} track={colors.fillButton} />
          </View>
          <View style={styles.tile}>
            <Text allowFontScaling={false} style={styles.tileText}>
              G
            </Text>
          </View>
        </View>
        <Body style={[styles.label, { top: ringTop + RING + LABEL_GAP }]}>{LOADING_LABEL}</Body>
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
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 260,
    textAlign: 'center',
  },
});
