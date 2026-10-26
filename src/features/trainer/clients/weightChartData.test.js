import { buildWeightSeries, chartUnit, logsSince, monotoneXPath, thinLabels, tickLabel, weightAxis } from './weightChartData';

describe('buildWeightSeries (§C5.3)', () => {
  it('plots oldest first in one unit on whole-number ticks (T-38, retires ⚠C-9)', () => {
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
    // 176 … 176.37 → lo 175, hi 177.37 → step 1 → 175 … 178.
    expect(series.min).toBe(175);
    expect(series.max).toBe(178);
    expect(series.ticks).toEqual([175, 176, 177, 178]);
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

describe('weightAxis (§C5.3 whole-number ticks, T-38 QA fix)', () => {
  it('matches the four spec examples', () => {
    expect(weightAxis(77.11, 78).ticks).toEqual([76, 77, 78, 79]);
    expect(weightAxis(170, 171.96).ticks).toEqual([169, 170, 171, 172, 173]);
    expect(weightAxis(61.3, 140.7).ticks).toEqual([50, 75, 100, 125, 150]);
    expect(weightAxis(80, 80).ticks).toEqual([79, 80, 81]);
  });

  it('sets the domain to the first and last tick', () => {
    expect(weightAxis(61.3, 140.7)).toEqual({ min: 50, max: 150, ticks: [50, 75, 100, 125, 150] });
  });

  it('takes the first step that fits lo…hi in at most 4 intervals', () => {
    // 79, 83 → lo 78, hi 84: 6 / 2 = 3 → step 2.
    expect(weightAxis(79, 83).ticks).toEqual([78, 80, 82, 84]);
    // 80, 83 → lo 79, hi 84: 5 / 2 = 2.5 → step 2, floored/ceiled to 78 … 84.
    expect(weightAxis(80, 83).ticks).toEqual([78, 80, 82, 84]);
    // 79, 82 → lo 78, hi 83: 5 / 1 = 5 > 4 → step 2 → 78 … 84.
    expect(weightAxis(79, 82).ticks).toEqual([78, 80, 82, 84]);
  });

  it('falls back to the largest step past its range', () => {
    expect(weightAxis(1000, 4000).ticks.slice(0, 2)).toEqual([500, 1000]);
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

describe('tickLabel (T-38 QA)', () => {
  it('prints en-US with at most one decimal (a guard: ticks are whole)', () => {
    expect(tickLabel(76.1107029)).toBe('76.1');
    expect(tickLabel(79.5)).toBe('79.5');
    expect(tickLabel(80)).toBe('80');
    expect(tickLabel(169.96)).toBe('170');
    expect(tickLabel(1000)).toBe('1,000');
  });
});
