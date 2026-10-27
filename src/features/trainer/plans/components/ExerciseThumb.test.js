import { Image, StyleSheet, Text } from 'react-native';
import Svg from 'react-native-svg';
import { act, create } from 'react-test-renderer';

import { colors, muscle } from '../../../../shared/theme/tokens';
import ExerciseThumb, { getMuscleTileColors } from './ExerciseThumb';

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const flat = (node) => StyleSheet.flatten(node.props.style);
const host = (tree, id) => tree.root.find((node) => typeof node.type === 'string' && node.props.testID === id);

const withPhoto = { name: 'Bench Press', thumbnail: { url: 'https://example.com/bench.jpg' }, primary_muscle_group: { code: 'CHEST' } };
const noPhoto = { name: 'Bench Press', thumbnail: null, primary_muscle_group: { code: 'CHEST' } };

describe('ExerciseThumb (v2: through ExerciseImage)', () => {
  it('photo: 52 by default, radius 12, hairline frame', () => {
    const tree = render(<ExerciseThumb exercise={withPhoto} />);
    expect(flat(host(tree, 'exercise-image'))).toMatchObject({ width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.hairline });
    expect(tree.root.findByType(Image).props.source).toEqual({ uri: 'https://example.com/bench.jpg' });
  });

  it('framed={false} drops the frame and keeps the size', () => {
    const tree = render(<ExerciseThumb exercise={withPhoto} size={56} framed={false} />);
    const style = flat(host(tree, 'exercise-image'));
    expect(style).toMatchObject({ width: 56, height: 56, borderRadius: 12 });
    expect(style.borderWidth).toBeUndefined();
  });

  it('no URL: the initials tile in the muscle colour (was the dumbbell tile)', () => {
    const tree = render(<ExerciseThumb exercise={noPhoto} />);
    expect(tree.root.findByType(Text).props.children).toBe('BP');
    expect(flat(tree.root.findByType(Text)).color).toBe(muscle.chest);
    expect(tree.root.findAllByType(Svg)).toHaveLength(0);
  });

  it('failed URL: the muscle tile with the workout icon (was an empty frame)', () => {
    const tree = render(<ExerciseThumb exercise={withPhoto} />);
    for (let i = 0; i < 10 && tree.root.findAllByType(Image).length > 0; i += 1) {
      act(() => {
        tree.root.findByType(Image).props.onError({ nativeEvent: { error: 'Failed' } });
      });
    }
    expect(host(tree, 'exercise-image-failed')).toBeTruthy();
    // UX §8.1 (the board): the failed tile's icon is #C9D4E6.
    expect(tree.root.findByType(Svg).props.stroke).toBe('#C9D4E6');
  });

  it('keeps the exported v1 tile palette for PlanDetailScreen', () => {
    expect(getMuscleTileColors('LEGS')[0]).toBe(muscle.legs);
    expect(getMuscleTileColors(undefined)).toEqual(getMuscleTileColors('BACK'));
    expect(getMuscleTileColors('NOPE')).toEqual([colors.brand400, colors.navy]);
  });
});
