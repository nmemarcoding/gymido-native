import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, gradients } from '../theme/tokens';
import GradientFill from './GradientFill';

// v2 ambient gold glow (RN-SPEC-v2-foundation §1.1 glow-gold-ambient), only
// where a board draws it: the screen opts in with `glow` (true = the token's
// radial, or a board's own GradientFill radial spec). It fills the whole
// screen behind the content at a fixed size, so it must be passed from the
// first render and never toggled on a state change (Android gradient rule).
export function resolveGlow(glow) {
  if (!glow) {
    return null;
  }
  return glow === true ? gradients.goldAmbient : glow;
}

export function AmbientGlow({ glow }) {
  const spec = resolveGlow(glow);
  if (!spec) {
    return null;
  }
  return (
    <View testID="ambient-glow" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <GradientFill radial={spec.radial} colors={spec.colors} stops={spec.stops} angle={spec.angle} />
    </View>
  );
}

// testID defaults to app-root so UI tests can wait for the app itself rather
// than the Expo dev launcher, which also shows the app name.
export default function Screen({ children, style, glow = false, testID = 'app-root' }) {
  return (
    <SafeAreaView testID={testID} style={styles.safeArea}>
      <AmbientGlow glow={glow} />
      <View style={[styles.content, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ground,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
