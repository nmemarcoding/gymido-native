import {
  COPY,
  QUESTIONS,
  bandLabel,
  focusBlockedHint,
  goEasyBlockedHint,
  goalLabel,
  humanizeCode,
  joinNames,
  presetLabel,
  reasonLabel,
  stepEyebrow,
} from './generatorCopy';
import {
  addExclusion,
  answersFromProfile,
  buildAcceptBody,
  buildProfileBody,
  choosePreset,
  classifyAcceptError,
  classifyPreviewError,
  deepLinkStep,
  focusHint,
  formatPrescription,
  formatRest,
  formatWeeklySets,
  goEasyAreaLabel,
  goEasyAreasOf,
  goEasyHint,
  goEasyNotice,
  isAreaBlocked,
  isFocusBlocked,
  isFocusDisabled,
  isFocusPillDisabled,
  isStepAnswered,
  optionCode,
  planNotice,
  refusalActions,
  removeExclusion,
  reviewSummaries,
  searchTerm,
  setExclusionReason,
  shouldConfirmAfterActive,
  step6NextLabel,
  stepErrorsFrom422,
  toggleFocus,
  toggleGoEasyArea,
  tabBarClearance,
  weeklyVolumeRows,
  toggleId,
  visibleSearchResults,
} from './generatorLogic';

const PROFILE = {
  goal: 'BUILD_MUSCLE',
  experience_band: '2_PLUS_YEARS',
  days_per_week: 4,
  session_minutes: 60,
  equipment_preset: 'FULL_GYM',
  equipment: [
    { id: 3, name: 'Barbell' },
    { id: 7, name: 'Cable' },
  ],
  focus_muscles: [{ id: 11, name: 'Chest' }],
  preferred_split: 'UL4',
  exclusions: [{ exercise: { id: 90, name: 'Dips' }, reason: 'DISCOMFORT' }],
};

const OPTIONS = {
  equipment: [
    { id: 7, name: 'Cable' },
    { id: 3, name: 'Barbell' },
    { id: 5, name: 'Dumbbell' },
  ],
  focus_muscles: [
    { id: 11, name: 'Chest' },
    { id: 12, name: 'Back' },
  ],
};

const httpError = (status, data = {}) => ({ isAxiosError: true, response: { status, data } });

describe('copy', () => {
  test('known codes use the owner copy; unknown codes are humanised', () => {
    expect(goalLabel('GENERAL_FITNESS')).toBe('General fitness');
    expect(bandLabel('6_MONTHS_TO_2_YEARS')).toBe('6 months–2 years');
    expect(bandLabel('RETURNING_3_PLUS_MONTHS_OFF')).toBe('Coming back after 3+ months off');
    expect(presetLabel('BODYWEIGHT_PULLUP_BAR')).toBe('Bodyweight + pull-up bar');
    expect(reasonLabel('DISLIKE')).toBe("Don't like it");
    expect(goalLabel('SOMETHING_NEW')).toBe('Something new');
    expect(humanizeCode('')).toBe('');
  });

  test('step header and questions', () => {
    expect(stepEyebrow(3)).toBe('Step 3 of 6');
    expect(QUESTIONS).toHaveLength(6);
    expect(QUESTIONS[0]).toBe("What's your main goal?");
    expect(COPY.disclaimer).toBe(
      "Gymido can't account for injuries or medical conditions. If you have one, follow your clinician's advice, or work with a trainer."
    );
    expect(COPY.headerButton).toBe('Build me a plan');
  });
});

