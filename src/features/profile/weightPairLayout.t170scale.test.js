import { WEIGHT_DIGITS, TABULAR_DIGIT_EM, weightPairStacks, weightTextRoom } from './weightPairLayout';

// T-170 step 4: the phone weight pair stacks when a whole weight no longer fits;
// the text scale counts only up to the body cap (2.0).
describe('weightPairStacks at the text scales', () => {
  const base = { gap: 12, chrome: 40, fontSize: 24 };
  // The column width at which the pair just fits at scale s.
  const fitColumn = (s) => 2 * (WEIGHT_DIGITS * TABULAR_DIGIT_EM * base.fontSize * Math.min(s, 2) + base.chrome) + base.gap;

  it.each([1, 1.15, 1.3, 1.31, 2])('fontScale %s: side by side exactly at the fit width, stacked 1 dp under it', (scale) => {
    const column = fitColumn(scale);
    expect(weightTextRoom({ column, gap: base.gap, chrome: base.chrome })).toBeCloseTo(WEIGHT_DIGITS * TABULAR_DIGIT_EM * base.fontSize * scale, 5);
    expect(weightPairStacks({ ...base, column: column + 0.01, fontScale: scale })).toBe(false);
    expect(weightPairStacks({ ...base, column: column - 1, fontScale: scale })).toBe(true);
  });

  it('a column that fits at 1.15 stacks at 1.31 and 2, and the scale is capped at 2', () => {
    const column = fitColumn(1.15) + 0.01;
    expect(weightPairStacks({ ...base, column, fontScale: 1.15 })).toBe(false);
    expect(weightPairStacks({ ...base, column, fontScale: 1.31 })).toBe(true);
    expect(weightPairStacks({ ...base, column, fontScale: 2 })).toBe(true);
    expect(weightPairStacks({ ...base, column, fontScale: 3.1 })).toBe(weightPairStacks({ ...base, column, fontScale: 2 }));
  });
});
