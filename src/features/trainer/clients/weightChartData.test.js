import { buildWeightSeries, logsSince, thinLabels } from './weightChartData';

describe('buildWeightSeries (§C5.3)', () => {
  it('plots raw numbers oldest first with a ±1 domain', () => {
    const series = buildWeightSeries(
      [
        { recorded_on: '2026-09-01', weight_value: '80', weight_unit: 'kg' },
        { recorded_on: '2026-09-10', weight_value: '176', weight_unit: 'lb' },
      ],
      null
    );
    expect(series.points.map((p) => p.value)).toEqual([80, 176]);
    expect(series.points[0].label).toBe('Sep 2');
    expect(series).toMatchObject({ unit: 'kg', min: 79, max: 177 });
  });

  it('falls back to the profile unit, then kg', () => {
    expect(buildWeightSeries([], { current_weight_unit: 'lb' }).unit).toBe('lb');
    expect(buildWeightSeries([], null).unit).toBe('kg');
  });
});

describe('thinLabels', () => {
  it('always keeps the first and last label', () => {
    const labels = ['Sep 1', 'Sep 2', 'Sep 3', 'Sep 4', 'Sep 5'];
    const shown = thinLabels(labels, 10);
    expect(shown[0]).toBe('Sep 1');
    expect(shown[4]).toBe('Sep 5');
    expect(shown.slice(1, 4).every((label) => label === '')).toBe(true);
  });

  it('keeps labels that are far enough apart', () => {
    expect(thinLabels(['Sep 1', 'Sep 2', 'Sep 3'], 100)).toEqual(['Sep 1', 'Sep 2', 'Sep 3']);
  });
});

describe('logsSince', () => {
  it('keeps logs inside the window', () => {
    const now = Date.UTC(2026, 9, 22);
    const logs = [{ recorded_on: '2026-08-01' }, { recorded_on: '2026-10-01' }];
    expect(logsSince(logs, 30, now)).toEqual([{ recorded_on: '2026-10-01' }]);
  });
});
