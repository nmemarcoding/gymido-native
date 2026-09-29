import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import ProgressRing, { ringLabelStyles } from '../components/ProgressRing';

// RN-SPEC-workout §2.4. The owner reported every ring's label sitting BELOW the
// circle. The component was already an overlay; the overlay just never applied,
// because it spread the removed `StyleSheet.absoluteFillObject`. These pin the
// placement itself, plus the per-usage content and accessibility sentences.

const flatten = (style) => StyleSheet.flatten(style);
// The overlay is deliberately hidden from screen readers (the ring itself is the
// accessible image), so queries must opt in to reach it.
const HIDDEN = { includeHiddenElements: true };
const overlay = () => screen.getByTestId('progress-ring-label', HIDDEN);

describe('ProgressRing (§2.4)', () => {
  it('renders its label in an overlay that is absolutely positioned over the ring', async () => {
    await render(
      <ProgressRing value={1} total={4} size={56} thickness={8} label="1 of 4 sets done">
        <Text>1/4</Text>
      </ProgressRing>
    );
    expect(flatten(overlay().props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    });
  });

  it('is one accessible image, and hides the overlay so the number is not read twice', async () => {
    await render(
      <ProgressRing value={2} total={4} size={56} thickness={8} label="2 of 4 sets done">
        <Text>2/4</Text>
      </ProgressRing>
    );
    const ring = screen.getByTestId('progress-ring');
    expect(ring).toHaveAccessibleName('2 of 4 sets done');
    expect(ring.props.accessibilityRole).toBe('image');
    expect(overlay().props.importantForAccessibility).toBe(
      'no-hide-descendants'
    );
  });

  it('hub hero: the count stacked over "of {total}"', async () => {
    await render(
      <ProgressRing value={0} total={3} size={84} thickness={9} label="0 of 3 training days completed this week">
        <Text style={ringLabelStyles.heroCount}>0</Text>
        <Text style={ringLabelStyles.heroTotal}>of 3</Text>
      </ProgressRing>
    );
    const label = overlay();
    expect(within(label).getByText('0', HIDDEN)).toBeOnTheScreen();
    expect(within(label).getByText('of 3', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByTestId('progress-ring')).toHaveAccessibleName(
      '0 of 3 training days completed this week'
    );
    expect(flatten(ringLabelStyles.heroTotal)).toMatchObject({
      marginTop: 2,
      fontSize: 9.6,
      letterSpacing: 1.34,
      textTransform: 'uppercase',
    });
  });

  it('ExerciseStage: one line, "{done}/{total}", with no "of"', async () => {
    await render(
      <ProgressRing value={1} total={4} size={56} thickness={8} label="1 of 4 sets done">
        <Text style={ringLabelStyles.fraction}>1/4</Text>
      </ProgressRing>
    );
    const label = overlay();
    expect(within(label).getByText('1/4', HIDDEN)).toBeOnTheScreen();
    expect(within(label).queryByText(/of/, HIDDEN)).not.toBeOnTheScreen();
    expect(flatten(ringLabelStyles.fraction)).toMatchObject({ fontSize: 12, fontWeight: '900' });
  });

  it('does not clip an over-long label: the wrapper has no overflow hidden', async () => {
    await render(
      <ProgressRing value={100} total={100} size={56} thickness={8} label="100 of 100 sets done">
        <Text>100/100</Text>
      </ProgressRing>
    );
    expect(flatten(screen.getByTestId('progress-ring').props.style).overflow).toBeUndefined();
  });
});
