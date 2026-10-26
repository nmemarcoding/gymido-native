import { formatNumber } from '../../../shared/format/numbers';
import { convertWeight } from '../../../shared/format/weight';
import { formatDateWithOffset } from '../../../shared/time/format';

// Data for the weight chart (trainer clients spec §C5.3), kept apart from the
// drawing so it can be tested.

// One point per log, oldest → newest; y is in the chart's one unit (T-38).
// T-38 (25 Oct 2026, retires ⚠C-9): one unit for the whole chart, each point
// converted into it. Logs come oldest first, so the newest is the last.
export function chartUnit(logs, profile) {
  const hasCurrent = profile?.current_weight_value != null && Boolean(profile?.current_weight_unit);
  if (hasCurrent) {
    return profile.current_weight_unit;
  }
  return logs[logs.length - 1]?.weight_unit || profile?.current_weight_unit || 'kg';
}

// `unitOverride`: Progress passes its currentUnit (RN-SPEC-progress PR1.2).
export function buildWeightSeries(logs, profile, unitOverride) {
  const unit = unitOverride || chartUnit(logs, profile);
  const points = logs.map((log) => ({
    value: convertWeight(log.weight_value, log.weight_unit, unit),
    label: formatDateWithOffset(log.recorded_on, 1),
  }));
  if (points.length === 0) {
    return { points, unit, min: 0, max: 0, ticks: [] };
  }
  const values = points.map((point) => point.value);
  return { points, unit, ...weightAxis(Math.min(...values), Math.max(...values)) };
}

// Resolved mechanism (owner-accepted): the web hides x labels closer than
// 18 px and always keeps the first and last. Labels here are 12 px text, so
// each is estimated at ~6.6 px per character.
export function thinLabels(labels, spacing, charWidth = 6.6, gap = 18) {
  if (labels.length <= 2) {
    return labels;
  }
  const width = (label) => label.length * charWidth;
  const shown = labels.map(() => '');
  shown[0] = labels[0];
  const lastIndex = labels.length - 1;
  shown[lastIndex] = labels[lastIndex];
  let lastShownEnd = width(labels[0]) / 2;
  const lastStart = lastIndex * spacing - width(labels[lastIndex]) / 2;
  for (let i = 1; i < lastIndex; i += 1) {
    const center = i * spacing;
    const start = center - width(labels[i]) / 2;
    const end = center + width(labels[i]) / 2;
    if (start - lastShownEnd >= gap && lastStart - end >= gap) {
      shown[i] = labels[i];
      lastShownEnd = end;
    }
  }
  return shown;
}

// §C5.2 summary helpers.
export function logsSince(logs, days, now = Date.now()) {
  const cutoff = now - days * 86400000;
  return logs.filter((log) => new Date(log.recorded_on).getTime() >= cutoff);
}

// §C5.3 y axis (T-38 QA fix, 25 Oct 2026): whole-number ticks on a nice
// step, with at least 1 unit of room. lo/hi are min − 1 and max + 1; the
// step is the first that fits lo…hi in at most 4 intervals; the domain is
// lo/hi floored/ceiled to the step, with a tick on every step.
// 77.11 + 78 → 76 · 77 · 78 · 79; 61.3 + 140.7 → 50 · 75 · 100 · 125 · 150.
const AXIS_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];

export function weightAxis(minValue, maxValue) {
  const lo = minValue - 1;
  const hi = maxValue + 1;
  const step = AXIS_STEPS.find((candidate) => (hi - lo) / candidate <= 4) ?? AXIS_STEPS[AXIS_STEPS.length - 1];
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let value = min; value <= max; value += step) {
    ticks.push(value);
  }
  return { min, max, ticks };
}

// A y tick's label: en-US, at most one decimal. A guard only: ticks are
// whole numbers now (the raw-float labels "76.1107029" were the bug).
export function tickLabel(value) {
  return formatNumber(value, 1);
}

// d3's curveMonotoneX (Steffen's method) as an SVG path through [x, y]
// points: never overshoots, and flat runs stay flat.
export function monotoneXPath(points) {
  const cleaned = points.filter(
    ([x, y], index) => index === 0 || x !== points[index - 1][0] || y !== points[index - 1][1]
  );
  if (cleaned.length === 0) {
    return '';
  }
  const [first] = cleaned;
  if (cleaned.length === 1) {
    return `M${fmt(first[0])},${fmt(first[1])}Z`;
  }
  let path = `M${fmt(first[0])},${fmt(first[1])}`;
  if (cleaned.length === 2) {
    return `${path}L${fmt(cleaned[1][0])},${fmt(cleaned[1][1])}`;
  }
  const tangents = cleaned.map((point, i) => {
    if (i === 0 || i === cleaned.length - 1) {
      return null;
    }
    return interiorSlope(cleaned[i - 1], point, cleaned[i + 1]);
  });
  tangents[0] = endSlope(cleaned[0], cleaned[1], tangents[1]);
  const last = cleaned.length - 1;
  tangents[last] = endSlope(cleaned[last - 1], cleaned[last], tangents[last - 1]);
  for (let i = 1; i < cleaned.length; i += 1) {
    const [x0, y0] = cleaned[i - 1];
    const [x1, y1] = cleaned[i];
    const dx = (x1 - x0) / 3;
    path += `C${fmt(x0 + dx)},${fmt(y0 + dx * tangents[i - 1])},${fmt(x1 - dx)},${fmt(y1 - dx * tangents[i])},${fmt(x1)},${fmt(y1)}`;
  }
  return path;
}

function sign(value) {
  return value < 0 ? -1 : 1;
}

// d3 slope3: the tangent at `mid` from both neighbouring secants.
function interiorSlope([x0, y0], [x1, y1], [x2, y2]) {
  const h0 = x1 - x0;
  const h1 = x2 - x1;
  const s0 = (y1 - y0) / (h0 || (h1 < 0 && -0));
  const s1 = (y2 - y1) / (h1 || (h0 < 0 && -0));
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

// d3 slope2: an end tangent from the secant and the neighbouring tangent.
function endSlope([x0, y0], [x1, y1], neighbour) {
  const h = x1 - x0;
  return h ? (3 * (y1 - y0) / h - neighbour) / 2 : neighbour;
}

function fmt(value) {
  return String(Math.round(value * 1e6) / 1e6);
}
