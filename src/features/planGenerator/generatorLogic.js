// Step, validation, payload and display logic for the plan generator
// (RN-SPEC-PLAN-GENERATOR §G1–§G2). Pure, so it can be tested.

import { breakpoints } from '../../shared/theme/tokens';
import { formatLocalDateForInput } from '../../shared/time/format';
import { COPY, QUESTIONS, bandLabel, focusBlockedHint, goEasyBlockedHint, goalLabel, humanizeCode, presetLabel } from './generatorCopy';

// Option lists may carry plain codes or `{code}` objects.
export function optionCode(option) {
  return option !== null && typeof option === 'object' ? option.code : option;
}

const ids = (list) => (Array.isArray(list) ? list.map((item) => item?.id).filter((id) => id !== undefined && id !== null) : []);

// §G1.4: profile (null → all empty) → answers.
export function answersFromProfile(profile) {
  const p = profile ?? {};
  return {
    goal: p.goal ?? null,
    experience_band: p.experience_band ?? null,
    days_per_week: p.days_per_week ?? null,
    session_minutes: p.session_minutes ?? null,
    equipment_preset: p.equipment_preset ?? null,
    equipment_type_ids: ids(p.equipment),
    focus_muscle_ids: ids(p.focus_muscles),
    preferred_split: p.preferred_split ?? null,
    exclusions: Array.isArray(p.exclusions)
      ? p.exclusions.map((item) => ({ exercise: item.exercise, reason: item.reason }))
      : [],
    // T-18: always present on the wire, `[]` by default.
    go_easy_area_ids: Array.isArray(p.go_easy_area_ids) ? [...p.go_easy_area_ids] : [],
  };
}

// §G1.4 PUT body: every key, always. T-18: when go-easy areas are offered,
// `go_easy_area_ids` is always sent, filtered to the offered ids (so `[]`
// clears them and a stale id is dropped); with none offered the key is left
// out. The preview's split change passes no areas, so the saved ones stay.
export function buildProfileBody(answers, overrides = {}, goEasyAreas = []) {
  const a = { ...answers, ...overrides };
  const body = {
    goal: a.goal ?? null,
    experience_band: a.experience_band ?? null,
    days_per_week: a.days_per_week ?? null,
    session_minutes: a.session_minutes ?? null,
    equipment_preset: a.equipment_preset ?? null,
    equipment_type_ids: [...(a.equipment_type_ids ?? [])],
    focus_muscle_ids: [...(a.focus_muscle_ids ?? [])],
    preferred_split: a.preferred_split ?? null,
    exclusions: (a.exclusions ?? []).map((item) => ({ exercise_id: item.exercise?.id, reason: item.reason })),
  };
  const offered = ids(goEasyAreas);
  if (offered.length) {
    body.go_easy_area_ids = (a.go_easy_area_ids ?? []).filter((id) => offered.includes(id));
  }
  return body;
}

const has = (value) => value !== null && value !== undefined && value !== '';

// §G1.2: Next is disabled until steps 1–5 are answered; step 6 is optional.
export function isStepAnswered(answers, step) {
  switch (step) {
    case 1:
      return has(answers.goal);
    case 2:
      return has(answers.experience_band);
    case 3:
      return has(answers.days_per_week);
    case 4:
      return has(answers.session_minutes);
    case 5:
      return has(answers.equipment_preset);
    default:
      return true;
  }
}

// ⚠G-5: the label only; it does the same as Next. T-18: "Skip" only when
// focus, go-easy and avoid are all empty.
export function step6NextLabel(answers) {
  return answers.focus_muscle_ids.length === 0 &&
    (answers.go_easy_area_ids ?? []).length === 0 &&
    answers.exclusions.length === 0
    ? 'Skip'
    : 'Next';
}

// §G1.2 step 5 / ⚠G-2: a preset replaces the equipment with its own list.
export function choosePreset(answers, preset) {
  return {
    ...answers,
    equipment_preset: preset.code,
    equipment_type_ids: ids(preset.equipment),
  };
}

