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
    return { points, unit, min: 0, max: 0 };
  }
  const values = points.map((point) => point.value);
  return { points, unit, min: Math.min(...values) - 1, max: Math.max(...values) + 1 };
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

// Recharts' y ticks for a fixed numeric domain (tickCount 5): a "nice" step
// from (max − min) / (count − 1), ticks from min below max, then max itself.
// For [78, 83] that is 78, 80, 82, 83.
export function fixedDomainTicks(min, max, tickCount = 5) {
  if (min === max) {
    return [min];
  }
  const step = formatStep((max - min) / (Math.max(tickCount, 2) - 1));
  const ticks = [];
  for (let i = 0; i < 100; i += 1) {
    const value = roundTick(min + i * step);
    if (value >= max) {
      break;
    }
    ticks.push(value);
  }
  ticks.push(max);
  return ticks;
}

// Recharts' getFormatStep: round the rough step up to 0.1 (one-digit steps)
// or 0.05 (otherwise) of its power of ten.
function formatStep(roughStep) {
  if (roughStep <= 0) {
    return 0;
  }
  const digitCount = Math.floor(Math.log10(Math.abs(roughStep))) + 1;
  const digitValue = 10 ** digitCount;
  const scale = digitCount !== 1 ? 0.05 : 0.1;
  return roundTick(Math.ceil(roundTick(roughStep / digitValue / scale)) * scale * digitValue);
}

function roundTick(value) {
  return Math.round(value * 1e10) / 1e10;
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