describe('answers ↔ profile (G1.4)', () => {
  test('null profile → all empty', () => {
    expect(answersFromProfile(null)).toEqual({
      goal: null,
      experience_band: null,
      days_per_week: null,
      session_minutes: null,
      equipment_preset: null,
      equipment_type_ids: [],
      focus_muscle_ids: [],
      preferred_split: null,
      exclusions: [],
      go_easy_area_ids: [],
    });
  });

  test('PUT body carries every key, preferred_split unchanged, exclusions as ids', () => {
    const body = buildProfileBody(answersFromProfile(PROFILE));
    expect(body).toEqual({
      goal: 'BUILD_MUSCLE',
      experience_band: '2_PLUS_YEARS',
      days_per_week: 4,
      session_minutes: 60,
      equipment_preset: 'FULL_GYM',
      equipment_type_ids: [3, 7],
      focus_muscle_ids: [11],
      preferred_split: 'UL4',
      exclusions: [{ exercise_id: 90, reason: 'DISCOMFORT' }],
    });
    expect(Object.keys(buildProfileBody(answersFromProfile(null)))).toHaveLength(9);
  });

  test('split change overrides preferred_split only', () => {
    const body = buildProfileBody(answersFromProfile(PROFILE), { preferred_split: 'PPL6' });
    expect(body.preferred_split).toBe('PPL6');
    expect(body.goal).toBe('BUILD_MUSCLE');
  });
});

describe('steps', () => {
  test('Next is disabled until steps 1–5 are answered; step 6 always enabled', () => {
    const empty = answersFromProfile(null);
    for (const step of [1, 2, 3, 4, 5]) {
      expect(isStepAnswered(empty, step)).toBe(false);
    }
    expect(isStepAnswered(empty, 6)).toBe(true);
    const full = answersFromProfile(PROFILE);
    for (const step of [1, 2, 3, 4, 5, 6]) {
      expect(isStepAnswered(full, step)).toBe(true);
    }
  });

  test('⚠G-5 step 6 reads Skip only while nothing is chosen', () => {
    const empty = answersFromProfile(null);
    expect(step6NextLabel(empty)).toBe('Skip');
    expect(step6NextLabel({ ...empty, focus_muscle_ids: [1] })).toBe('Next');
    expect(step6NextLabel({ ...empty, exclusions: [{ exercise: { id: 1 }, reason: 'DISLIKE' }] })).toBe('Next');
  });

  test('option codes from strings or objects', () => {
    expect(optionCode('X')).toBe('X');
    expect(optionCode({ code: 'Y' })).toBe('Y');
  });
});

describe('equipment (step 5, ⚠G-2)', () => {
  test('a preset replaces the ids; edits keep the preset; choosing again resets', () => {
    const preset = { code: 'HOME_DUMBBELL', enabled: true, equipment: [{ id: 5 }, { id: 9 }] };
    let a = choosePreset(answersFromProfile(PROFILE), preset);
    expect(a.equipment_preset).toBe('HOME_DUMBBELL');
    expect(a.equipment_type_ids).toEqual([5, 9]);
    a = { ...a, equipment_type_ids: toggleId(toggleId(a.equipment_type_ids, 3), 5) };
    expect(a.equipment_type_ids).toEqual([9, 3]);
    expect(a.equipment_preset).toBe('HOME_DUMBBELL');
    expect(choosePreset(a, preset).equipment_type_ids).toEqual([5, 9]);
  });
});

describe('focus and avoid (step 6)', () => {
  test('focus max disables unselected pills only', () => {
    expect(isFocusDisabled([1, 2], 3, 2)).toBe(true);
    expect(isFocusDisabled([1, 2], 1, 2)).toBe(false);
    expect(toggleFocus([1, 2], 3, 2)).toEqual([1, 2]);
    expect(toggleFocus([1, 2], 1, 2)).toEqual([2]);
    expect(toggleFocus([1], 3, 2)).toEqual([1, 3]);
  });

  test('avoid add (DISLIKE), reason change, remove, result filtering', () => {
    let list = addExclusion([], { id: 4, name: 'Squat', extra: true });
    expect(list).toEqual([{ exercise: { id: 4, name: 'Squat' }, reason: 'DISLIKE' }]);
    expect(addExclusion(list, { id: 4, name: 'Squat' })).toBe(list);
    list = setExclusionReason(list, 4, 'DISCOMFORT');
    expect(list[0].reason).toBe('DISCOMFORT');
    expect(visibleSearchResults([{ id: 4 }, { id: 5 }], list)).toEqual([{ id: 5 }]);
    expect(removeExclusion(list, 4)).toEqual([]);
    expect(searchTerm('  row ')).toBe('row');
    expect(searchTerm('   ')).toBe('');
  });
});

