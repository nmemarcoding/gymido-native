// T-162 = LIVE-WORKOUT-SPEC §12 P5 + P5-SC, option (a) (owner-approved 31 Oct): the phone set screen and the browse view
// fit the visible height at normal text, one screen, no scroll, and the PHOTO GIVES LAST. The photo is always contain at
// its natural height (min(W ÷ aspect, 300)) until everything else has given. Every change of the room or the content
// starts again from FULL and steps down, re-measuring after each step (§5.1: over = used − free, never a guessed budget).
// The ladder (cumulative; each step only if it still overflows):
//   S1 gaps (text top, card top, card → Up next 12 → 8) · S2 compact card (small arc + small steppers) · S3 Up next 48 ·
//   S4 Discard → the 32 link · S5 row 1 compact (32) · S6 a 2+ line name 34 → 28 · S9 (browse) the totals line hides ·
//   S7a the photo down to 200 · SC the proportional SCALE (P5-SC) · S7b the photo down to the floor (160 on a 390+ column,
//   else 112). No thumb at normal text. Still over at the floor: the layout stays (reported, no scroll).

export const FIT = Object.freeze({
  photoMax: 300,
  photoScale: 200,
  floorWide: 160,
  floorNarrow: 112,
  // The "390 class" (PM 31 Oct): the content column is at least 390 wide.
  wideColumn: 390,
});

const LIVE_STEPS = Object.freeze(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7a', 'SC', 'S7b']);
const BROWSE_STEPS = Object.freeze(['S1', 'S2', 'S4', 'S5', 'S6', 'S9', 'S7a', 'SC', 'S7b']);

export function fitSteps(browse) {
  return browse ? BROWSE_STEPS : LIVE_STEPS;
}

// `level` = the index of the last step taken (−1 = FULL); `photo` = the photo's cap (null = its natural height).
export const FULL = Object.freeze({ level: -1, photo: null });

export function photoFloor(columnWidth) {
  return columnWidth >= FIT.wideColumn ? FIT.floorWide : FIT.floorNarrow;
}

// The sizes a fit state draws (§3 roomy, the S-steps, P5-SC scaled).
export function fitSizes(state, { browse = false } = {}) {
  const steps = fitSteps(browse);
  const has = (step) => steps.indexOf(step) !== -1 && steps.indexOf(step) <= state.level;
  const scaled = has('SC');
  const gap = scaled ? 6 : has('S1') ? 8 : 12;
  const discardLink = has('S4');
  return {
    level: state.level,
    photo: state.photo ?? FIT.photoMax,
    photoTop: scaled ? 4 : 6,
    // The text block's top, the card's top and card → Up next.
    gap,
    containerGap: gap,
    upNextGap: gap,
    // Up next → Discard: 12 + 12 above the 48 row; the link sits 4 below Up next.
    discardTop: discardLink ? 4 - gap : 24 - gap,
    compactCard: has('S2'),
    upNextSlim: has('S3'),
    discardLink,
    rowCompact: has('S5'),
    nameSmall: has('S6'),
    statsLine: !has('S9'),
    scaled,
    thumb: false,
  };
}

// The next state when the layout is `over` too tall, or null when it fits (or nothing is left to step).
// `photoDrawn` = the photo's natural height (null before its aspect is known: the box is the cap); `nameLines` = the
// name's lines at 34 on the full width; `columnWidth` picks the floor; `upNext` = the Up next row shows (S3 needs it).
export function nextFitStep(state, { over, hasPhoto, browse = false, photoDrawn = null, nameLines = 1, columnWidth = 390, upNext = true }) {
  if (!(over > 0)) {
    return null;
  }
  const steps = fitSteps(browse);
  const photo = Math.min(state.photo ?? FIT.photoMax, photoDrawn ?? FIT.photoMax);
  const floorFor = (step) => (step === 'S7a' ? FIT.photoScale : photoFloor(columnWidth));
  const shrink = (step) => (hasPhoto && photo > floorFor(step) ? Math.max(floorFor(step), photo - over) : null);
  // A photo step keeps giving until its floor.
  const current = steps[state.level];
  if (current === 'S7a' || current === 'S7b') {
    const next = shrink(current);
    if (next != null) {
      return { level: state.level, photo: next };
    }
  }
  for (let index = state.level + 1; index < steps.length; index += 1) {
    const step = steps[index];
    if (step === 'S7a' || step === 'S7b') {
      const next = shrink(step);
      if (next != null) {
        return { level: index, photo: next };
      }
      continue;
    }
    if ((step === 'S6' && nameLines < 2) || (step === 'S3' && !upNext)) {
      continue;
    }
    return { level: index, photo: state.photo };
  }
  return null;
}
