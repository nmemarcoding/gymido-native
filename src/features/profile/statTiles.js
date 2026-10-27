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

// Each tile's unit is that value's own unit. A goal without a unit (no goal
// saved) falls back to the current unit, then kg, so the label still reads.
export function profileStatTiles({ profile, dashboard, status }) {
  const currentUnit = profile?.current_weight_unit || 'kg';
  const goalUnit = profile?.goal_weight_unit || currentUnit;
  let workouts = '—';
  if (status === StatsStatus.ready) {
    // Today's rule (H1.4): a missing total reads 0.
    workouts = formatNumber(dashboard?.quick_stats?.completed_workouts_total ?? 0, 0);
  }
  return [
    {
      id: 'workouts',
      label: 'Workouts',
      value: workouts,
      loading: status === StatsStatus.loading,
      unavailable: status === StatsStatus.error,
    },
    { id: 'now', label: `${currentUnit} now`, value: weightTileValue(profile?.current_weight_value), loading: false },
    {
      id: 'goal',
      label: `${goalUnit} goal`,
      value: hasValue(profile?.goal_weight_value) ? weightTileValue(profile.goal_weight_value) : '—',
      loading: false,
    },
  ];
}

// The tile's one spoken name: "37 Workouts", "82.5 kg now"; a "—" is never
// read out ("kg goal, not set", "Workouts, unavailable").
export function statTileLabel(tile) {
  if (tile.loading) {
    return `${tile.label}, loading`;
  }
  if (tile.unavailable) {
    return `${tile.label}, unavailable`;
  }
  return tile.value === '—' ? `${tile.label}, not set` : `${tile.value} ${tile.label}`;
}
