import { formatNumber } from '../../shared/format/numbers';

// RN-SPEC-v2-phase5 §1 K N1 + §2 (PM approved 26 Oct 2026): the Profile
// header tiles. Workouts = GET /dashboard quick_stats.completed_workouts_total
// (Today's "Done total"); now / goal = the profile's own value and unit for
// each (no conversion). Pure.

export const StatsStatus = Object.freeze({ loading: 'loading', ready: 'ready', error: 'error' });

function hasValue(value) {
  return value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(value));
}

// "—" for a missing value; otherwise at most one decimal, no trailing zeros
// (82.5 → "82.5", 78 → "78").
export function weightTileValue(value) {
  return hasValue(value) ? formatNumber(value, 1) : '—';
}

// RN-SPEC-profile §P1.2 (web rules, PM 27 Oct; review M4): each label is
// "{unit} now" / "{unit} goal" with that value's RAW unit, and just "Now" /
// "Goal" when the unit is missing (no fallback to another unit or kg). The
// unit is only ever in the label, never next to the number.
function weightTileLabel(unit, word) {
  return unit ? `${unit} ${word.toLowerCase()}` : word;
}

export function profileStatTiles({ profile, dashboard, status }) {
  let workouts = '—';
  const total = dashboard?.quick_stats?.completed_workouts_total;
  // Review M3 (web parity, "never a made-up 0"): a missing total is "—"; a
  // real 0 is "0".
  if (status === StatsStatus.ready && hasValue(total)) {
    workouts = formatNumber(total, 0);
  }
  return [
    {
      id: 'workouts',
      label: 'Workouts',
      value: workouts,
      loading: status === StatsStatus.loading,
      unavailable: status === StatsStatus.error,
    },
    { id: 'now', label: weightTileLabel(profile?.current_weight_unit, 'Now'), value: weightTileValue(profile?.current_weight_value), loading: false },
    {
      id: 'goal',
      label: weightTileLabel(profile?.goal_weight_unit, 'Goal'),
      value: hasValue(profile?.goal_weight_value) ? weightTileValue(profile.goal_weight_value) : '—',
      loading: false,
    },
  ];
}

// The tile's one spoken name: "37 Workouts", "82.5 kg now"; a "—" is never
// read out ("kg goal, not set", "Goal, not set", "Workouts, unavailable").
export function statTileLabel(tile) {
  if (tile.loading) {
    return `${tile.label}, loading`;
  }
  if (tile.unavailable) {
    return `${tile.label}, unavailable`;
  }
  return tile.value === '—' ? `${tile.label}, not set` : `${tile.value} ${tile.label}`;
}