describe('save errors (G1.5)', () => {
  test('422 keys map to steps; the first message per step wins', () => {
    expect(
      stepErrorsFrom422({
        goal: ['Pick a goal.'],
        equipment_preset: ['Bad preset.'],
        equipment_type_ids: ['Bad ids.'],
        'exclusions.0.reason': ['Bad reason.'],
        preferred_split: ['Bad split.'],
        unknown: ['Ignored.'],
      })
    ).toEqual({ 1: 'Pick a goal.', 5: 'Bad preset.', 6: 'Bad reason.' });
    expect(stepErrorsFrom422(undefined)).toEqual({});
  });
});

describe('review summaries (G1.3)', () => {
  test('every row', () => {
    const rows = reviewSummaries(answersFromProfile(PROFILE), OPTIONS);
    expect(rows.map((r) => r.summary)).toEqual([
      'Build muscle',
      '2+ years',
      '4 days a week',
      '60 min',
      'Full gym · Bodyweight, Barbell, Cable',
      'Focus: Chest · Avoid: Dips',
    ]);
    expect(rows[2].question).toBe('How many days a week can you train?');
  });

  test('empty focus / avoid / equipment', () => {
    const a = { ...answersFromProfile(PROFILE), equipment_type_ids: [], focus_muscle_ids: [], exclusions: [] };
    const rows = reviewSummaries(a, OPTIONS);
    expect(rows[4].summary).toBe('Full gym · Bodyweight');
    expect(rows[5].summary).toBe('No focus · Nothing to avoid');
  });
});

describe('preview display (G2.2)', () => {
  test('prescription', () => {
    expect(formatPrescription({ sets: 3, reps_min: 8, reps_max: 12, rest_seconds: 90 })).toBe('3 sets × 8–12 reps · rest 1:30');
    expect(formatPrescription({ sets: 1, reps_min: 10, reps_max: 10, unilateral: true, rest_seconds: null })).toBe(
      '1 set × 10 reps each side'
    );
    expect(formatPrescription({ sets: 4, reps_min: 5, reps_max: 5, rest_seconds: 45 })).toBe('4 sets × 5 reps · rest 0:45');
    expect(formatRest(185)).toBe('3:05');
  });

  test('weekly sets as sent; exactly 1 → "1 set"', () => {
    expect(formatWeeklySets(9.5)).toBe('9.5 sets');
    expect(formatWeeklySets(1)).toBe('1 set');
    expect(formatWeeklySets(12)).toBe('12 sets');
  });

  test('weekly volume reads muscle{id,name} in server order', () => {
    expect(
      weeklyVolumeRows({
        weekly_volume: [
          { muscle: { id: 7, name: 'Quads' }, sets: 12 },
          { muscle: { id: 2, name: 'Chest' }, sets: 1 },
        ],
      })
    ).toEqual([
      { key: 7, name: 'Quads', sets: '12 sets' },
      { key: 2, name: 'Chest', sets: '1 set' },
    ]);
    expect(weeklyVolumeRows({ weekly_volume: [{ muscle_group: { name: 'Old' }, sets: 3 }] })[0].name).toBe('');
    expect(weeklyVolumeRows({})).toEqual([]);
  });

  test('plan notice', () => {
    expect(planNotice({ active_enrollment: null }, false)).toBeNull();
    expect(planNotice({ active_enrollment: { plan_name: 'PPL', trainer_locked: false } }, false)).toEqual({
      kind: 'active',
      planName: 'PPL',
    });
    expect(planNotice({ active_enrollment: { plan_name: 'PPL', trainer_locked: true } }, false)).toEqual({ kind: 'locked' });
    expect(planNotice({ active_enrollment: null }, true)).toEqual({ kind: 'locked' });
  });
});

