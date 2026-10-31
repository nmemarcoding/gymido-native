import { FIT, fitHeight, phoneFit } from './phoneFit';

// T-154 rev 42 C check numbers. The free height = window − status/safe top − header 60 − bar 10 − bottom inset.
describe('phoneFit (rev 42)', () => {
  const ONE_LINE = 32 + 4 + 38;
  const TWO_LINES = 32 + 4 + 76;

  it('390×844 (693 free), a 1-line name: no step; 688 used', () => {
    const fit = phoneFit({ available: 693, text: ONE_LINE });
    expect(fit).toMatchObject({ photo: 160, gap: 12, steppers: 108, arc: 154, thumb: false, fits: true });
    expect(fitHeight(fit, { text: ONE_LINE, hasPhoto: true, previousRow: true, upNext: true })).toBe(688);
  });

  it('390×844, a 2-line name: step 1 only, the photo gives up the 33 it lacks (127; rev 42 C estimated ≈ 122)', () => {
    expect(phoneFit({ available: 693, text: TWO_LINES })).toMatchObject({ photo: 127, gap: 12, steppers: 108, arc: 154, thumb: false, fits: true });
  });

  // Rev 42 C says steps 1–3 fit the SE, but its own sizes don't add up there: at the floors (photo 112, gaps 8) the screen
  // still needs 632 of ~577. So the steps go on, in order, to the thumb (reported to UX via the PM).
  it('375×667 SE (~577 free): steps 1–5 are not enough, so the thumb mode; it fits', () => {
    const fit = phoneFit({ available: 577, text: ONE_LINE });
    expect(fitHeight({ ...fit, photo: FIT.photoFloor, gap: 8, steppers: 108, arc: 154, thumb: false }, { text: ONE_LINE, hasPhoto: true, previousRow: true, upNext: true })).toBe(632);
    expect(fit).toMatchObject({ thumb: true, gap: 8, steppers: 96, arc: 132, fits: true });
  });

  it('360×640 Android 3-button (~498 free): thumb mode with the compact card; it fits', () => {
    const fit = phoneFit({ available: 498, text: ONE_LINE });
    expect(fit).toMatchObject({ thumb: true, photo: 0, gap: 8, steppers: 96, arc: 132, fits: true });
  });

  it('browse 390×844 (693 − the 56 navigator): fits with the Volume·Reps line', () => {
    const fit = phoneFit({ available: 693 - 56, text: ONE_LINE, browse: true, upNext: false });
    expect(fit.statsLine).toBe(true);
    expect(fit.fits).toBe(true);
  });

  it('browse 360×640: the Volume·Reps line hides only as the very last step, when it does not fit', () => {
    // 360×640 browse (498 − the 56 navigator): the thumb mode fits WITH the line (410 of 442).
    const roomy = phoneFit({ available: 498 - 56, text: ONE_LINE, browse: true, upNext: false });
    expect(roomy).toMatchObject({ thumb: true, statsLine: true, fits: true });
    // 10 short of that: only now the line hides.
    const tight = phoneFit({ available: 400, text: ONE_LINE, browse: true, upNext: false });
    expect(tight).toMatchObject({ thumb: true, statsLine: false, fits: true });
  });

  it('browse never shrinks the steppers (there are none)', () => {
    expect(phoneFit({ available: 300, text: ONE_LINE, browse: true }).steppers).toBe(FIT.steppers);
  });
});
