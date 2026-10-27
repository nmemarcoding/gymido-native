import { Image, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { act, create } from 'react-test-renderer';

import { colors, gradients, muscle, muscleText } from '../theme/tokens';
import ExerciseImage, { exerciseInitials, failedIconSize, imageRadius, initialsSize, muscleColor, muscleTextColor } from './ExerciseImage';
import GradientFill from './GradientFill';

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const flat = (node) => StyleSheet.flatten(node.props.style);
const host = (tree, id) => tree.root.find((node) => typeof node.type === 'string' && node.props.testID === id);
const hostOrNull = (tree, id) => tree.root.findAll((node) => typeof node.type === 'string' && node.props.testID === id)[0] ?? null;
const failure = { nativeEvent: { error: 'Failed to load' } };
const cancelled = { nativeEvent: { error: 'cancelled' } };

// Fails every candidate URL until RemoteImage runs out.
function failAll(tree) {
  for (let i = 0; i < 10 && tree.root.findAllByType(Image).length > 0; i += 1) {
    act(() => {
      tree.root.findByType(Image).props.onError(failure);
    });
  }
}

const plank = { name: 'Plank', thumbnail: null, primary_muscle_group: { code: 'ABS' } };
const squat = { name: 'Back Squat', thumbnail: { url: 'https://example.com/squat.jpg' }, primary_muscle_group: { code: 'QUADS' } };

describe('ExerciseImage helpers', () => {
  it('maps muscle group codes onto the six v2 hues', () => {
    expect(muscleColor('CHEST')).toBe(muscle.chest);
    expect(muscleColor('BACK')).toBe(muscle.back);
    expect(muscleColor('UPPER_BACK')).toBe(muscle.back);
    expect(muscleColor('LOWER_BACK')).toBe(muscle.back);
    expect(muscleColor('TRAPS_NECK')).toBe(muscle.back);
    expect(muscleColor('BICEPS')).toBe(muscle.arms);
    expect(muscleColor('TRICEPS')).toBe(muscle.arms);
    expect(muscleColor('SHOULDERS')).toBe(muscle.arms);
    expect(muscleColor('ABS')).toBe(muscle.core);
    expect(muscleColor('GLUTES')).toBe(muscle.legs);
    expect(muscleColor('CARDIO')).toBe(muscle.cardio);
    expect(muscleColor('upper back')).toBe(muscle.back);
  });

  it('returns null for an unknown, empty or non-muscle code', () => {
    expect(muscleColor('NECK_FLEXORS')).toBeNull();
    expect(muscleColor(null)).toBeNull();
    expect(muscleColor(undefined)).toBeNull();
    expect(muscleColor('')).toBeNull();
    expect(muscleColor('ICON_LIGHT')).toBeNull();
    expect(muscleColor('ICON_DARK')).toBeNull();
  });

  it('builds two-letter initials (first two words; one word → its first two letters)', () => {
    expect(exerciseInitials('Plank')).toBe('PL');
    expect(exerciseInitials('Back Squat')).toBe('BS');
    expect(exerciseInitials('barbell bench press')).toBe('BB');
    expect(exerciseInitials('  push   up ')).toBe('PU');
    expect(exerciseInitials('A')).toBe('A');
    expect(exerciseInitials('')).toBe('');
    expect(exerciseInitials(null)).toBe('');
  });

  it('sizes the radius, initials and failed icon from the tile', () => {
    expect([40, 56, 72].map((size) => imageRadius(size, false))).toEqual([12, 12, 20]);
    expect(imageRadius(40, true)).toBe(24);
    expect([40, 56, 72].map((size) => initialsSize(size, false))).toEqual([14, 20, 26]);
    expect(initialsSize(40, true)).toBe(56);
    expect(failedIconSize(64, false)).toBe(28);
    expect(failedIconSize(40, true)).toBe(56);
  });
});

describe('ExerciseImage: no image URL (initials tile)', () => {
  it('draws the muscle colour at 16 % with the colour as 700 text, same size and radius as the photo', () => {
    const tree = render(<ExerciseImage exercise={plank} size={72} />);
    const tile = host(tree, 'exercise-image-initials');
    expect(flat(tile)).toMatchObject({ width: 72, height: 72, borderRadius: 20, overflow: 'hidden' });
    expect(flat(host(tree, 'exercise-image-tint'))).toMatchObject({ backgroundColor: muscle.core, opacity: 0.16, position: 'absolute' });
    const text = tree.root.findByType(Text);
    expect(text.props.children).toBe('PL');
    expect(flat(text)).toMatchObject({ color: muscle.core, fontSize: 26, fontFamily: 'Geist-Bold' });
    expect(flat(text).fontWeight).toBeUndefined();
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
  });

  it.each([
    [40, 12, 14],
    [56, 12, 20],
  ])('size %i → radius %i, text %i', (size, radius, fontSize) => {
    const tree = render(<ExerciseImage name="Back Squat" muscleCode="QUADS" size={size} />);
    expect(flat(host(tree, 'exercise-image-initials'))).toMatchObject({ width: size, borderRadius: radius });
    expect(flat(tree.root.findByType(Text))).toMatchObject({ fontSize, color: muscle.legs });
  });

  it('is decorative: hidden from screen readers', () => {
    const tree = render(<ExerciseImage exercise={plank} />);
    const text = tree.root.findByType(Text);
    const hiddenParent = tree.root.find(
      (node) => typeof node.type === 'string' && node.props.importantForAccessibility === 'no-hide-descendants',
    );
    expect(hiddenParent.props.accessibilityElementsHidden).toBe(true);
    expect(hiddenParent.findByType(Text)).toBe(text);
  });

  it('unknown muscle: fillSkeleton tile with textSecondary initials, no tint', () => {
    const tree = render(<ExerciseImage name="Neck Curl" muscleCode="NECK" size={56} />);
    expect(flat(host(tree, 'exercise-image-initials'))).toMatchObject({ backgroundColor: colors.fillSkeleton });
    expect(hostOrNull(tree, 'exercise-image-tint')).toBeNull();
    expect(flat(tree.root.findByType(Text))).toMatchObject({ color: colors.textSecondary });
  });

  it('no muscle group at all reads as unknown', () => {
    const tree = render(<ExerciseImage exercise={{ name: 'Mystery' }} />);
    expect(flat(host(tree, 'exercise-image-initials'))).toMatchObject({ backgroundColor: colors.fillSkeleton, width: 56 });
    expect(tree.root.findByType(Text).props.children).toBe('MY');
  });

  it('explicit url/name/muscleCode win over the exercise object', () => {
    const tree = render(<ExerciseImage exercise={squat} url={null} name="Plank" muscleCode="CHEST" />);
    expect(tree.root.findByType(Text).props.children).toBe('PL');
    expect(flat(tree.root.findByType(Text))).toMatchObject({ color: muscle.chest });
  });
});

describe('ExerciseImage: photo', () => {
  it('renders RemoteImage over the skeleton fill, clipped to the radius', () => {
    const tree = render(<ExerciseImage exercise={squat} size={40} accessibilityLabel="Back Squat" />);
    expect(flat(host(tree, 'exercise-image'))).toMatchObject({ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.fillSkeleton });
    const image = tree.root.findByType(Image);
    expect(image.props.source).toEqual({ uri: 'https://example.com/squat.jpg' });
    expect(image.props).toMatchObject({ accessible: true, accessibilityLabel: 'Back Squat', resizeMode: 'cover' });
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  });

  it('has no label when the name sits beside it', () => {
    const image = render(<ExerciseImage exercise={squat} />).root.findByType(Image);
    expect(image.props.accessible).toBe(false);
  });

  it('passes custom sources and resizeMode through', () => {
    const sources = ['https://example.com/a.jpg', 'https://example.com/b.jpg'];
    const image = render(<ExerciseImage url="https://example.com/x.jpg" sources={sources} resizeMode="contain" />).root.findByType(Image);
    expect(image.props).toMatchObject({ source: { uri: sources[0] }, resizeMode: 'contain' });
  });

  it('a cancelled load retries and does not count as a failure', () => {
    const tree = render(<ExerciseImage exercise={squat} />);
    act(() => {
      tree.root.findByType(Image).props.onError(cancelled);
    });
    expect(tree.root.findAllByType(Image)).toHaveLength(1);
    expect(hostOrNull(tree, 'exercise-image-failed')).toBeNull();
  });
});

describe('ExerciseImage: failed load', () => {
  it('shows the muscle tile with the workout icon, not initials', () => {
    const tree = render(<ExerciseImage exercise={squat} size={56} />);
    failAll(tree);
    const tile = host(tree, 'exercise-image-failed');
    expect(flat(tile)).toMatchObject({ width: 56, height: 56, borderRadius: 12 });
    // UX §8.1 (the board): a 22 % fill and a #C9D4E6 icon on a failed load.
    expect(flat(host(tree, 'exercise-image-tint'))).toMatchObject({ backgroundColor: muscle.legs, opacity: 0.22 });
    const svg = tree.root.findByType(Svg);
    expect(svg.props).toMatchObject({ width: 25, height: 25, stroke: '#C9D4E6', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' });
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
    const hidden = tree.root.find((node) => typeof node.type === 'string' && node.props.importantForAccessibility === 'no-hide-descendants');
    expect(hidden.findByType(Svg)).toBe(svg);
  });

  it('unknown muscle fails onto the neutral tile with a textSecondary icon', () => {
    const tree = render(<ExerciseImage url="https://example.com/x.jpg" name="X" />);
    failAll(tree);
    expect(flat(host(tree, 'exercise-image-failed'))).toMatchObject({ backgroundColor: colors.fillSkeleton });
    expect(tree.root.findByType(Svg).props.stroke).toBe('#C9D4E6');
  });

  it('a new URL after a failure tries the photo again', () => {
    const tree = render(<ExerciseImage exercise={squat} />);
    failAll(tree);
    expect(hostOrNull(tree, 'exercise-image-failed')).not.toBeNull();
    act(() => {
      tree.update(<ExerciseImage exercise={{ ...squat, thumbnail: { url: 'https://example.com/other.jpg' } }} />);
    });
    expect(tree.root.findByType(Image).props.source).toEqual({ uri: 'https://example.com/other.jpg' });
  });
});

describe('ExerciseImage: loading', () => {
  it('is a skeleton block of the same size and radius, hidden, with no image', () => {
    const tree = render(<ExerciseImage exercise={squat} size={72} loading />);
    const block = host(tree, 'exercise-image-loading');
    expect(flat(block)).toMatchObject({ width: 72, height: 72, borderRadius: 20, backgroundColor: colors.fillSkeleton });
    expect(block.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(0);
  });

  it('hero loading keeps the hero frame', () => {
    const tree = render(<ExerciseImage hero loading />);
    expect(flat(host(tree, 'exercise-image-loading'))).toMatchObject({ width: '100%', borderRadius: 24 });
  });
});

describe('ExerciseImage: hero', () => {
  const fade = (tree) => tree.root.findAllByType(GradientFill).find((fill) => fill.props.colors === gradients.imageFade.colors);

  it('no photo: full-size initials tile (56) with the 90 px bottom fade', () => {
    const tree = render(<ExerciseImage exercise={plank} hero style={{ height: 180 }} />);
    expect(flat(host(tree, 'exercise-image-initials'))).toMatchObject({ width: '100%', height: 180, borderRadius: 24 });
    expect(flat(tree.root.findByType(Text))).toMatchObject({ fontSize: 56 });
    const fill = fade(tree);
    expect(fill.props.angle).toBe(180);
    expect(flat(fill.parent)).toMatchObject({ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 });
  });

  it('photo: the same fade over the photo, and overlay children above it', () => {
    const tree = render(
      <ExerciseImage exercise={squat} hero>
        <View testID="name-overlay" />
      </ExerciseImage>,
    );
    expect(fade(tree)).toBeDefined();
    expect(hostOrNull(tree, 'name-overlay')).not.toBeNull();
  });

  it('failed hero: workout icon at 56 with the fade', () => {
    const tree = render(<ExerciseImage exercise={squat} hero />);
    failAll(tree);
    expect(tree.root.findByType(Svg).props).toMatchObject({ width: 56, height: 56 });
    expect(fade(tree)).toBeDefined();
  });

  it('thumbnails draw no fade', () => {
    expect(render(<ExerciseImage exercise={plank} />).root.findAllByType(GradientFill)).toHaveLength(0);
  });
});

describe('muscleTextColor (kit 2: shared, was duplicated in two screens)', () => {
  it.each([
    ['CHEST', muscleText.chest],
    ['BACK', muscleText.back],
    ['ARMS', muscleText.arms],
    ['BICEPS', muscleText.arms],
    ['triceps', muscleText.arms],
    ['CORE', muscleText.core],
    ['CARDIO', muscleText.cardio],
    ['QUADS', muscleText.legs],
  ])('%s → its lighter text colour', (code, expected) => {
    expect(muscleTextColor(code)).toBe(expected);
  });

  it('is the text partner of muscleColor for every muscle hue', () => {
    Object.keys(muscle).forEach((name) => {
      expect(muscleTextColor(name.toUpperCase())).toBe(muscleText[name]);
      expect(muscleColor(name.toUpperCase())).toBe(muscle[name]);
    });
  });

  it('null without a muscle hue (no code, unknown code, the icon hues)', () => {
    [null, undefined, '', 'NOT_A_MUSCLE', 'ICON_LIGHT'].forEach((code) => expect(muscleTextColor(code)).toBeNull());
  });
});
