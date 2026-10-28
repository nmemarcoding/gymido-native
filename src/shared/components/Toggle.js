import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors, layout } from '../theme/tokens';

// UX native final audit 27 Oct 2026, ruling 11 (A145): the kit toggle, drawn
// rather than the RN Switch (Android's Switch is ≈36×20 and can't be sized,
// iOS can't take a white-on-gold look with a ground thumb). On = the gold
// track + a white knob on the right; off = the white 0.14 track + the knob
// on the left. Visual 51×31 (iOS) / 52×32 (Android), a 2 inset round knob;
// the hit area is at least 44×44. The position is the cue (no ✓).
//
// It is a switch with its checked state. `decorative`: a parent row is the
// switch (Profile settings), so this one is hidden from accessibility.
export const TOGGLE_HIT = layout.touchMin;
const KNOB_INSET = 2;

export function toggleMetrics(os = Platform.OS) {
  const size = os === 'ios' ? { width: 51, height: 31 } : { width: 52, height: 32 };
  return { ...size, knob: size.height - KNOB_INSET * 2 };
}

export default function Toggle({ value, onValueChange, accessibilityLabel, accessibilityHint, decorative = false, disabled = false, testID }) {
  const { width, height, knob } = toggleMetrics();
  const a11y = decorative
    ? { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' }
    : { accessibilityRole: 'switch', accessibilityLabel, accessibilityHint, accessibilityState: { checked: !!value, disabled } };
  return (
    <Pressable testID={testID} {...a11y} disabled={disabled} onPress={() => onValueChange?.(!value)} style={styles.hit}>
      <View
        testID={testID ? `${testID}-track` : undefined}
        pointerEvents="none"
        style={[
          styles.track,
          { width, height, borderRadius: height / 2 },
          value ? styles.trackOn : styles.trackOff,
        ]}
      >
        <View testID={testID ? `${testID}-knob` : undefined} style={[styles.knob, { width: knob, height: knob, borderRadius: knob / 2 }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minWidth: TOGGLE_HIT,
    minHeight: TOGGLE_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    padding: KNOB_INSET,
    justifyContent: 'center',
  },
  trackOn: {
    backgroundColor: colors.gold,
    alignItems: 'flex-end',
  },
  trackOff: {
    backgroundColor: colors.switchTrackOff,
    alignItems: 'flex-start',
  },
  knob: {
    backgroundColor: colors.switchKnob,
  },
});
