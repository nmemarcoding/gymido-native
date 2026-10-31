import { FIT, FULL, fitSizes, nextFitStep } from './phoneFit';

// T-161 LIVE-WORKOUT-SPEC §5.2 (= web 2.4.1). DECLARED (T-161, PM: build to the spec): the round-3 model search, its
// correction and the notes clamp are replaced by the spec's measured ladder (R1, R2, C1, L2–L7); every assertion below is new.
describe('phoneFit ladder (spec §5.2)', () => {
  const live = { hasPhoto: true, browse: false };
  // Steps until it fits, `overAt(state)` standing in for the measurement after each step.
  const run = (overAt, context = live) => {
    const steps = [];
    let state = FULL;
    for (let guard = 0; guard < 20; guard += 1) {
      const next = nextFitStep(state, { ...context, over: overAt(state) });
      if (!next) {
        return { state, steps };
      }
      steps.push(next);
      state = next;
    }
    throw new Error('the ladder did not settle');
  };

  it('fits: no step', () => {
    expect(nextFitStep(FULL, { ...live, over: 0 })).toBeNull();
    expect(nextFitStep(FULL, { ...live, over: -40 })).toBeNull();
  });

  it('R1: the roomy photo gives only what is over, down to 160', () => {
    expect(nextFitStep(FULL, { ...live, over: 58 })).toEqual({ roomy: true, photoMax: 242, level: 0 });
    expect(nextFitStep(FULL, { ...live, over: 200 })).toEqual({ roomy: true, photoMax: 160, level: 0 });
  });

  it('R1 starts from the photo as drawn (aspect-limited), not from the 300 cap', () => {
    // A 16:9 photo at 430 draws 242: 20 over → 222.
    expect(nextFitStep(FULL, { ...live, over: 20, photoDrawn: 242 })).toEqual({ roomy: true, photoMax: 222, level: 0 });
  });

  it('R2: at 160 still over → every size compact, photoMax 160; then C1 down to 112', () => {
    const r2 = nextFitStep({ roomy: true, photoMax: 160, level: 0 }, { ...live, over: 30 });
    expect(r2).toEqual({ roomy: false, photoMax: 160, level: 0 });
    expect(nextFitStep(r2, { ...live, over: 30 })).toEqual({ roomy: false, photoMax: 130, level: 0 });
    expect(nextFitStep(r2, { ...live, over: 90 })).toEqual({ roomy: false, photoMax: 112, level: 0 });
  });

  it('then the levels in order, cumulative; L2 only for a name over 2 lines; L4 live only; L6 only with a photo', () => {
    const c1 = { roomy: false, photoMax: 112, level: 0 };
    expect(nextFitStep(c1, { ...live, over: 5 })).toEqual({ ...c1, level: 3 });
    expect(nextFitStep(c1, { ...live, over: 5, nameLines: 3 })).toEqual({ ...c1, level: 2 });
    expect(nextFitStep({ ...c1, level: 3 }, { ...live, over: 5 })).toEqual({ ...c1, level: 4 });
    expect(nextFitStep({ ...c1, level: 3 }, { hasPhoto: true, browse: true, over: 5 })).toEqual({ ...c1, level: 5 });
    expect(nextFitStep({ ...c1, level: 5 }, { ...live, over: 5 })).toEqual({ ...c1, level: 6 });
    expect(nextFitStep({ ...c1, level: 5 }, { hasPhoto: false, browse: false, over: 5 })).toBeNull();
  });

  it('live ends at L6, browse at L7; still over → the layout stays (null)', () => {
    const l6 = { roomy: false, photoMax: 112, level: 6 };
    expect(nextFitStep(l6, { ...live, over: 5 })).toBeNull();
    expect(nextFitStep(l6, { hasPhoto: true, browse: true, over: 5 })).toEqual({ ...l6, level: 7 });
    expect(nextFitStep({ ...l6, level: 7 }, { hasPhoto: true, browse: true, over: 5 })).toBeNull();
  });

  it('no photo: R1 and C1 are skipped (R2 straight away, then the levels)', () => {
    expect(nextFitStep(FULL, { hasPhoto: false, browse: false, over: 10 })).toEqual({ roomy: false, photoMax: 160, level: 0 });
    expect(nextFitStep({ roomy: false, photoMax: 160, level: 0 }, { hasPhoto: false, browse: false, over: 10 })).toEqual({ roomy: false, photoMax: 160, level: 3 });
  });

  it('a full run against a measured page: only as far as needed (the photo absorbs the last over exactly)', () => {
    // The page is 60 over at FULL; R2 saves 50 (the compact sizes) — modelled: over = 60 − (300 − photoMax) − (roomy ? 0 : 50).
    const overAt = (state) => 60 - (300 - state.photoMax) - (state.roomy ? 0 : 50);
    expect(run(overAt).state).toEqual({ roomy: true, photoMax: 240, level: 0 });
    const tight = (state) => 300 - (300 - state.photoMax) - (state.roomy ? 0 : 50) - [0, 0, 0, 8, 16, 38, 150][state.level];
    expect(run(tight).state).toEqual({ roomy: false, photoMax: 112, level: 6 });
  });

  it('fitSizes: FULL is the roomy 2.3.2 look; compact and the levels switch the §3 sizes', () => {
    expect(fitSizes(FULL)).toMatchObject({ compact: false, photo: 300, photoTop: 6, gap: 12, containerGap: 12, steppers: FIT.steppers, arc: FIT.arc, thumb: false, statsLine: true, upNextGap: 12, discardTop: 12, nameSmall: false });
    expect(fitSizes({ roomy: false, photoMax: 140, level: 0 })).toMatchObject({ compact: true, photo: 140, photoTop: 8, gap: 12, upNextGap: 8, discardTop: -4 });
    expect(fitSizes({ roomy: false, photoMax: 112, level: 3 })).toMatchObject({ gap: 8, containerGap: 8, nameSmall: true, steppers: 108 });
    expect(fitSizes({ roomy: false, photoMax: 112, level: 5 })).toMatchObject({ steppers: 96, arc: 132, thumb: false });
    expect(fitSizes({ roomy: false, photoMax: 112, level: 7 })).toMatchObject({ thumb: true, statsLine: false });
  });
});
