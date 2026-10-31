// T-154 + T-155 v2 (owner-approved look, PM 30 Oct; web 2.4.1): the phone set screen and the browse view fit the
// visible height without scrolling at normal text. The DEFAULT: the photo up to 300 (contain), the 2.3.2 Rest/How to row
// + name, the compact half-circle card (rev 42: steppers 108, ± 36, the previous row 28), the 64 Up next row and the
// full-width Discard. Only when that doesn't fit, in order and only as far as needed: the photo 300 → 112, the gaps
// 12 → 8, the steppers 108 → 96 (live only), the arc 154 → 132, the photo → a 56 thumb beside the text; (browse, last)
// the Volume·Reps line hides. Always the LARGEST that fits: recomputed from the default on every change of the room or
// the content, so it grows back after a transient overflow.
// `text` = the measured name + exercise notes (WITHOUT the Rest/How to row).

const DEFAULT = Object.freeze({
  compact: false,
  photoTop: 6,
  photoMax: 300,
  row: 36,
  gap: 12,
  arc: 154,
  previousRow: 28,
  steppers: 108,
  upNextGap: 12,
  upNext: 64,
  // 12 + 12 below Up next (2.3.2).
  discardGap: 24,
  discard: 48,
});

export const FIT = Object.freeze({
  default: DEFAULT,
  photoFloor: 112,
  gapTight: 8,
  steppersTight: 96,
  arcTight: 132,
  thumb: 56,
  banner: 56,
  bannerGap: 8,
  statsLine: 20,
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
  const fit = { ...DEFAULT, photo: hasPhoto ? DEFAULT.photoMax : 0, thumb: false, statsLine: true };
  const over = () => fitHeight(fit, inputs) - available;
  const done = () => ({ ...fit, fits: over() <= 0 });
  if (over() <= 0) {
    return done();
  }
  // The photo gives first, down to its floor.
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
