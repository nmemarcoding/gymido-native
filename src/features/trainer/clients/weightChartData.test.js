import { buildWeightSeries, chartUnit, fixedDomainTicks, logsSince, monotoneXPath, thinLabels } from './weightChartData';

describe('buildWeightSeries (§C5.3)', () => {
  it('plots oldest first in one unit with a ±1 domain (T-38, retires ⚠C-9)', () => {
    const logs = [
      { recorded_on: '2026-09-01', weight_value: '80', weight_unit: 'kg' },
      { recorded_on: '2026-09-10', weight_value: '176', weight_unit: 'lb' },
    ];
    // No profile current weight → the NEWEST (last) log's unit.
    const series = buildWeightSeries(logs, null);
    expect(series.unit).toBe('lb');
    expect(series.points[0].value).toBeCloseTo(176.37, 2);
    expect(series.points[1].value).toBe(176);
    expect(series.points[0].label).toBe('Sep 2');
    expect(series.min).toBeCloseTo(175, 5);
    expect(series.max).toBeCloseTo(177.37, 2);
  });

  it("uses the profile's current unit when it has a current weight", () => {
    const logs = [
      { recorded_on: '2026-09-01', weight_value: '80', weight_unit: 'kg' },
      { recorded_on: '2026-09-02', weight_value: '78', weight_unit: 'kg' },
      { recorded_on: '2026-09-03', weight_value: '170', weight_unit: 'lb' },
    ];
    const series = buildWeightSeries(logs, { current_weight_value: 77, current_weight_unit: 'kg' });
    expect(series.unit).toBe('kg');
    expect(series.points.map((p) => Math.round(p.value * 100) / 100)).toEqual([80, 78, 77.11]);
  });

  it('takes an explicit unit (Progress passes its currentUnit)', () => {
    const logs = [{ weight_value: '80', weight_unit: 'kg' }, { weight_value: '170', weight_unit: 'lb' }];
    const series = buildWeightSeries(logs, null, 'kg');
    expect(series.unit).toBe('kg');
    expect(series.points.map((p) => Math.round(p.value * 100) / 100)).toEqual([80, 77.11]);
  });

  it('falls back to the newest log, then the profile unit, then kg', () => {
    expect(chartUnit([{ weight_unit: 'kg' }, { weight_unit: 'lb' }], { current_weight_value: null, current_weight_unit: 'kg' })).toBe('lb');
    expect(buildWeightSeries([], { current_weight_unit: 'lb' }).unit).toBe('lb');
    expect(buildWeightSeries([], null).unit).toBe('kg');
  });

  it('passes a log with no unit through unconverted', () => {
    const series = buildWeightSeries([{ weight_value: '80' }, { weight_value: '81', weight_unit: 'kg' }], null);
    expect(series.points.map((p) => p.value)).toEqual([80, 81]);
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

describe('fixedDomainTicks (Recharts fixed domain, tickCount 5)', () => {
  it('matches the web ticks for the 80/82/81/81/79 fixture', () => {
    expect(fixedDomainTicks(78, 83)).toEqual([78, 80, 82, 83]);
  });

  it('ends exactly on max when the step divides the range', () => {
    expect(fixedDomainTicks(0, 8)).toEqual([0, 2, 4, 6, 8]);
  });

  it('keeps decimal steps free of float noise', () => {
    expect(fixedDomainTicks(79, 81)).toEqual([79, 79.5, 80, 80.5, 81]);
  });

  it('collapses an empty range to one tick', () => {
    expect(fixedDomainTicks(80, 80)).toEqual([80]);
  });
});

// Expected strings are d3-shape's own curveMonotoneX test outputs.
describe('monotoneXPath (d3 curveMonotoneX)', () => {
  it('draws d3’s paths for one, two, three and four points', () => {
    expect(monotoneXPath([[0, 1]])).toBe('M0,1Z');
    expect(monotoneXPath([[0, 1], [1, 3]])).toBe('M0,1L1,3');
    expect(monotoneXPath([[0, 1], [1, 3], [2, 1]])).toBe(
      'M0,1C0.333333,2,0.666667,3,1,3C1.333333,3,1.666667,2,2,1'
    );
    expect(monotoneXPath([[0, 1], [1, 3], [2, 1], [3, 3]])).toBe(
      'M0,1C0.333333,2,0.666667,3,1,3C1.333333,3,1.666667,1,2,1C2.333333,1,2.666667,2,3,3'
    );
  });

  it('preserves monotonicity in y like d3', () => {
    expect(monotoneXPath([[0, 200], [100, 100], [200, 100], [300, 300], [400, 300]])).toBe(
      'M0,200C33.333333,150,66.666667,100,100,100C133.333333,100,166.666667,100,200,100' +
        'C233.333333,100,266.666667,300,300,300C333.333333,300,366.666667,300,400,300'
    );
  });

  it('skips coincident points', () => {
    expect(monotoneXPath([[0, 1], [0, 1], [1, 3]])).toBe('M0,1L1,3');
  });
});
