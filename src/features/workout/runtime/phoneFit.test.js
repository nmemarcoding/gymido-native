import { FIT, fitHeight, phoneFit } from './phoneFit';

// T-154 + T-155 (RN-SPEC dated 30 Oct): the full 2.3.2 look by default; the ladder only when it doesn't fit; always the
// largest that fits. `text` = the name (+ notes) without the Rest/How to row; a 1-line name is 38.
describe('phoneFit (T-155 default + T-154 ladder)', () => {
  const ONE_LINE = 38;
  const TWO_LINES = 76;
  const inputs = { text: ONE_LINE, hasPhoto: true, previousRow: true, upNext: true, browse: false };
  const full = { ...FIT.full, photo: 240, thumb: false, statsLine: true };

  it('the full look needs 838 with a 1-line name; with that room nothing shrinks (photo 240)', () => {
    expect(fitHeight(full, inputs)).toBe(838);
    expect(phoneFit({ available: 838, text: ONE_LINE })).toMatchObject({ compact: false, photo: 240, steppers: 116, upNext: 64, thumb: false, fits: true });
  });

  it('(a) a little short: only the photo gives up the room, down to 160, still the full sizes', () => {
    expect(phoneFit({ available: 800, text: ONE_LINE })).toMatchObject({ compact: false, photo: 202, fits: true });
    expect(phoneFit({ available: 758, text: ONE_LINE })).toMatchObject({ compact: false, photo: 160, fits: true });
  });

  it('(b) then the T-154 compact sizes with the photo at 160 (390×844 with the status bar: ~693 free)', () => {
    expect(phoneFit({ available: 693, text: ONE_LINE })).toMatchObject({ compact: true, photo: 160, steppers: 108, upNext: 48, gap: 12, fits: true });
  });

  it('(c) and on: the photo to 112, the tight gaps, the steppers 96, the arc 132, then the thumb (360×640: ~498)', () => {
    expect(phoneFit({ available: 693, text: TWO_LINES })).toMatchObject({ compact: true, photo: 127, gap: 12, fits: true });
    expect(phoneFit({ available: 498, text: ONE_LINE })).toMatchObject({ compact: true, thumb: true, photo: 0, gap: 8, steppers: 96, arc: 132, fits: true });
  });

  it('it grows back: always computed from the full sizes, so more room means the larger step again', () => {
    expect(phoneFit({ available: 498, text: ONE_LINE }).thumb).toBe(true);
    expect(phoneFit({ available: 838, text: ONE_LINE })).toMatchObject({ compact: false, photo: 240, thumb: false });
  });

  it('browse: no steppers; the Volume·Reps line hides only as the very last step', () => {
    // (The browse card has no steppers, so the tight-stepper step never applies there.)
    expect(phoneFit({ available: 300, text: ONE_LINE, browse: true, upNext: false }).steppers).not.toBe(FIT.steppersTight);
    const roomy = phoneFit({ available: 498, text: ONE_LINE, browse: true, upNext: false });
    expect(roomy.statsLine).toBe(true);
    const tight = phoneFit({ available: 380, text: ONE_LINE, browse: true, upNext: false });
    expect(tight).toMatchObject({ thumb: true, statsLine: false });
  });
});
