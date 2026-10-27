import { formatCount, keepUnitsTogether, NBSP, pluralWord } from '../../shared/format/counts';

// Display copy for the plan generator (RN-SPEC-PLAN-GENERATOR §G4, §G6).
// Pure, so it can be tested.

// §G4: unknown codes read as the code humanised ("SOMETHING_NEW" → "Something new").
export function humanizeCode(code) {
  if (code === null || code === undefined || code === '') {
    return '';
  }
  const text = String(code).replace(/_/g, ' ').toLowerCase().trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const GOAL_LABELS = Object.freeze({
  BUILD_MUSCLE: 'Build muscle',
  GET_STRONGER: 'Get stronger',
  GENERAL_FITNESS: 'General fitness',
});

export const BAND_LABELS = Object.freeze({
  UNDER_6_MONTHS: 'Under 6 months',
  '6_MONTHS_TO_2_YEARS': '6 months–2 years',
  '2_PLUS_YEARS': '2+ years',
  RETURNING_3_PLUS_MONTHS_OFF: 'Coming back after 3+ months off',
});

export const PRESET_LABELS = Object.freeze({
  FULL_GYM: 'Full gym',
  HOME_BARBELL: 'Home gym with a barbell',
  HOME_DUMBBELL: 'Home with dumbbells',
  CABLE_MACHINE: 'Cables and machines',
  KETTLEBELL: 'Kettlebells',
  BANDS: 'Resistance bands',
  BODYWEIGHT_PULLUP_BAR: 'Bodyweight + pull-up bar',
  BODYWEIGHT_ONLY: 'Bodyweight only',
});

export const REASON_LABELS = Object.freeze({
  DISLIKE: "Don't like it",
  DISCOMFORT: 'Causes discomfort',
});

const label = (map) => (code) => (Object.prototype.hasOwnProperty.call(map, code) ? map[code] : humanizeCode(code));

export const goalLabel = label(GOAL_LABELS);
export const bandLabel = label(BAND_LABELS);
export const presetLabel = label(PRESET_LABELS);
export const reasonLabel = label(REASON_LABELS);

// §G1.2, in step order.
export const QUESTIONS = Object.freeze([
  "What's your main goal?",
  'How long have you been lifting consistently?',
  'How many days a week can you train?',
  'How long is a typical session?',
  'Where do you train?',
  'Anything to focus on or avoid?',
]);

export const STEP_COUNT = 6;

export const COPY = Object.freeze({
  entryTitle: 'Build me a plan',
  entryBody: 'Answer 6 questions and get a plan made for you.',
  entryAction: 'Get started',
  // Batch B #10: the M1 header button.
  headerButton: 'Build me a plan',
  loadingQuestions: 'Loading questions',
  unavailableTitle: "The plan generator isn't available yet",
  unavailableMessage: 'Check back soon.',
  backToPlans: 'Back to plans',
  loadError: 'Could not load the plan generator',
  optional: 'Optional.',
  notAvailableYet: 'Not available yet',
  editEquipment: 'Edit equipment',
  doneEditing: 'Done editing',
  bodyweight: 'Bodyweight',
  alwaysIncluded: 'Always included',
  focusMuscles: 'Focus muscles',
  exercisesToAvoid: 'Exercises to avoid',
  searchPlaceholder: 'Search exercises to avoid',
  searching: 'Searching…',
  cancel: 'Cancel',
  back: 'Back',
  next: 'Next',
  skip: 'Skip',
  stepError: 'Please check this answer',
  reviewEyebrow: 'Build me a plan',
  reviewTitle: 'Check your answers',
  saveError: 'Could not save your answers',
  change: 'Change',
  disclaimer:
    "Gymido can't account for injuries or medical conditions. If you have one, follow your clinician's advice, or work with a trainer.",
  seeMyPlan: 'See my plan',
  buildingPlan: 'Building your plan',
  previewError: 'Could not build your plan',
  yourPlan: 'Your plan',
  changeSplit: 'Change split',
  lockedNotice: "Your current plan is managed by your trainer, so this plan can't replace it.",
  weeklySets: 'Weekly sets',
  changeAnswers: 'Change my answers',
  startPlan: 'Start this plan',
  notFeasibleTitle: "We couldn't build a plan with these answers",
  confirmTitle: 'End your current plan?',
  confirmAction: 'End it and start',
  planChanged: 'Your plan changed',
  splitError: 'Could not change the split',
  acceptError: 'Could not start this plan',
  acceptServerError: "We couldn't create your plan. Please try again.",
  whyThis: 'Why this:',
  // Go-easy areas (dated change 25 Oct 2026, T-18).
  goEasyLabel: 'Anything to go easy on?',
  goEasyFallback: "We'll avoid exercises that put heavy load on the areas you pick.",
  goEasyReviewPrefix: 'Go easy on: ',
  nothingToGoEasyOn: 'Nothing to go easy on',
  editGoEasyAreas: 'Edit go-easy areas',
  changeMyEquipment: 'Change my equipment',
  // v2 Phase 4 J (UX N6, approved canvas copy): the phone step-1 hint.
  step1Hint: "Next: how long you've been lifting, days a week, session length, where you train, and anything to focus on or avoid.",
  // v2 Phase 4 J: the phone preview's back icon button; the tablet split card.
  backToAnswers: 'Back to your answers',
  split: 'Split',
  // Review row 6 / 4 line labels (the code summary split for layout, J review).
  focusPrefix: 'Focus:',
  avoidPrefix: 'Avoid:',
  goEasyPrefix: 'Go easy on:',
  noFocus: 'No focus',
  nothingToAvoid: 'Nothing to avoid',
  minUnit: '\u00a0min',
});

// v2 Phase 4 J: the radio-group names of the single-choice steps (dated
// change 27 Oct: goal, experience, days, minutes and preset are radio groups).
export const RADIO_GROUP_LABELS = Object.freeze({
  1: 'Main goal',
  2: 'Lifting experience',
  3: 'Days a week',
  4: 'Session length',
  5: 'Where you train',
});

// The ghost numeral on the phone step header ("1/6"), decorative.
export const stepFraction = (step) => `${step}/${STEP_COUNT}`;

// Dated change 27 Oct: a preview exercise row announces "{name}, {muscle}, {prescription}".
export const exerciseRowLabel = (name, muscle, prescription) => [name, muscle, prescription].filter(Boolean).join(', ');

export const stepEyebrow = (step) => `Step ${step} of ${STEP_COUNT}`;
export const daysPillLabel = (n) => formatCount(n, 'day', 'days');
export const minutesPillLabel = (n) => `${n}${NBSP}min`;
// Review card 3: the unit after the big number ("3" + "\u00a0days a week", "1" + "\u00a0day a week").
export const daysAWeekUnit = (n) => `${NBSP}${pluralWord(n, 'day', 'days')} a week`;
export const pickUpTo = (n) => `Pick up to ${n}.`;
export const removeLabel = (name) => `Remove ${name}`;
export const changeLabel = (question) => `Change: ${question}`;
export const activeNotice = (planName) => `Starting this plan ends your current plan (${keepUnitsTogether(planName)}). Its history is kept.`;
export const confirmDescription = (planName) => `Your current plan (${keepUnitsTogether(planName)}) ends; its history is kept.`;
export const createdMessage = (planName) => `${keepUnitsTogether(planName)} created.`;
export const dayTitle = (day) => `Day ${day?.day_number}: ${day?.title}`;
export const dayMinutes = (minutes) => `~${minutes}${NBSP}min`;

// T-18 block hints: names lower case mid-sentence, the first word
// capitalised; joined "a", "a and b", "a, b and c" (no Oxford comma).
export function joinNames(names) {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const lower = (names) => names.map((name) => String(name).toLowerCase());

// Under go-easy, naming the blocked areas.
export function goEasyBlockedHint(names) {
  if (!names.length) {
    return '';
  }
  const joined = capitalise(joinNames(lower(names)));
  return names.length === 1
    ? `${joined} is one of your focus muscles. Remove it there to go easy on it.`
    : `${joined} are your focus muscles. Remove them there to go easy on them.`;
}

// Under Focus, naming the selected areas that block a Focus pill.
export function focusBlockedHint(names) {
  if (!names.length) {
    return '';
  }
  const joined = joinNames(lower(names));
  return names.length === 1
    ? `You're going easy on your ${joined}, so it can't be a focus.`
    : `You're going easy on your ${joined}, so they can't be a focus.`;
}