describe('accept (G2.4)', () => {
  test('body uses the local date of the device clock (owner decision, 23 Oct 2026)', () => {
    // 23:30 local on 22 Oct is still the 22nd, whatever the zone.
    const now = new Date(2026, 9, 22, 23, 30);
    expect(buildAcceptBody('abc', true, now)).toEqual({
      preview_hash: 'abc',
      started_on: '2026-10-22',
      replace_active_enrollment: true,
    });
    expect(buildAcceptBody('abc', false, now).replace_active_enrollment).toBe(false);
  });

  test('error table', () => {
    expect(classifyAcceptError(httpError(409, { errors: { reason: ['PREVIEW_STALE'] } }))).toBe('stale');
    expect(classifyAcceptError(httpError(409, { errors: { reason: ['ACTIVE_ENROLLMENT'] } }))).toBe('active');
    expect(classifyAcceptError(httpError(409, { errors: { reason: ['TRAINER_LOCKED'] } }))).toBe('locked');
    expect(classifyAcceptError(httpError(503))).toBe('unavailable');
    expect(classifyAcceptError(httpError(500))).toBe('server');
    expect(classifyAcceptError(httpError(409, { errors: { reason: ['OTHER'] } }))).toBe('other');
    expect(classifyAcceptError(new Error('Network Error'))).toBe('other');
  });

  test('confirm after ACTIVE_ENROLLMENT only when feasible with an unlocked active plan', () => {
    expect(shouldConfirmAfterActive({ feasible: true, active_enrollment: { trainer_locked: false } })).toBe(true);
    expect(shouldConfirmAfterActive({ feasible: true, active_enrollment: { trainer_locked: true } })).toBe(false);
    expect(shouldConfirmAfterActive({ feasible: true, active_enrollment: null })).toBe(false);
    expect(shouldConfirmAfterActive(null)).toBe(false);
  });

  test('preview error table (G2.1)', () => {
    expect(classifyPreviewError(httpError(422, { errors: { profile: ['Missing'] } }))).toBe('profile');
    expect(classifyPreviewError(httpError(422, { errors: { other: ['x'] } }))).toBe('other');
    expect(classifyPreviewError(httpError(503))).toBe('unavailable');
    expect(classifyPreviewError(httpError(403))).toBe('forbidden');
    expect(classifyPreviewError(httpError(500))).toBe('other');
  });
});

describe('sticky bar clearance', () => {
  test('phone with the tab bar: 85 + inset; tablet or session: inset only', () => {
    expect(tabBarClearance({ width: 390, insetBottom: 34 })).toBe(119);
    expect(tabBarClearance({ width: 767, insetBottom: 0 })).toBe(85);
    expect(tabBarClearance({ width: 768, insetBottom: 0 })).toBe(0);
    expect(tabBarClearance({ width: 820, insetBottom: 20 })).toBe(20);
  });
});

// T-18 go-easy areas (RN-SPEC-PLAN-GENERATOR, dated change 25 Oct 2026).
const AREAS = [
  { id: 1, code: 'KNEES', name: 'Knees', focus_muscle_ids: [21, 22] },
  { id: 2, code: 'LOWER_BACK', name: 'Lower back', focus_muscle_ids: [23] },
  { id: 3, code: 'SHOULDERS', name: 'Shoulders', focus_muscle_ids: [24] },
  { id: 4, code: 'WRISTS', name: '', focus_muscle_ids: [99] },
];
const GE_FOCUS = [
  { id: 21, name: 'Quads' },
  { id: 22, name: 'Glutes' },
  { id: 23, name: 'Lower back' },
  { id: 24, name: 'Shoulders' },
];
const blank = (patch = {}) => ({ ...answersFromProfile(null), ...patch });

