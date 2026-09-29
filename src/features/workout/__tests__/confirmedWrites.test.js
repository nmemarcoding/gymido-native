import { applyOverlay, overlayDisagrees, overlayEntry } from '../runtime/confirmedWrites';

// [O12] §1. The overlay is applied at one point and everything is derived from
// the result, so these pin the three pieces that make that safe.

const server = (sets) => ({
  id: 77,
  exercises: [{ id: 301, sets }],
});

describe('overlayEntry', () => {
  it('keeps exactly what the PATCH sent', () => {
    expect(
      overlayEntry({
        is_completed: true,
        actual_reps: 8,
        actual_weight_value: 100,
        actual_weight_unit: 'lb',
        completed_at: '2026-09-28T10:00:00.000Z',
        rest_seconds_actual: 90,
      })
    ).toEqual({
      is_completed: true,
      actual_reps: 8,
      actual_weight_value: 100,
      actual_weight_unit: 'lb',
      completed_at: '2026-09-28T10:00:00.000Z',
    });
  });
});

describe('applyOverlay', () => {
  it('returns the very same session when there is nothing to overlay', () => {
    const session = server([{ id: 201, is_completed: false }]);
    expect(applyOverlay(session, {})).toBe(session);
    expect(applyOverlay(null, { 201: { is_completed: true } })).toBeNull();
  });

  it('merges an entry over the server row and leaves the other rows alone', () => {
    const session = server([
      { id: 201, is_completed: false, target_reps_max: 12 },
      { id: 202, is_completed: false },
    ]);
    const overlaid = applyOverlay(session, { 201: overlayEntry({ is_completed: true, actual_reps: 12 }) });
    expect(overlaid.exercises[0].sets[0]).toMatchObject({ id: 201, is_completed: true, target_reps_max: 12 });
    expect(overlaid.exercises[0].sets[1]).toBe(session.exercises[0].sets[1]);
  });

  it('can overlay an un-do, not just a completion', () => {
    const session = server([{ id: 201, is_completed: true }]);
    const overlaid = applyOverlay(session, { 201: overlayEntry({ is_completed: false }) });
    expect(overlaid.exercises[0].sets[0].is_completed).toBe(false);
  });
});

describe('overlayDisagrees', () => {
  it('is false when the server has caught up', () => {
    expect(overlayDisagrees({ 201: { is_completed: true } }, server([{ id: 201, is_completed: true }]))).toBe(false);
  });

  it('is true when the server says the opposite — the server wins', () => {
    expect(overlayDisagrees({ 201: { is_completed: true } }, server([{ id: 201, is_completed: false }]))).toBe(true);
  });

  it('compares is_completed only, so a normalised weight is not a disagreement', () => {
    expect(
      overlayDisagrees(
        { 201: { is_completed: true, actual_weight_value: 100 } },
        server([{ id: 201, is_completed: true, actual_weight_value: 100.0001 }])
      )
    ).toBe(false);
  });

  it('ignores a set the server no longer returns — the session ended or moved on', () => {
    expect(overlayDisagrees({ 201: { is_completed: true } }, null)).toBe(false);
    expect(overlayDisagrees({ 999: { is_completed: true } }, server([{ id: 201, is_completed: false }]))).toBe(false);
  });
});
