// Pure rules from RN-SPEC-plans §3.2, §4.2, §4.4, §4.6, §4.7 and §5, ported
// from the web code. Several reproduce web bugs on purpose (see the ⚠ notes);
// don't "fix" them.

export const WEEKDAY_OPTIONS = Object.freeze([
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
]);

// S1 derived data (§3.2).
export function derivePlansList(plans, currentPlan) {
  const activePlanId = currentPlan?.enrollment?.plan?.id;
  const hasActivePlan = Boolean(currentPlan?.enrollment?.plan);
  const activePlanDetail =
    plans.find((plan) => plan.id === activePlanId) || currentPlan?.enrollment?.plan || null;

  const seen = new Set();
  const activeWeekdays = (currentPlan?.schedule || [])
    .map((item) => item?.weekday)
    .filter((weekday) => {
      if (!weekday?.name || seen.has(weekday.id)) {
        return false;
      }
      seen.add(weekday.id);
      return true;
    })
    .sort((left, right) => Number(left.sort_order ?? left.id ?? 0) - Number(right.sort_order ?? right.id ?? 0));

  // No client-side filter for private trainer plans (⚠6).
  const browsable = plans.filter((plan) => plan.is_active && plan.id !== activePlanId);
  // A plain object, as on the web: integer-like category names therefore sort
  // ahead of the rest (JS key order); everything else keeps server order.
  const grouped = browsable.reduce((acc, plan) => {
    const key = plan.category?.name || 'Plans';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(plan);
    return acc;
  }, {});
  const groups = Object.entries(grouped);

  return {
    activePlanId,
    hasActivePlan,
    activePlanDetail,
    activeWeekdays,
    groups,
    browseCount: browsable.length,
    showCategoryHeaders: groups.length > 1,
    noPlansAtAll: plans.length === 0,
  };
}

// "1 sets" is web parity (⚠15); target_reps_max alone reads "Reps open".
export function formatSetSummary(item) {
  const summary = item?.target_set_summary;
  if (!summary?.set_count) {
    return 'Open prescription';
  }
  const reps =
    summary.target_reps_min && summary.target_reps_max
      ? `${summary.target_reps_min}-${summary.target_reps_max} reps`
      : summary.target_reps_min
        ? `${summary.target_reps_min} reps`
        : 'Reps open';
  return `${summary.set_count} sets × ${reps}`;
}

export function estimateMinutes(exercises) {
  if (!exercises?.length) {
    return null;
  }
  const sets = exercises.reduce((sum, exercise) => sum + (Number(exercise?.target_set_summary?.set_count) || 3), 0);
  return Math.max(10, Math.round((sets * 3.5) / 5) * 5);
}

export function muscleFocus(exercises) {
  const seen = new Set();
  const names = [];
  (exercises || []).forEach((exercise) => {
    const name = exercise?.exercise?.primary_muscle_group?.name;
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  });
  return names;
}

// N for S2: days_per_week first, not the saved day count (⚠1, ⚠12).
export function requiredScheduleDaysFor(plan, days) {
  return Number(plan?.days_per_week || days.length || 0) || days.length;
}

// S2 initial weekday selection (§4.2).
export function initialWeekdaysFor(currentPlan, plan, required) {
  const isViewingCurrentPlan = currentPlan?.enrollment?.plan?.id === plan?.id;
  const scheduled = isViewingCurrentPlan
    ? [
        ...new Set(
          (currentPlan?.schedule || [])
            .map((item) => item?.weekday?.id)
            .filter((weekdayId) => WEEKDAY_OPTIONS.some((option) => option.id === weekdayId))
        ),
      ].sort((left, right) => left - right)
    : [];
  return scheduled.length
    ? scheduled.slice(0, required)
    : WEEKDAY_OPTIONS.slice(0, required).map((weekday) => weekday.id);
}

// Tap rules shared by S2 and S3: remove if selected; ignore silently when
// full (⚠14); otherwise add and keep ascending.
export function toggleWeekday(current, weekdayId, required) {
  if (current.includes(weekdayId)) {
    return current.filter((value) => value !== weekdayId);
  }
  if (current.length >= required) {
    return current;
  }
  return [...current, weekdayId].sort((left, right) => left - right);
}

export function weekdaySummary(selected) {
  return selected
    .map((weekdayId) => WEEKDAY_OPTIONS.find((option) => option.id === weekdayId)?.label)
    .filter(Boolean)
    .join(', ');
}

export function plural(count, word) {
  return `${word}${count === 1 ? '' : 's'}`;
}