describe('T-18 go-easy: wire and PUT (G1.4)', () => {
  test('G1.4 answers: go_easy_area_ids ← profile.go_easy_area_ids || []', () => {
    expect(answersFromProfile({ ...PROFILE, go_easy_area_ids: [2, 1] }).go_easy_area_ids).toEqual([2, 1]);
    expect(answersFromProfile(PROFILE).go_easy_area_ids).toEqual([]);
    expect(answersFromProfile({ go_easy_area_ids: null }).go_easy_area_ids).toEqual([]);
  });

  test('PUT always sends go_easy_area_ids filtered to the offered ids when areas are offered', () => {
    const answers = answersFromProfile({ ...PROFILE, go_easy_area_ids: [3, 77, 1] });
    expect(buildProfileBody(answers, {}, AREAS).go_easy_area_ids).toEqual([3, 1]);
    // [] clears them: the key is still sent.
    const cleared = buildProfileBody({ ...answers, go_easy_area_ids: [] }, {}, AREAS);
    expect(cleared).toHaveProperty('go_easy_area_ids', []);
    // only stale ids → [].
    expect(buildProfileBody({ ...answers, go_easy_area_ids: [77] }, {}, AREAS).go_easy_area_ids).toEqual([]);
  });

  test('PUT omits the key when no areas are offered', () => {
    const answers = answersFromProfile({ ...PROFILE, go_easy_area_ids: [1] });
    expect(buildProfileBody(answers, {}, [])).not.toHaveProperty('go_easy_area_ids');
    expect(buildProfileBody(answers)).not.toHaveProperty('go_easy_area_ids');
  });

  test("the preview's split change (G2.2) re-saves without the key", () => {
    const saved = answersFromProfile({ ...PROFILE, go_easy_area_ids: [1] });
    const body = buildProfileBody(saved, { preferred_split: 'PPL6' });
    expect(body).not.toHaveProperty('go_easy_area_ids');
    expect(body.preferred_split).toBe('PPL6');
  });

  test('go_easy_areas read in server order; [] when missing', () => {
    expect(goEasyAreasOf({ go_easy_areas: AREAS })).toBe(AREAS);
    expect(goEasyAreasOf({})).toEqual([]);
    expect(goEasyAreasOf(null)).toEqual([]);
  });
});

