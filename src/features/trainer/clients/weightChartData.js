import { formatDateWithOffset } from '../../../shared/time/format';

// Data for the weight chart (trainer clients spec §C5.3), kept apart from the
// drawing so it can be tested.

// One point per log, oldest → newest; y is the raw number whatever its unit
// (⚠C-9). Unit for the tooltip: first log's, else the profile's, else "kg".
export function buildWeightSeries(logs, profile) {
  const points = logs.map((log) => ({
    value: Number(log.weight_value),
    label: formatDateWithOffset(log.recorded_on, 1),
  }));
  const unit = logs[0]?.weight_unit || profile?.current_weight_unit || 'kg';
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
