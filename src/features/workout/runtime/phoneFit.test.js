import { FIT, FULL, fitSizes, fitSteps, nextFitStep, photoFloor } from './phoneFit';

// T-162 = LIVE-WORKOUT-SPEC §12 P5 + P5-SC (a). DECLARED (T-162, owner-approved: the photo gives LAST): replaces the T-161
// R1/R2/C1/L2–L7 ladder tests; every assertion below is new.
describe('phoneFit ladder (T-162, P5 + P5-SC)', () => {
  const live = { hasPhoto: true, browse: false, columnWidth: 402 };
  const index = (step, browse = false) => fitSteps(browse).indexOf(step);
  // Steps until it fits, `overAt(state)` standing in for the measurement after each step.
  const run = (overAt, context = live) => {
    let state = FULL;
    for (let guard = 0; guard < 30; guard += 1) {
      const next = nextFitStep(state, { ...context, over: overAt(state) });
      if (!next) {
        return state;
      }
      state = next;
    }
    throw new Error('the ladder did not settle');
  };

  it('fits: no step', () => {
    expect(nextFitStep(FULL, { ...live, over: 0 })).toBeNull();
  });

  it('everything else gives before the photo: S1 … S5 first, the photo untouched', () => {
    let state = FULL;
    for (const step of ['S1', 'S2', 'S3', 'S4', 'S5']) {
      state = nextFitStep(state, { ...live, over: 50 });
      expect(state).toEqual({ level: index(step), photo: null });
    }
  });

  it('S6 only for a name on 2+ lines; S3 only with an Up next row', () => {
    const atS5 = { level: index('S5'), photo: null };
    expect(nextFitStep(atS5, { ...live, over: 5, nameLines: 2 })).toEqual({ level: index('S6'), photo: null });
    expect(nextFitStep(atS5, { ...live, over: 5, nameLines: 1, photoDrawn: 280 })).toEqual({ level: index('S7a'), photo: 275 });
    expect(nextFitStep({ level: index('S2'), photo: null }, { ...live, over: 5, upNext: false })).toEqual({ level: index('S4'), photo: null });
  });

  it('S7a: the photo from its natural height down to 200, only as far as needed; then SC; then S7b to the floor', () => {
    const atS6 = { level: index('S6'), photo: null };
    expect(nextFitStep(atS6, { ...live, over: 30, photoDrawn: 242 })).toEqual({ level: index('S7a'), photo: 212 });
    expect(nextFitStep(atS6, { ...live, over: 90, photoDrawn: 242 })).toEqual({ level: index('S7a'), photo: 200 });
    const atFloor200 = { level: index('S7a'), photo: 200 };
    expect(nextFitStep(atFloor200, { ...live, over: 20 })).toEqual({ level: index('SC'), photo: 200 });
    const scaled = { level: index('SC'), photo: 200 };
    expect(nextFitStep(scaled, { ...live, over: 20 })).toEqual({ level: index('S7b'), photo: 180 });
    expect(nextFitStep(scaled, { ...live, over: 80 })).toEqual({ level: index('S7b'), photo: 160 });
    expect(nextFitStep({ level: index('S7b'), photo: 160 }, { ...live, over: 5 })).toBeNull();
  });

  it('the floor: 160 on a 390+ column, 112 below (375, 360)', () => {
    expect(photoFloor(390)).toBe(160);
    expect(photoFloor(375)).toBe(112);
    const scaled = { level: index('SC'), photo: 200 };
    expect(nextFitStep(scaled, { ...live, columnWidth: 360, over: 120 })).toEqual({ level: index('S7b'), photo: 112 });
  });

  it('a photo already under 200 at its aspect skips S7a; no photo skips both photo steps', () => {
    const atS5 = { level: index('S5'), photo: null };
    expect(nextFitStep(atS5, { ...live, over: 10, photoDrawn: 190 })).toEqual({ level: index('SC'), photo: null });
    expect(nextFitStep(atS5, { hasPhoto: false, over: 10 })).toEqual({ level: index('SC'), photo: null });
    expect(nextFitStep({ level: index('SC'), photo: null }, { hasPhoto: false, over: 10 })).toBeNull();
  });

  it('browse: no steppers or Up next; the totals line hides (S9) BEFORE the photo gives', () => {
    expect(fitSteps(true)).toEqual(['S1', 'S2', 'S4', 'S5', 'S6', 'S9', 'S7a', 'SC', 'S7b']);
    const atS6 = { level: index('S6', true), photo: null };
    expect(nextFitStep(atS6, { hasPhoto: true, browse: true, over: 10, photoDrawn: 242 })).toEqual({ level: index('S9', true), photo: null });
    expect(fitSizes({ level: index('S9', true), photo: null }, { browse: true }).statsLine).toBe(false);
  });

  it('a full run: the photo absorbs exactly what is left after S1–S5 (390×844-like: 98 saved, 120 over)', () => {
    const saves = { S1: 12, S2: 30, S3: 16, S4: 36, S5: 4 };
    const overAt = (state) => {
      const taken = fitSteps(false).slice(0, state.level + 1).reduce((sum, step) => sum + (saves[step] ?? 0), 0);
      return 120 - taken - (242 - Math.min(242, state.photo ?? 300));
    };
    expect(run(overAt, { ...live, photoDrawn: 242 })).toEqual({ level: index('S7a'), photo: 220 });
  });

  it('fitSizes: FULL is the roomy look; the S-steps and SC switch the sizes; never a thumb', () => {
    expect(fitSizes(FULL)).toMatchObject({ photo: 300, photoTop: 6, gap: 12, containerGap: 12, upNextGap: 12, discardTop: 12, compactCard: false, upNextSlim: false, discardLink: false, rowCompact: false, nameSmall: false, statsLine: true, scaled: false, thumb: false });
    expect(fitSizes({ level: index('S1'), photo: null })).toMatchObject({ gap: 8, upNextGap: 8, discardTop: 16 });
    expect(fitSizes({ level: index('S4'), photo: null })).toMatchObject({ compactCard: true, upNextSlim: true, discardLink: true, discardTop: -4, rowCompact: false });
    expect(fitSizes({ level: index('SC'), photo: 200 })).toMatchObject({ scaled: true, photoTop: 4, gap: 6, discardTop: -2, photo: 200, thumb: false });
    expect(fitSizes({ level: index('S7b'), photo: FIT.floorNarrow })).toMatchObject({ scaled: true, photo: 112, thumb: false });
  });
});