describe('T-18 go-easy: step 6 section (G1.2)', () => {
  test('notice = go_easy_notice, or the fallback when ""', () => {
    expect(goEasyNotice({ go_easy_notice: 'Server notice.' })).toBe('Server notice.');
    expect(goEasyNotice({ go_easy_notice: '' })).toBe("We'll avoid exercises that put heavy load on the areas you pick.");
    expect(goEasyNotice({})).toBe("We'll avoid exercises that put heavy load on the areas you pick.");
  });

  test('pill label = name, else humanizeCode(code)', () => {
    expect(goEasyAreaLabel(AREAS[0])).toBe('Knees');
    expect(goEasyAreaLabel(AREAS[3])).toBe('Wrists');
  });

  test('tap toggles; none selected by default; no maximum', () => {
    let a = blank();
    expect(a.go_easy_area_ids).toEqual([]);
    for (const area of AREAS) {
      a = toggleGoEasyArea(a, area);
    }
    expect(a.go_easy_area_ids).toEqual([1, 2, 3, 4]);
    a = toggleGoEasyArea(a, AREAS[1]);
    expect(a.go_easy_area_ids).toEqual([1, 3, 4]);
  });

  test('pair block: a selected area disables every unselected Focus pill in its focus_muscle_ids', () => {
    const a = blank({ go_easy_area_ids: [1] });
    expect(isFocusBlocked(a, 21, AREAS)).toBe(true);
    expect(isFocusBlocked(a, 22, AREAS)).toBe(true);
    expect(isFocusBlocked(a, 23, AREAS)).toBe(false);
    expect(isFocusPillDisabled(a, 21, 2, AREAS)).toBe(true);
    expect(isFocusPillDisabled(a, 23, 2, AREAS)).toBe(false);
    // A selected Focus pill is never blocked (only unselected ones).
    expect(isFocusBlocked({ ...a, focus_muscle_ids: [21] }, 21, AREAS)).toBe(false);
    // Unpicking re-enables.
    expect(isFocusBlocked(toggleGoEasyArea(a, AREAS[0]), 21, AREAS)).toBe(false);
  });

  test('pair block: a selected Focus muscle disables every unselected area whose list contains it', () => {
    const a = blank({ focus_muscle_ids: [22] });
    expect(isAreaBlocked(a, AREAS[0])).toBe(true);
    expect(isAreaBlocked(a, AREAS[1])).toBe(false);
    // A blocked area can't be toggled on.
    expect(toggleGoEasyArea(a, AREAS[0])).toBe(a);
    // A selected area is never blocked.
    expect(isAreaBlocked({ ...a, go_easy_area_ids: [1] }, AREAS[0])).toBe(false);
    // Unpicking re-enables.
    expect(isAreaBlocked(blank(), AREAS[0])).toBe(false);
  });

  test('a Focus pill can also be disabled by the cap (max 2), which shows no hint', () => {
    const a = blank({ focus_muscle_ids: [23, 24] });
    expect(isFocusPillDisabled(a, 21, 2, AREAS)).toBe(true);
    expect(focusHint(a, AREAS, GE_FOCUS)).toBe('');
    expect(goEasyHint(blank({ focus_muscle_ids: [] }), AREAS)).toBe('');
  });

  test('go-easy hint names the blocked areas: one', () => {
    expect(goEasyHint(blank({ focus_muscle_ids: [21] }), AREAS)).toBe(
      'Knees is one of your focus muscles. Remove it there to go easy on it.'
    );
  });

  test('go-easy hint names the blocked areas: several (server order, lower case after the first word)', () => {
    expect(goEasyHint(blank({ focus_muscle_ids: [23, 21] }), AREAS)).toBe(
      'Knees and lower back are your focus muscles. Remove them there to go easy on them.'
    );
  });

  test('focus hint names the selected areas that block an offered, unselected Focus pill: one', () => {
    expect(focusHint(blank({ go_easy_area_ids: [2] }), AREAS, GE_FOCUS)).toBe(
      "You're going easy on your lower back, so it can't be a focus."
    );
  });

  test('focus hint: several', () => {
    expect(focusHint(blank({ go_easy_area_ids: [3, 1] }), AREAS, GE_FOCUS)).toBe(
      "You're going easy on your knees and shoulders, so they can't be a focus."
    );
  });

  test("focus hint: an area whose focus muscles aren't offered adds no hint", () => {
    expect(focusHint(blank({ go_easy_area_ids: [4] }), AREAS, GE_FOCUS)).toBe('');
    expect(focusHint(blank({ go_easy_area_ids: [4, 2] }), AREAS, GE_FOCUS)).toBe(
      "You're going easy on your lower back, so it can't be a focus."
    );
  });

  test('names joined "a", "a and b", "a, b and c" (no Oxford comma)', () => {
    expect(joinNames(['a'])).toBe('a');
    expect(joinNames(['a', 'b'])).toBe('a and b');
    expect(joinNames(['a', 'b', 'c'])).toBe('a, b and c');
    expect(goEasyBlockedHint(['Knees', 'Lower back', 'Shoulders'])).toBe(
      'Knees, lower back and shoulders are your focus muscles. Remove them there to go easy on them.'
    );
    expect(focusBlockedHint(['Knees', 'Lower back', 'Shoulders'])).toBe(
      "You're going easy on your knees, lower back and shoulders, so they can't be a focus."
    );
    expect(goEasyBlockedHint([])).toBe('');
    expect(focusBlockedHint([])).toBe('');
  });

  test('Skip only when focus, go-easy and avoid are all empty', () => {
    expect(step6NextLabel(blank())).toBe('Skip');
    expect(step6NextLabel(blank({ go_easy_area_ids: [1] }))).toBe('Next');
  });

  test('copy index additions', () => {
    expect(COPY.goEasyLabel).toBe('Anything to go easy on?');
    expect(COPY.goEasyFallback).toBe("We'll avoid exercises that put heavy load on the areas you pick.");
    expect(COPY.goEasyReviewPrefix).toBe('Go easy on: ');
    expect(COPY.nothingToGoEasyOn).toBe('Nothing to go easy on');
    expect(COPY.editGoEasyAreas).toBe('Edit go-easy areas');
    expect(COPY.changeMyEquipment).toBe('Change my equipment');
  });
});

