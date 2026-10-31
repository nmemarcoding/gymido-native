// T-154 + T-155 (owner, RN-SPEC dated 30 Oct; web 2.4.1): the phone set screen and the browse view fit the visible
// height without scrolling at normal text. The DEFAULT is the full 2.3.2 look; the ladder applies only when that
// doesn't fit, each step only as far as needed, and the result is always the LARGEST that fits (it is recomputed from
// the full sizes on every change of the room or the content, so it grows back after a transient overflow):
//   (a) the photo 240 → 160  (b) the T-154 compact sizes (photo 160)  (c) the photo 160 → 112
//   then T-154: the gaps 12 → 8, the steppers 108 → 96 (live only), the arc 154 → 132, the photo → a 56 thumb beside
//   the text; (browse, last) the Volume·Reps line hides.
// `text` = the measured name + exercise notes (WITHOUT the Rest/How to row, which differs per mode), so a mode's own
// layout never feeds back into the choice.

const FULL = Object.freeze({
  compact: false,
  photoTop: 6,
  photoMax: 240,
  row: 36,
  gap: 12,
  arc: 154,
  previousRow: 32,
  steppers: 116,
  upNextGap: 12,
  upNext: 64,
  // 12 + 12 below Up next (2.3.2).
  discardGap: 24,
  discard: 48,
});

const COMPACT = Object.freeze({
  compact: true,
  photoTop: 8,
  photoMax: 160,
  row: 32,
  gap: 12,
  arc: 154,
  previousRow: 28,
  steppers: 108,
  upNextGap: 8,
  upNext: 48,
  discardGap: 4,
  discard: 32,
});

export const FIT = Object.freeze({
  full: FULL,
  compactSizes: COMPACT,
  photoStep: 160,
  photoFloor: 112,
  gapTight: 8,
  steppersTight: 96,
  arcTight: 132,
  thumb: 56,
  banner: 56,
  bannerGap: 8,
  statsLine: 20,
  // Kept for readers of the T-154 names.
  arc: 154,
});

// The card: padding 12 + the arc box + (8 + the previous row) + (8 + the steppers) + padding 12.
function cardHeight(fit, { previousRow, browse }) {
  return 12 + fit.arc + (previousRow ? 8 + fit.previousRow : 0) + (browse ? 0 : 8 + fit.steppers) + 12;
}

export function fitHeight(fit, { text, hasPhoto, previousRow, upNext, browse }) {
  const textBlock = fit.thumb ? Math.max(FIT.thumb, fit.row + 4 + text) : fit.row + 4 + text;
  const photo = hasPhoto && !fit.thumb ? fit.photoTop + fit.photo + fit.gap : fit.photoTop;
  const top = browse ? FIT.bannerGap + FIT.banner : 0;
  const stats = browse && fit.statsLine ? 8 + FIT.statsLine : 0;
  const tail = (upNext ? fit.upNextGap + fit.upNext : 0) + fit.discardGap + fit.discard;
  return top + photo + textBlock + fit.gap + cardHeight(fit, { previousRow, browse }) + stats + tail;
}

export function phoneFit({ available, text, hasPhoto = true, previousRow = true, upNext = true, browse = false }) {
  const inputs = { text, hasPhoto, previousRow, upNext, browse };
  let fit = { ...FULL, photo: FULL.photoMax, thumb: false, statsLine: true };
  const over = () => fitHeight(fit, inputs) - available;
  const done = () => ({ ...fit, fits: over() <= 0 });
  if (over() <= 0) {
    return done();
  }
  // (a) The photo gives up what is missing, down to 160.
  if (hasPhoto) {
    fit.photo = Math.max(FIT.photoStep, fit.photo - over());
    if (over() <= 0) {
      return done();
    }
  }
  // (b) The T-154 compact sizes (the photo at 160).
  fit = { ...fit, ...COMPACT, photo: hasPhoto ? FIT.photoStep : 0 };
  if (over() <= 0) {
    return done();
  }
  // (c) The photo 160 → 112.
  if (hasPhoto) {
    fit.photo = Math.max(FIT.photoFloor, fit.photo - over());
    if (over() <= 0) {
      return done();
    }
  }
  const steps = [() => (fit.gap = FIT.gapTight), () => !browse && (fit.steppers = FIT.steppersTight), () => (fit.arc = FIT.arcTight)];
  for (const step of steps) {
    step();
    if (over() <= 0) {
      return done();
    }
  }
  if (hasPhoto) {
    fit.thumb = true;
    fit.photo = 0;
    if (over() <= 0) {
      return done();
    }
  }
  if (browse) {
    fit.statsLine = false;
  }
  return done();
}
