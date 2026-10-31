import { StyleSheet, Text, View } from 'react-native';

import GradientFill from '../../shared/components/GradientFill';
import { CAP_NONE } from '../../shared/components/largeText';
import { colors, font, gradients, radii } from '../../shared/theme/tokens';

// The signed-in user's OWN avatar (UX §8.2 exception, RN-SPEC-v2-phase5 §1):
// gradient-gold (gradients.goldAvatar) with on-gold initials, never the
// person-colour rule. Decorative (the name next to it is the heading).
// The gradient is mounted from the first render inside a clipped circle
// (Android gradient rule); the ring is drawn by wrapper edges, not a shadow.
//   size 84  phone Profile: ring 4 ground + 1 gold-line (the drawn 0.4)
//   size 120 tablet Profile: ring 5 surface + 1 gold-strong (the drawn 0.45)
//   size 88  Edit profile: no ring
const LOOKS = {
  84: { initials: { fontSize: 30, lineHeight: 34, letterSpacing: -0.9 }, ring: { gap: 4, fill: colors.ground, edge: colors.goldLine } },
  120: { initials: { fontSize: 44, lineHeight: 48, letterSpacing: -1.76 }, ring: { gap: 5, fill: colors.surface, edge: colors.goldStrong } },
  88: { initials: { fontSize: 32, lineHeight: 36, letterSpacing: -0.96 }, ring: null },
};

export default function ProfileAvatar({ initials, size = 84, testID }) {
  const look = LOOKS[size] ?? LOOKS[84];
  const circle = (
    <View style={[styles.circle, { width: size, height: size }]}>
      <GradientFill angle={gradients.goldAvatar.angle} colors={gradients.goldAvatar.colors} />
      <Text {...CAP_NONE} numberOfLines={1} textBreakStrategy="simple" style={[styles.initials, look.initials]}>
        {initials}
      </Text>
    </View>
  );
  const ring = look.ring;
  return (
    <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.self}>
      {ring ? (
        <View style={[styles.ring, { padding: ring.gap, backgroundColor: ring.fill, borderColor: ring.edge }]}>{circle}</View>
      ) : (
        circle
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  self: {
    alignSelf: 'center',
  },
  ring: {
    borderRadius: radii.full,
    borderWidth: 1,
  },
  circle: {
    borderRadius: radii.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...font(700),
    color: colors.onGold,
  },
});
