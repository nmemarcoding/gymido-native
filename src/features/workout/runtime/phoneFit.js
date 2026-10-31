// T-161 LIVE-WORKOUT-SPEC §5 (= web 2.4.1): the phone set screen and the browse view fit the visible height at normal
// text, one screen, no scroll. The result is always the LARGEST layout that fits: every change of the room or the content
// starts again from FULL and steps down, re-measuring after each step (§5.1: over = used − free, never a guessed budget).
// State = { roomy, photoMax, level }. The ladder (§5.2):
//   R1 photo, roomy: photoMax = max(160, photoMax − over)
//   R2 leave roomy: every ROOMY size → COMPACT (§3), photoMax 160
//   C1 photo, compact: photoMax = max(112, photoMax − over)
//   L2 long names (over 2 lines at 34 → 28) · L3 gaps 12 → 8 · L4 steppers (live) · L5 small arc · L6 thumb (with a photo)
//   L7 browse only: the totals line hides
// Levels are cumulative; level 1 doesn't exist. If the last step still overflows the layout stays (reported, no scroll).

export const FIT = Object.freeze({
  photoMax: 300,
  roomyPhotoFloor: 160,
  photoFloor: 112,
  arc: 154,
  arcSmall: 132,
  steppers: 108,
  steppersTight: 96,
  thumb: 56,
});

export const FULL = Object.freeze({ roomy: true, photoMax: FIT.photoMax, level: 0 });

// The sizes a fit state draws (§3.1–§3.6, §4).
export function fitSizes(state) {
  const { roomy, photoMax, level } = state;
  return {
    roomy,
    level,
    compact: !roomy,
    photo: photoMax,
    photoTop: roomy ? 6 : 8,
    // The text block's and the card container's top margins (L3).
    gap: level >= 3 ? 8 : 12,
    containerGap: level >= 3 ? 8 : 12,
    nameSmall: level >= 2,
    steppers: level >= 4 ? FIT.steppersTight : FIT.steppers,
    arc: level >= 5 ? FIT.arcSmall : FIT.arc,
    thumb: level >= 6,
    statsLine: level < 7,
    // Card → Up next, and Up next → Discard on top of it: roomy 12 + (12 + 12); compact 8 + (8 − 4).
    upNextGap: roomy ? 12 : 8,
    discardTop: roomy ? 12 : -4,
  };
}

// The next state when the layout is `over` too tall, or null when it fits (or nothing is left to step).
// `photoDrawn` = the photo's height at its aspect (null before it is known: the box is photoMax); `nameLines` = the name's
// lines at 34 on the full width.
export function nextFitStep(state, { over, hasPhoto, browse, photoDrawn = null, nameLines = 1 }) {
  if (!(over > 0)) {
    return null;
  }
  const photo = Math.min(state.photoMax, photoDrawn ?? state.photoMax);
  if (state.roomy) {
    if (hasPhoto && photo > FIT.roomyPhotoFloor) {
      return { ...state, photoMax: Math.max(FIT.roomyPhotoFloor, photo - over) };
    }
    return { roomy: false, photoMax: FIT.roomyPhotoFloor, level: 0 };
  }
  if (state.level === 0 && hasPhoto && photo > FIT.photoFloor) {
    return { ...state, photoMax: Math.max(FIT.photoFloor, photo - over) };
  }
  const applies = { 2: nameLines > 2, 3: true, 4: !browse, 5: true, 6: hasPhoto, 7: browse };
  const level = [2, 3, 4, 5, 6, 7].find((candidate) => candidate > state.level && applies[candidate]);
  return level ? { ...state, level } : null;
}
