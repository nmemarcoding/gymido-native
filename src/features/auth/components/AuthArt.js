import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { CardSurface } from '../../../shared/components/Card';
import GradientFill from '../../../shared/components/GradientFill';
import { breakpoints, colors, font, gradients, shadows } from '../../../shared/theme/tokens';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';

// Shared look for the Phase 2 A auth screens (UX A boards). Everything here is
// decorative: hidden from screen readers, no animation (reduced motion needs
// nothing), every Svg with an explicit width/height (Android render rule).

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

// v2 device split: tablets are ≥ md (768) in both orientations.
export function isTabletWidth(width) {
  return width >= breakpoints.md;
}

// UX §9 large text, shared by the auth screens. Page/hero titles cap at
// textScale.display, wrap by word up to 3 lines and shrink a single long word
// (never a mid-word break); every other text (eyebrows, body) caps at
// textScale.body.
// T-170: the roles live in largeText.js; re-exported for this kit's callers.
export { DISPLAY_TITLE_TEXT };
export const BODY_TEXT = CAP_BODY;

// The boards are full-device frames (844 / 1194 tall) and place blocks from
// the frame top. Native content starts under the top inset, so a board offset
// becomes the same fraction of the window height minus the inset, never less
// than `min` (short phones keep their content on screen).
export function boardTop(offset, frameHeight, windowHeight, insetTop, min = 24) {
  return Math.max(min, Math.round((offset / frameHeight) * windowHeight) - insetTop);
}

// §7.1 G tile: solid gold, radius ≈ 0.31 × size, "G" Geist 700 at 0.5 × size
// in on-gold ink. The splash and Session loading draw the same mark (52/16);
// Welcome draws it beside the title (44/14 phone, 64/20 tablet).
const TILE_RADII = { 44: 14, 52: 16, 64: 20 };

export function GTile({ size = 44, style, testID = 'g-tile' }) {
  const radius = TILE_RADII[size] ?? Math.round(size * 0.31);
  return (
    <View testID={testID} {...HIDDEN} style={[styles.tile, { width: size, height: size, borderRadius: radius }, style]}>
      <Text allowFontScaling={false} style={[styles.tileText, { fontSize: size / 2, lineHeight: Math.round(size * 0.6) }]}>
        G
      </Text>
    </View>
  );
}

// Welcome's ring art (board 300 × 300): an outer gold arc (r130, 14) and an
// inner teal arc (r96, 10), each on a ring track (board white 0.06 / 0.05 →
// color-track, UX §8.5: artTrack → color-track). `size` scales the whole art
// (tablet ruling ND1: the same art, larger).
export const WELCOME_ART = 300;
const OUTER = { r: 130, width: 14, length: 816.8, offset: 250 };
const INNER = { r: 96, width: 10, length: 603.2, offset: 330 };
const ROTATE_TOP = `rotate(-90 ${WELCOME_ART / 2} ${WELCOME_ART / 2})`;

