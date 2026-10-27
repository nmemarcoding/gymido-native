import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, font, gradients, muscle, musclePalette, radii } from '../theme/tokens';
import GradientFill from './GradientFill';
import RemoteImage from './RemoteImage';

// v2 exercise image (RN-SPEC-v2-foundation §4.8, UX tokens-and-components
// §8.1): the photo, or a tile when there is none.
//   no image URL     → initials tile: the muscle colour at 16 % + the colour
//                      as 700 text, ≈ 0.36 × the tile
//   unknown muscle   → the same tile on fillSkeleton with textSecondary
//   URL fails        → the muscle tile with the workout icon (not initials)
//   loading          → a skeleton block (no shimmer), same size and radius
//   hero             → radius 24, full width, 90 px bottom fade (also over
//                      the no-photo tile, never an empty frame)
// The tile is decorative (hidden from screen readers): the exercise name
// beside it is the label. A photo's label is `accessibilityLabel` (the name,
// or nothing when the name sits right beside it).

export const TILE_ALPHA = 0.16;
// The failed-load tile follows its board: a 22 % fill and a light icon (UX).
export const FAILED_TILE_ALPHA = 0.22;
export const HERO_FADE_HEIGHT = 90;
const HERO_GLYPH = 56;

// The API's primary muscle group codes onto the six v2 hues. CHEST/BACK/ARMS
// come from `muscle`, every other group from `musclePalette` (UX mapping);
// BICEPS / TRICEPS are arms as in v1's thumbnail tiles.
const ARM_CODES = new Set(['ARMS', 'BICEPS', 'TRICEPS']);

function camel(code) {
  return code.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function muscleColor(code) {
  if (!code) {
    return null;
  }
  const key = String(code)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (ARM_CODES.has(key)) {
    return muscle.arms;
  }
  const name = camel(key);
  if (name === 'iconLight' || name === 'iconDark') {
    return null;
  }
  return muscle[name] ?? musclePalette[name] ?? null;
}

// Two letters: the first letters of the first two words; one word → its
// first two letters.
export function exerciseInitials(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const letters = words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[1][0]}`;
  return letters.toUpperCase();
}

// Thumbnails 40 / 56 → radius 12, 72 → radius 20; hero → 24.
export function imageRadius(size, hero) {
  if (hero) {
    return radii.xl;
  }
  return size >= 72 ? radii.lg : radii.sm;
}

// ≈ 0.36 × the tile (40 → 14, 56 → 20, 72 → 26), hero → 56.
export function initialsSize(size, hero) {
  return hero ? HERO_GLYPH : Math.round(size * 0.36);
}

// The workout icon at ≈ 0.44 × the tile (the board's 28 in a 64 tile).
export function failedIconSize(size, hero) {
  return hero ? HERO_GLYPH : Math.round(size * 0.44);
}

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

// GymIcon's `workout` glyph (the shell icon set; drawn here so shared code
// does not import a feature).
function WorkoutGlyph({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 13v6M9 10v12M23 10v12M28 13v6M9 16h14" />
    </Svg>
  );
}

function HeroFade() {
  return (
    <View pointerEvents="none" style={styles.fade}>
      <GradientFill angle={gradients.imageFade.angle} colors={gradients.imageFade.colors} />
    </View>
  );
}

export default function ExerciseImage({
  exercise,
  url: urlProp,
  name: nameProp,
  muscleCode,
  size = 56,
  hero = false,
  loading = false,
  sources,
  resizeMode = 'cover',
  accessibilityLabel,
  style,
  testID = 'exercise-image',
  children,
}) {
  // An explicit prop (even null) wins over the exercise object.
  const url = (urlProp !== undefined ? urlProp : exercise?.thumbnail?.url) || null;
  const name = (nameProp !== undefined ? nameProp : exercise?.name) ?? '';
  const hue = muscleColor(muscleCode !== undefined ? muscleCode : exercise?.primary_muscle_group?.code);
  // The URL whose candidates all failed; a new URL starts fresh.
  const [failedUrl, setFailedUrl] = useState(null);
  const failed = Boolean(url) && failedUrl === url;

  const box = hero ? styles.hero : { width: size, height: size };
  const frame = [styles.frame, box, { borderRadius: imageRadius(size, hero) }, style];
  const fade = hero ? <HeroFade /> : null;

  if (loading) {
    return <View testID={`${testID}-loading`} {...hidden} style={[frame, styles.skeleton]} />;
  }

  if (url && !failed) {
    // fillSkeleton under the photo is the loading block until it paints.
    return (
      <View testID={testID} style={[frame, styles.skeleton]}>
        <RemoteImage
          url={url}
          sources={sources}
          resizeMode={resizeMode}
          style={styles.photo}
          accessibilityLabel={accessibilityLabel}
          onExhausted={() => setFailedUrl(url)}
        />
        {fade}
        {children}
      </View>
    );
  }

  const tint = hue ? <View testID={`${testID}-tint`} style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: hue }]} /> : null;
  const ink = hue ?? colors.textSecondary;
  const tileFrame = [frame, styles.tile, !hue && styles.neutral];

  if (failed) {
    return (
      <View testID={`${testID}-failed`} style={tileFrame}>
        <View {...hidden} style={[StyleSheet.absoluteFill, styles.tileContent]}>
          {hue ? <View testID={`${testID}-tint`} style={[StyleSheet.absoluteFill, styles.failedTint, { backgroundColor: hue }]} /> : null}
          <WorkoutGlyph color={colors.failedTileIcon} size={failedIconSize(size, hero)} />
        </View>
        {fade}
        {children}
      </View>
    );
  }

  return (
    <View testID={`${testID}-initials`} style={tileFrame}>
      <View {...hidden} style={[StyleSheet.absoluteFill, styles.tileContent]}>
        {tint}
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.initials, { color: ink, fontSize: initialsSize(size, hero), lineHeight: Math.round(initialsSize(size, hero) * 1.2) }]}
        >
          {exerciseInitials(name)}
        </Text>
      </View>
      {fade}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  // Board hero 300 × 180; callers may size it through `style`.
  hero: {
    width: '100%',
    aspectRatio: 5 / 3,
  },
  skeleton: {
    backgroundColor: colors.fillSkeleton,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  neutral: {
    backgroundColor: colors.fillSkeleton,
  },
  tileContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The muscle colour at 16 % (a token hue under opacity, no literal).
  tint: {
    opacity: TILE_ALPHA,
  },
  failedTint: {
    opacity: FAILED_TILE_ALPHA,
  },
  initials: {
    ...font(700),
    textAlign: 'center',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_FADE_HEIGHT,
  },
});