// New ids are appended; removing keeps the order. The preset code stays (⚠G-2).
export function toggleId(list, id) {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

// §G1.2 step 6: at the max, every unselected pill is disabled.
export function isFocusDisabled(selectedIds, id, max) {
  return !selectedIds.includes(id) && selectedIds.length >= Number(max ?? 0);
}

export function toggleFocus(selectedIds, id, max) {
  if (isFocusDisabled(selectedIds, id, max)) {
    return selectedIds;
  }
  return toggleId(selectedIds, id);
}

// ---- T-18 go-easy areas (step 6) ----

// `options.go_easy_areas[{id, code, name, focus_muscle_ids[]}]`, server order.
export function goEasyAreasOf(options) {
  return Array.isArray(options?.go_easy_areas) ? options.go_easy_areas : [];
}

// The pill label: `name`, else the code humanised.
export function goEasyAreaLabel(area) {
  return area?.name || humanizeCode(area?.code);
}

// `go_easy_notice`, or the fallback when it is "" (or missing).
export function goEasyNotice(options) {
  const notice = options?.go_easy_notice;
  return typeof notice === 'string' && notice !== '' ? notice : COPY.goEasyFallback;
}

const focusIdsOf = (area) => (Array.isArray(area?.focus_muscle_ids) ? area.focus_muscle_ids : []);

// Pair block (C5), ids only: a selected area blocks every unselected Focus
// pill whose id is in its `focus_muscle_ids`.
export function isFocusBlocked(answers, focusId, areas) {
  if (answers.focus_muscle_ids.includes(focusId)) {
    return false;
  }
  const selected = answers.go_easy_area_ids ?? [];
  return areas.some((area) => selected.includes(area.id) && focusIdsOf(area).includes(focusId));
}

// …and a selected Focus muscle blocks every unselected area whose list
// contains it.
export function isAreaBlocked(answers, area) {
  if ((answers.go_easy_area_ids ?? []).includes(area.id)) {
    return false;
  }
  return focusIdsOf(area).some((id) => answers.focus_muscle_ids.includes(id));
}

// A Focus pill is disabled by the cap (max 2, no hint) or by a block.
export function isFocusPillDisabled(answers, focusId, max, areas) {
  return isFocusDisabled(answers.focus_muscle_ids, focusId, max) || isFocusBlocked(answers, focusId, areas);
}

export function toggleGoEasyArea(answers, area) {
  if (isAreaBlocked(answers, area)) {
    return answers;
  }
  return { ...answers, go_easy_area_ids: toggleId(answers.go_easy_area_ids ?? [], area.id) };
}

// The hint under go-easy names the blocked areas (server order); "" = none.
export function goEasyHint(answers, areas) {
  return goEasyBlockedHint(areas.filter((area) => isAreaBlocked(answers, area)).map(goEasyAreaLabel));
}

// The hint under Focus names the selected areas (server order) that block
// an offered, unselected Focus pill. An area whose focus muscles aren't
// offered adds no hint.
export function focusHint(answers, areas, focusMuscles) {
  const offered = ids(focusMuscles);
  const selected = answers.go_easy_area_ids ?? [];
  const blocking = areas.filter(
    (area) =>
      selected.includes(area.id) &&
      focusIdsOf(area).some((id) => offered.includes(id) && !answers.focus_muscle_ids.includes(id))
  );
  return focusBlockedHint(blocking.map(goEasyAreaLabel));
}

export function addExclusion(exclusions, exercise) {
  if (exclusions.some((item) => item.exercise?.id === exercise.id)) {
    return exclusions;
  }
  return [...exclusions, { exercise: { id: exercise.id, name: exercise.name }, reason: 'DISLIKE' }];
}

export function setExclusionReason(exclusions, exerciseId, reason) {
  return exclusions.map((item) => (item.exercise?.id === exerciseId ? { ...item, reason } : item));
}

export function removeExclusion(exclusions, exerciseId) {
  return exclusions.filter((item) => item.exercise?.id !== exerciseId);
}

// Results not already avoided.
export function visibleSearchResults(results, exclusions) {
  const avoided = new Set(exclusions.map((item) => item.exercise?.id));
  return (results ?? []).filter((item) => !avoided.has(item.id));
}

// §G1.2: a non-empty trimmed term searches; otherwise nothing.
export function searchTerm(text) {
  return typeof text === 'string' ? text.trim() : '';
}

// §G1.5: 422 `errors` key → step; the first message per step wins.
export const ERROR_KEY_STEPS = Object.freeze({
  goal: 1,
  experience_band: 2,
  days_per_week: 3,
  session_minutes: 4,
  equipment_preset: 5,
  equipment_type_ids: 5,
  focus_muscle_ids: 6,
  exclusions: 6,
  preferred_split: 6,
  // T-18 (FIELD_STEP 5 on the web's 0-based steps).
  go_easy_area_ids: 6,
});

export function stepErrorsFrom422(errors) {
  const result = {};
  if (!errors || typeof errors !== 'object') {
    return result;
  }
  for (const [key, value] of Object.entries(errors)) {
    // Nested keys ("exclusions.0.reason") map by their root.
    const step = ERROR_KEY_STEPS[key] ?? ERROR_KEY_STEPS[key.split('.')[0]];
    const message = Array.isArray(value) ? value[0] : value;
    if (step && typeof message === 'string' && message && !(step in result)) {
      result[step] = message;
    }
  }
  return result;
}

const nameLookup = (list) => new Map((list ?? []).map((item) => [item.id, item.name]));

// §G1.3 review summaries, by step.
export function reviewSummaries(answers, options) {
  const equipmentNames = nameLookup(options?.equipment);
  const focusNames = nameLookup(options?.focus_muscles);
  const equipment = answers.equipment_type_ids.map((id) => equipmentNames.get(id)).filter(Boolean);
  const focus = answers.focus_muscle_ids.map((id) => focusNames.get(id)).filter(Boolean);
  const avoid = answers.exclusions.map((item) => item.exercise?.name).filter(Boolean);
  const focusPart = focus.length ? `Focus: ${focus.join(', ')}` : 'No focus';
  const avoidPart = avoid.length ? `Avoid: ${avoid.join(', ')}` : 'Nothing to avoid';
  // T-18: the go-easy part only when areas are offered; names in server order.
  const areas = goEasyAreasOf(options);
  const selected = answers.go_easy_area_ids ?? [];
  const goEasy = areas.filter((area) => selected.includes(area.id)).map(goEasyAreaLabel);
  const goEasyPart = goEasy.length ? `${COPY.goEasyReviewPrefix}${goEasy.join(', ')}` : COPY.nothingToGoEasyOn;
  return [
    goalLabel(answers.goal),
    bandLabel(answers.experience_band),
    `${answers.days_per_week} days a week`,
    `${answers.session_minutes} min`,
    `${presetLabel(answers.equipment_preset)} · ${['Bodyweight', ...equipment].join(', ')}`,
    (areas.length ? [focusPart, goEasyPart, avoidPart] : [focusPart, avoidPart]).join(' · '),
  ].map((summary, index) => ({ step: index + 1, question: QUESTIONS[index], summary }));
}

// ---- G2 preview ----

// m:ss
export function formatRest(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// §G2.2 item 5: "{sets} set(s) × {reps} reps[ each side] · rest {m:ss}".
export function formatPrescription(item) {
  const sets = item?.sets;
  const min = item?.reps_min;
  const max = item?.reps_max;
  const reps = has(min) && has(max) && Number(min) !== Number(max) ? `${min}–${max}` : `${has(min) ? min : max}`;
  let text = `${sets} ${Number(sets) === 1 ? 'set' : 'sets'} × ${reps} reps`;
  if (item?.unilateral) {
    text += ' each side';
  }
  if (item?.rest_seconds !== null && item?.rest_seconds !== undefined) {
    text += ` · rest ${formatRest(item.rest_seconds)}`;
  }
  return text;
}

// §G2.2 item 6: sets as sent; exactly 1 → "1 set".
export function formatWeeklySets(sets) {
  return Number(sets) === 1 ? '1 set' : `${sets} sets`;
}

// §G2.2 item 6: `weekly_volume[]{muscle{id,name}, sets}`, in server order.
export function weeklyVolumeRows(preview) {
  const list = Array.isArray(preview?.weekly_volume) ? preview.weekly_volume : [];
  return list.map((row, index) => ({
    key: row?.muscle?.id ?? `w-${index}`,
    name: row?.muscle?.name ?? '',
    sets: formatWeeklySets(row?.sets),
  }));
}

export function previewExercise(item) {
  return item?.exercise ?? item ?? {};
}

// §G2.2 item 4: the plan notice.
export function planNotice(preview, lockedAfter409) {
  const active = preview?.active_enrollment;
  if (lockedAfter409 || active?.trainer_locked) {
    return { kind: 'locked' };
  }
  if (active) {
    return { kind: 'active', planName: active.plan_name };
  }
  return null;
}

// §G2.4 accept body; `started_on` is the device's LOCAL date (owner decision,
// 23 Oct 2026: ⚠7/⚠T6 retired, web fixed the same way).
export function buildAcceptBody(previewHash, replace, now = new Date()) {
  return {
    preview_hash: previewHash,
    started_on: formatLocalDateForInput(now),
    replace_active_enrollment: Boolean(replace),
  };
}

function statusOf(error) {
  return error?.response?.status;
}

// §G2.4 accept error table.
export function classifyAcceptError(error) {
  const status = statusOf(error);
  if (status === 409) {
    const reasons = error?.response?.data?.errors?.reason;
    const reason = Array.isArray(reasons) ? reasons[0] : reasons;
    if (reason === 'PREVIEW_STALE') {
      return 'stale';
    }
    if (reason === 'ACTIVE_ENROLLMENT') {
      return 'active';
    }
    if (reason === 'TRAINER_LOCKED') {
      return 'locked';
    }
  }
  if (status === 503) {
    return 'unavailable';
  }
  if (status === 500) {
    return 'server';
  }
  return 'other';
}

// §G2.1 preview load errors.
export function classifyPreviewError(error) {
  const status = statusOf(error);
  if (status === 422 && error?.response?.data?.errors?.profile) {
    return 'profile';
  }
  // T-18 GO_EASY_FOCUS_CONFLICT: the saved areas clash with a focus muscle.
  if (status === 422 && error?.response?.data?.errors?.go_easy_area_ids) {
    return 'goEasy';
  }
  if (status === 503) {
    return 'unavailable';
  }
  if (status === 403) {
    return 'forbidden';
  }
  return 'other';
}

// T-18 G2.3: the refusal's actions change only for GO_EASY_TOO_RESTRICTIVE;
// "Change my equipment" only when `equipment_fix === true` (missing = false).
export function refusalActions(reason) {
  if (reason?.code !== 'GO_EASY_TOO_RESTRICTIVE') {
    return null;
  }
  return { equipmentFix: reason.equipment_fix === true };
}

// Deep link (T-18): an integer 0–5 opens that step (0-based, as the web's
// `state.step`); anything else → null (step 1 as before).
export function deepLinkStep(param) {
  return Number.isInteger(param) && param >= 0 && param < QUESTIONS.length ? param + 1 : null;
}

// §G2.4 ACTIVE_ENROLLMENT: after re-previewing, open the confirm only when
// it's feasible with an unlocked active plan.
export function shouldConfirmAfterActive(preview) {
  return Boolean(preview?.feasible && preview?.active_enrollment && !preview.active_enrollment.trainer_locked);
}

// The shell's BottomNav height without the safe-area inset: 1 border + 12
// top padding + 56 item + 16 bottom padding = 85, the web's BottomNav height
// (§G2.2 dated fix: `bottom: 85px` below md, 0 at ≥768). The shell doesn't
// export it, and the custom `tabBar` is an absolute overlay, so
// useBottomTabBarHeight() can't measure it reliably.
export const BOTTOM_NAV_HEIGHT = 85;

// Spec ruling: 85 below 768 wide, 0 at ≥768, plus the bottom safe-area inset.
export function tabBarClearance({ width, insetBottom }) {
  return (width < breakpoints.md ? BOTTOM_NAV_HEIGHT : 0) + (insetBottom ?? 0);
}
