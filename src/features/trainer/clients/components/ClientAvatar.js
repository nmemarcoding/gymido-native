import { StyleSheet, Text, View } from 'react-native';

import { font } from '../../../../shared/theme/tokens';
import { avatarHue } from '../clientActivity';

// RN-SPEC-v2-phase6 §2 X-2 / v2-phase5 §1: ONE avatar style for every client
// on every trainer screen: a circle of the person's colour (user_id mod 6)
// at 16 % with the initials (700) in that colour. Decorative: the name beside
// it is the label. A fixed circle: the initials don't scale with large text.
export const AVATAR_TINT = 0.16;

export default function ClientAvatar({ userId, initials, size = 44, testID }) {
  const hue = avatarHue(userId);
  const fontSize = Math.round(size * 0.34);
  return (
    <View
      testID={testID ?? `client-avatar-${userId}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View testID="client-avatar-tint" style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: hue }]} />
      <Text allowFontScaling={false} style={[styles.initials, { color: hue, fontSize, lineHeight: Math.round(fontSize * 1.2) }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tint: {
    opacity: AVATAR_TINT,
  },
  initials: {
    ...font(700),
    textAlign: 'center',
  },
});