describe('T-18 go-easy: review, 422, deep link, preview (G1.3, G1.5, G2)', () => {
  const options = { ...OPTIONS, go_easy_areas: AREAS };

  test('G1.3 review row 6: "Go easy on: {names, server order}" between focus and avoid', () => {
    const a = { ...answersFromProfile(PROFILE), go_easy_area_ids: [3, 1, 77] };
    expect(reviewSummaries(a, options)[5].summary).toBe('Focus: Chest · Go easy on: Knees, Shoulders · Avoid: Dips');
  });

  test('G1.3 review row 6: "Nothing to go easy on"; e.g. "No focus · Go easy on: Knees · Nothing to avoid"', () => {
    const empty = { ...answersFromProfile(PROFILE), focus_muscle_ids: [], exclusions: [] };
    expect(reviewSummaries(empty, options)[5].summary).toBe('No focus · Nothing to go easy on · Nothing to avoid');
    expect(reviewSummaries({ ...empty, go_easy_area_ids: [1] }, options)[5].summary).toBe(
      'No focus · Go easy on: Knees · Nothing to avoid'
    );
  });

  test('G1.3 review row 6: no go-easy part when no areas are offered', () => {
    const a = { ...answersFromProfile(PROFILE), go_easy_area_ids: [1] };
    expect(reviewSummaries(a, OPTIONS)[5].summary).toBe('Focus: Chest · Avoid: Dips');
  });

  test('G1.5 422: errors.go_easy_area_ids → step 6', () => {
    expect(stepErrorsFrom422({ go_easy_area_ids: ['Clashes with a focus muscle.'] })).toEqual({
      6: 'Clashes with a focus muscle.',
    });
  });

  test('deep link: an integer 0–5 opens that step; anything else → step 1 as before', () => {
    expect(deepLinkStep(0)).toBe(1);
    expect(deepLinkStep(4)).toBe(5);
    expect(deepLinkStep(5)).toBe(6);
    for (const bad of [undefined, null, -1, 6, 2.5, '5', NaN]) {
      expect(deepLinkStep(bad)).toBeNull();
    }
  });

  test('G2.1: a 422 errors.go_easy_area_ids is its own kind; errors.profile keeps "profile"', () => {
    expect(classifyPreviewError(httpError(422, { errors: { go_easy_area_ids: ['GO_EASY_FOCUS_CONFLICT'] } }))).toBe('goEasy');
    expect(classifyPreviewError(httpError(422, { errors: { profile: ['x'] } }))).toBe('profile');
    expect(classifyPreviewError(httpError(422, { errors: {} }))).toBe('other');
  });

  test('G2.3 refusal: only GO_EASY_TOO_RESTRICTIVE changes the actions; equipment_fix missing = false', () => {
    expect(refusalActions({ code: 'GO_EASY_TOO_RESTRICTIVE', equipment_fix: true })).toEqual({ equipmentFix: true });
    expect(refusalActions({ code: 'GO_EASY_TOO_RESTRICTIVE' })).toEqual({ equipmentFix: false });
    expect(refusalActions({ code: 'GO_EASY_TOO_RESTRICTIVE', equipment_fix: 'yes' })).toEqual({ equipmentFix: false });
    expect(refusalActions({ code: 'NO_EQUIPMENT' })).toBeNull();
    expect(refusalActions(undefined)).toBeNull();
  });
});
