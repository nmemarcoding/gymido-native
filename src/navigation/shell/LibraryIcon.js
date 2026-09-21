import { StyleSheet, View } from 'react-native';

// GymIcon name="library" (RN-SPEC-plans §1.3), drawn with Views so no SVG
// module is needed. 32×32 viewBox scaled to 24px (×0.75): stroke 3 → 2.25,
// a 14×22 rect (rx 3) at (9,5) and three round-capped lines M13 {11,16,21} h6.
const SCALE = 24 / 32;
const STROKE = 3 * SCALE;
const s = (value) => value * SCALE;

export default function LibraryIcon({ color }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.box}
    >
      <View
        style={[
          styles.rect,
          { borderColor: color, borderWidth: STROKE },
        ]}
      />
      {[11, 16, 21].map((y) => (
        <View key={y} style={[styles.line, { top: s(y - 1.5), backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
  },
  rect: {
    position: 'absolute',
    left: s(9 - 1.5),
    top: s(5 - 1.5),
    width: s(14 + 3),
    height: s(22 + 3),
    borderRadius: s(3 + 1.5),
  },
  line: {
    position: 'absolute',
    left: s(13 - 1.5),
    width: s(6 + 3),
    height: STROKE,
    borderRadius: STROKE / 2,
  },
});
