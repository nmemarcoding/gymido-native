import { FIT, fitHeight, phoneFit } from './phoneFit';

// T-154 + T-155 v2 (owner-approved look, PM 30 Oct): the default = photo ≤ 300 + the 2.3.2 row/name + the compact card +
// the 64 Up next + the full-width Discard; the photo gives first, then the T-154 steps; always the largest that fits.
// `text` = the name (+ notes) without the Rest/How to row; a 1-line name is 38.
describe('phoneFit (T-155 v2)', () => {
  const ONE_LINE = 38;
  const TWO_LINES = 76;
  const inputs = { text: ONE_LINE, hasPhoto: true, previousRow: true, upNext: true, browse: false };

  it('the default needs 886 with a 1-line name; with that room nothing shrinks (photo 300, compact card 108)', () => {
    expect(fitHeight({ ...FIT.default, photo: 300, thumb: false, statsLine: true }, inputs)).toBe(886);
    expect(phoneFit({ available: 886, text: ONE_LINE })).toMatchObject({ photo: 300, steppers: 108, upNext: 64, discard: 48, thumb: false, fits: true });
  });

  it('the photo gives first, only as far as needed; then the gaps (390×844 with the status bar: ~693 free)', () => {
    expect(phoneFit({ available: 800, text: ONE_LINE })).toMatchObject({ photo: 214, gap: 12, steppers: 108, fits: true });
    // 886 − 693 = 193 short: the photo stops at its 112 floor (5 still short), so the gaps go to 8.
    expect(phoneFit({ available: 693, text: ONE_LINE })).toMatchObject({ photo: 112, gap: 8, steppers: 108, thumb: false, fits: true });
  });

  it('then the steppers 96, the arc 132 and the thumb (a 2-line name at ~693; 360×640: ~498)', () => {
    expect(phoneFit({ available: 693, text: TWO_LINES })).toMatchObject({ thumb: true, gap: 8, steppers: 96, arc: 132, fits: true });
    expect(phoneFit({ available: 498, text: ONE_LINE })).toMatchObject({ thumb: true, photo: 0, gap: 8, steppers: 96, arc: 132 });
  });

  it('it grows back: always computed from the default, so more room means the larger step again', () => {
    expect(phoneFit({ available: 498, text: ONE_LINE }).thumb).toBe(true);
    expect(phoneFit({ available: 886, text: ONE_LINE })).toMatchObject({ photo: 300, thumb: false, gap: 12 });
  });

  it('browse: never the tight-stepper step; the Volume·Reps line hides only as the very last step', () => {
    expect(phoneFit({ available: 300, text: ONE_LINE, browse: true, upNext: false }).steppers).not.toBe(FIT.steppersTight);
    const roomy = phoneFit({ available: 600, text: ONE_LINE, browse: true, upNext: false });
    expect(roomy.statsLine).toBe(true);
    const tight = phoneFit({ available: 400, text: ONE_LINE, browse: true, upNext: false });
    expect(tight).toMatchObject({ thumb: true, statsLine: false });
  });
});