export function WelcomeRings({ size = WELCOME_ART, style }) {
  const c = WELCOME_ART / 2;
  return (
    <View testID="welcome-art" pointerEvents="none" {...HIDDEN} style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${WELCOME_ART} ${WELCOME_ART}`}>
        <Circle cx={c} cy={c} r={OUTER.r} fill="none" stroke={colors.track} strokeWidth={OUTER.width} />
        <Circle
          cx={c}
          cy={c}
          r={OUTER.r}
          fill="none"
          stroke={colors.gold}
          strokeWidth={OUTER.width}
          strokeLinecap="round"
          strokeDasharray={`${OUTER.length}`}
          strokeDashoffset={OUTER.offset}
          transform={ROTATE_TOP}
        />
        <Circle cx={c} cy={c} r={INNER.r} fill="none" stroke={colors.track} strokeWidth={INNER.width} />
        <Circle
          cx={c}
          cy={c}
          r={INNER.r}
          fill="none"
          stroke={colors.teal}
          strokeWidth={INNER.width}
          strokeLinecap="round"
          strokeDasharray={`${INNER.length}`}
          strokeDashoffset={INNER.offset}
          transform={ROTATE_TOP}
        />
      </Svg>
    </View>
  );
}

// Tablet Sign-in failed art (120): a danger-text arc (as drawn) on a
// ring track (board white 0.07 → color-track) around a padlock.
export function PadlockRing() {
  return (
    <View testID="sign-in-failed-art" pointerEvents="none" {...HIDDEN}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        <Circle cx={60} cy={60} r={52} fill="none" stroke={colors.track} strokeWidth={10} />
        <Circle
          cx={60}
          cy={60}
          r={52}
          fill="none"
          stroke={colors.dangerText}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray="327"
          strokeDashoffset={230}
          transform="rotate(-90 60 60)"
        />
        <Rect x={44} y={52} width={32} height={26} rx={7} fill="none" stroke={colors.textPrimary} strokeWidth={4} />
        <Path d="M50 52v-7a10 10 0 0 1 20 0v7" fill="none" stroke={colors.textPrimary} strokeWidth={4} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// Tablet Account unavailable art (132 × 120): a person in gold on a gold disc
// with a small "minus" badge.
export function AccountArt() {
  return (
    <View testID="account-unavailable-art" pointerEvents="none" {...HIDDEN}>
      <Svg width={132} height={120} viewBox="0 0 132 120">
        <Circle cx={52} cy={60} r={46} fill={colors.goldTint} />
        <Circle cx={52} cy={48} r={16} fill="none" stroke={colors.gold} strokeWidth={5} />
        <Path d="M24 92a28 28 0 0 1 56 0" fill="none" stroke={colors.gold} strokeWidth={5} strokeLinecap="round" />
        <Circle cx={102} cy={34} r={20} fill={colors.surface} stroke={colors.hairlineStrong} strokeWidth={2} />
        <Path d="M95 34h14" stroke={colors.textPrimary} strokeWidth={4} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// Phone header icons (30, stroke 2, the boards' own glyphs).
const ICONS = {
  'circle-alert': () => (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7.5v5.5M12 16.5h.01" />
    </>
  ),
  'user-x': () => (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21a8 8 0 0 1 12.5-6.6" />
      <Path d="M17 17l4 4M21 17l-4 4" />
    </>
  ),
};

// The phone boards' 64 icon tile (radius 22) with a 30 px glyph.
export function IconTile({ icon, color, backgroundColor, testID }) {
  const draw = ICONS[icon];
  return (
    <View testID={testID} {...HIDDEN} style={[styles.iconTile, { backgroundColor }]}>
      <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <G>{draw ? draw() : null}</G>
      </Svg>
    </View>
  );
}

// The tablet auth card (Sign-in failed 600, Account unavailable 620):
// gradient-card, 1 px hairline (board white 0.08, the ladder's border step:
// CardSurface's own hairline), radius 36, padding 44, the float shadow on
// an outer frame (overflow clips the inner one), a decorative gold corner
// glow. The glow and the gradient are present from the first render.
export function TabletAuthCard({ width, cornerGlow = 300, children, testID }) {
  return (
    <View testID={testID} style={[styles.cardShadow, { maxWidth: width }]}>
      <CardSurface hero style={styles.card}>
        <View pointerEvents="none" {...HIDDEN} style={[styles.cornerGlow, { width: cornerGlow, height: cornerGlow }]}>
          <GradientFill
            radial={gradients.cardCornerGlow.radial}
            colors={gradients.cardCornerGlow.colors}
            stops={gradients.cardCornerGlow.stops}
          />
        </View>
        <View style={styles.cardBody}>{children}</View>
      </CardSurface>
    </View>
  );
}

const CARD_RADIUS = 36;

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    ...font(700),
    color: colors.onGold,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShadow: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: CARD_RADIUS,
    boxShadow: shadows.float,
  },
  card: {
    borderRadius: CARD_RADIUS,
  },
  cornerGlow: {
    position: 'absolute',
    right: -90,
    top: -90,
  },
  cardBody: {
    padding: 44,
    gap: 18,
  },
});
