import { fireEvent, render, screen } from '@testing-library/react-native';

import ExerciseSheet from '../runtime/ExerciseSheet';

// §19.7's two thumbnail fallbacks are distinct on purpose and easy to collapse
// into one, so they get their own tests: a missing URL shows the position
// number, a FAILING URL deliberately does not — otherwise a transient network
// failure would look permanently like "no image was ever set".
function sessionWith(thumbnail) {
  return {
    id: 77,
    exercises: [
      {
        id: 301,
        exercise_name_snapshot: 'Leg Press',
        exercise: {
          id: 5,
          name: 'Leg Press',
          primary_muscle_group: { name: 'Quads' },
          ...(thumbnail ? { thumbnail: { url: thumbnail } } : {}),
        },
        sets: [{ id: 201, set_number: 1, is_completed: false }],
      },
    ],
  };
}

const renderSheet = (session) =>
  render(
    <ExerciseSheet
      visible
      session={session}
      muscle="all"
      activeIndex={0}
      onChangeMuscle={jest.fn()}
      onSelect={jest.fn()}
      onClose={jest.fn()}
    />
  );

describe('ExerciseSheet thumbnail fallbacks (§19.7)', () => {
  it('(a) shows the position number in the well when there is no URL at all', async () => {
    await renderSheet(sessionWith(null));
    const well = screen.getByTestId('sheet-exercise-301');
    // The number appears twice: once in the well, once in the corner badge.
    expect(within301('1')).toBe(2);
    expect(well).toBeOnTheScreen();
  });

  it('(b) leaves the well empty when a URL is present but every candidate fails', async () => {
    await renderSheet(sessionWith('https://cdn.test/broken.png'));
    // Only the corner badge carries the number; the well shows nothing.
    expect(within301('1')).toBe(1);

    // One candidate for a non-Drive URL, so a single error exhausts it.
    await fireEvent(screen.getByTestId('sheet-thumb-301'), 'error');
    expect(screen.queryByTestId('sheet-thumb-301')).not.toBeOnTheScreen();
    // The well is empty, and the number is NOT swapped in.
    expect(within301('1')).toBe(1);
  });
});

function within301(text) {
  return screen.queryAllByText(text).length;
}
