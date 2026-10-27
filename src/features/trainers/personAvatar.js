import { StyleSheet, Text, View } from 'react-native';

import { colors, font, muscle, radii, textScale } from '../../shared/theme/tokens';

// RN-SPEC-v2-phase5 §1 "Avatar colour rule" (UX final, 27 Oct; all
// platforms, every OTHER person's avatar, trainers and clients):
// index = user_id mod 6 over this fixed list; the circle fill is that colour
// at 16 % and the initials are that colour. The signed-in user's own avatar
// stays gradient-gold (not drawn here).
// KIT NEED (p5l report): this belongs in src/shared so the client avatars
// (6n) use the same hash; it lives here until the lead moves it.
export const AVATAR_COLORS = Object.freeze([muscle.chest, muscle.back, muscle.cardio, muscle.legs, muscle.arms, muscle.core]);
export const AVATAR_FILL_ALPHA = 0.16;

// A non-numeric or missing id falls back to index 0, so a render never fails.
export function avatarColorIndex(userId) {
  const id = Math.trunc(Number(userId));
  if (!Number.isFinite(id)) {
    return 0;
  }
  return ((id % 6) + 6) % 6;
}

export function avatarColor(userId) {
  return AVATAR_COLORS[avatarColorIndex(userId)];
}

// §3 a11y rule: initials from the first and last word of the name/email,
// split on spaces, @ . _ -; the email domain is dropped. One word keeps its
// first two letters (v1's hub rule).
export function personInitials(nameOrEmail) {
  const text = String(nameOrEmail ?? '').trim();
  const local = text.includes('@') ? text.slice(0, text.indexOf('@')) : text;
  const words = local.split(/[\s@._-]+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

// Initials sit in fixed-size chrome: capped like a badge.
const BADGE_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.badge });

// `radius` defaults to a circle; the phone Trainers card draws a rounded
// square (radii.lgPlus). `ring` draws the boards' gap + 1 px colour ring
// (detail: 5 px ground gap, colour at 0.45; card: 4 px surface gap, 0.5).
export default function PersonAvatar({ userId, name, size, radius, initialsSize, ring = null, testID = 'person-avatar', style }) {
  const color = avatarColor(userId);
  const corner = radius ?? size / 2;
  const fontSize = initialsSize ?? Math.round(size * 0.36);
  const disc = (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, { width: size, height: size, borderRadius: corner }, ring ? null : style]}
    >
      <View testID={`${testID}-fill`} style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: AVATAR_FILL_ALPHA }]} />
      <Text {...BADGE_TEXT} style={[styles.initials, { color, fontSize, lineHeight: Math.round(fontSize * 1.2) }]}>
        {personInitials(name)}
      </Text>
    </View>
  );
  if (!ring) {
    return disc;
  }
  const gap = ring.gap ?? 5;
  return (
    <View
      testID={`${testID}-ring`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ringWrap, { padding: gap, borderRadius: radii.full, backgroundColor: ring.gapColor ?? colors.ground }, style]}
    >
      {disc}
      <View
        testID={`${testID}-ring-line`}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.ringLine, { borderColor: color, opacity: ring.alpha ?? 0.45 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...font(700),
    textAlign: 'center',
  },
  ringWrap: {},
  ringLine: {
    borderWidth: 1,
    borderRadius: radii.full,
  },
});
