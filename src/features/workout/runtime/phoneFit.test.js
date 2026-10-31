import { FIT, cellHeight, fitHeight, phoneFit } from './phoneFit';

// T-154 + T-155 (owner-approved look, PM 30 Oct). Round 3 (PM 30 Oct): the largest layout that fits, by a search; the
// measured blocks + a measured correction instead of budgets; the notes give first (1 line + More), then the photo.
// DECLARED (T-155 round 3, PM decisions 1–3 + owner "photo at least as big as web's"): the default is 902 (was 886: the
// compact cell is drawn 124, not 108); the steps are searched again after the thumb; the notes clamp before the photo.
describe('phoneFit (T-155 round 3)', () => {
  const ONE_LINE = 38;
  const TWO_LINES = 76;
  const NOTES = { notes: 96, notesClamped: 66 };
  const full = { ...FIT.default, photo: 300, thumb: false, notesClamp: false, statsLine: true };

  it('the cell is counted as drawn (124; 116 at the tight step), never under the steppers minimum', () => {
    expect(cellHeight(108)).toBe(124);
    expect(cellHeight(96)).toBe(116);
  });

  it('the default needs 902 with a 1-line name and no notes; with that room nothing shrinks', () => {
    expect(fitHeight(full, { name: ONE_LINE })).toBe(902);
    expect(phoneFit({ available: 902, name: ONE_LINE })).toMatchObject({ photo: 300, gap: 12, steppers: 108, arc: 154, thumb: false, notesClamp: false, fits: true });
  });

  it('the photo gives first, only as far as needed; then the gaps, the steppers, the arc, cumulatively', () => {
    expect(phoneFit({ available: 800, name: ONE_LINE })).toMatchObject({ photo: 198, gap: 12, steppers: 108, thumb: false });
    expect(phoneFit({ available: 708, name: ONE_LINE })).toMatchObject({ photo: 114, gap: 8, steppers: 108, arc: 154, thumb: false });
    // Never a later step without the earlier ones (arc tight with the gaps still 12).
    expect(phoneFit({ available: 693, name: ONE_LINE })).toMatchObject({ photo: 129, gap: 8, steppers: 96, arc: 132, thumb: false });
  });

  it('the photo is never budgeted above what it draws at its aspect; a short photo still counts as fitting', () => {
    const fit = phoneFit({ available: 800, name: ONE_LINE, photoNatural: 160 });
    expect(fit).toMatchObject({ thumb: false, gap: 12, fits: true });
    expect(fit.photo).toBeGreaterThanOrEqual(160);
    expect(fit.height).toBe(902 - 300 + 160);
    expect(phoneFit({ available: 700, name: ONE_LINE, photoNatural: 100 })).toMatchObject({ thumb: false, fits: true });
  });

  it('notes give before the photo: clamped to 1 line + More while the photo stays as large as it can', () => {
    expect(phoneFit({ available: 998, name: ONE_LINE, ...NOTES })).toMatchObject({ photo: 300, notesClamp: false, fits: true });
    expect(phoneFit({ available: 902, name: ONE_LINE, ...NOTES })).toMatchObject({ photo: 234, notesClamp: true, thumb: false });
    // Notes that are already one line have nothing to clamp.
    expect(phoneFit({ available: 902, name: ONE_LINE, notes: 66, notesClamped: 66 })).toMatchObject({ photo: 234, notesClamp: false });
  });

  // PM 30 Oct (iPhone 17 shot: the thumb with ~80 pt unused): after the thumb the steps are searched again from the full
  // size, so the thumb layout takes the room it has.
  it('the thumb grows back: the full gaps, steppers and arc when they fit beside the thumb', () => {
    expect(phoneFit({ available: 708, name: ONE_LINE, nameThumb: TWO_LINES, ...NOTES })).toMatchObject({ thumb: true, notesClamp: true, gap: 12, steppers: 108, arc: 154, fits: true });
    expect(phoneFit({ available: 640, name: ONE_LINE, nameThumb: TWO_LINES })).toMatchObject({ thumb: true, gap: 12, steppers: 108, arc: 154, fits: true });
    expect(phoneFit({ available: 600, name: ONE_LINE, nameThumb: TWO_LINES })).toMatchObject({ thumb: true, gap: 8, steppers: 96, arc: 132, fits: true });
  });

  it('the iPhone 17 notes case: no thumb while the photo fits at its floor', () => {
    // 902 + 66 (the clamped notes) − 188 (the photo at 112) − 8 − 8 − 22 = 742.
    expect(phoneFit({ available: 742, name: ONE_LINE, nameThumb: TWO_LINES, ...NOTES })).toMatchObject({ thumb: false, photo: 112, notesClamp: true, fits: true });
    expect(phoneFit({ available: 741, name: ONE_LINE, nameThumb: TWO_LINES, ...NOTES }).thumb).toBe(true);
  });

  it('the thumb mode budgets the name at its narrower width (the measured beside-the-thumb height)', () => {
    const thumb = { ...full, photo: 0, thumb: true };
    expect(fitHeight(thumb, { name: ONE_LINE, nameThumb: 3 * ONE_LINE }) - fitHeight(thumb, { name: ONE_LINE, nameThumb: ONE_LINE })).toBe(2 * ONE_LINE);
    expect(fitHeight(thumb, { name: 3 * ONE_LINE, nameThumb: ONE_LINE })).toBe(fitHeight(thumb, { name: ONE_LINE, nameThumb: ONE_LINE }));
  });

  it('the correction (measured content − model) is fitted against the real room', () => {
    expect(phoneFit({ available: 902, name: ONE_LINE, correction: 0 }).photo).toBe(300);
    expect(phoneFit({ available: 902, name: ONE_LINE, correction: 20 }).photo).toBe(280);
    // The reported height stays the model's, so the next correction is measured against the same thing.
    expect(phoneFit({ available: 902, name: ONE_LINE, correction: 20 }).height).toBe(882);
  });

  it('it grows back: always searched from the full size, so more room means the larger layout again', () => {
    expect(phoneFit({ available: 600, name: ONE_LINE }).thumb).toBe(true);
    expect(phoneFit({ available: 902, name: ONE_LINE })).toMatchObject({ photo: 300, thumb: false, gap: 12 });
  });

  it('browse: never the tight-stepper step; the Volume·Reps line hides only as the very last step', () => {
    const roomy = phoneFit({ available: 600, name: ONE_LINE, ...NOTES, browse: true, upNext: false });
    expect(roomy).toMatchObject({ statsLine: true, steppers: 108 });
    const tight = phoneFit({ available: 400, name: ONE_LINE, ...NOTES, browse: true, upNext: false });
    expect(tight).toMatchObject({ thumb: true, notesClamp: true, steppers: 108, statsLine: false, fits: false });
  });

  it('no photo: the steps only (no thumb)', () => {
    expect(phoneFit({ available: 640, name: ONE_LINE, hasPhoto: false })).toMatchObject({ thumb: false, gap: 12, fits: true });
    expect(phoneFit({ available: 300, name: ONE_LINE, hasPhoto: false })).toMatchObject({ thumb: false, arc: 132, fits: false });
  });
});
