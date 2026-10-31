// T-154 (rev 42, owner: "everything stays on one screen; no scroll needed"): the phone set screen and the browse view
// fit the free height without scrolling at normal text. Given the measured free height (window − insets − the header
// bar; browse also − the bottom navigator) and the measured text block (the Rest/How to row + the name), this gives in
// rev 42 B's order, each step only as far as needed:
//   1. the photo 160 → 112 (contain)  3. the gaps 12 → 8  4. the steppers 108 → 96 (live only)
//   5. the arc 154 → 132  6. the photo becomes a 56 thumb beside the text  (browse) 7. the Volume·Reps line hides.
// (Step 2, a name over 2 lines at 28, is the name's own rule and arrives here through the measured text height.)
// The result may still not fit on an unusually short phone: thumb mode and the floors hold (report it; no scroll).

export const FIT = Object.freeze({
  photoMax: 160,
  photoFloor: 112,
  gap: 12,
  gapTight: 8,
  steppers: 108,
  steppersTight: 96,
  arc: 154,
  arcTight: 132,
  thumb: 56,
  photoTop: 8,
  previousRow: 28,
  upNext: 48,
  discard: 32,
  banner: 56,
  statsLine: 20,
});

// The card: padding 12 + the arc box + (8 + the previous row) + (8 + the steppers) + padding 12.
function cardHeight({ arc, steppers, previousRow, browse }) {
  return 12 + arc + (previousRow ? 8 + FIT.previousRow : 0) + (browse ? 0 : 8 + steppers) + 12;
}

export function fitHeight(fit, { text, hasPhoto, previousRow, upNext, browse }) {
  const textBlock = fit.thumb ? Math.max(FIT.thumb, text) : text;
  const photo = hasPhoto && !fit.thumb ? FIT.photoTop + fit.photo + fit.gap : FIT.photoTop;
  const top = browse ? FIT.banner + FIT.photoTop : 0;
  const stats = browse && fit.statsLine ? 8 + FIT.statsLine : 0;
  const tail = (upNext ? 8 + FIT.upNext : 0) + 4 + FIT.discard;
  return top + photo + textBlock + fit.gap + cardHeight({ arc: fit.arc, steppers: fit.steppers, previousRow, browse }) + stats + tail;
}

export function phoneFit({ available, text, hasPhoto = true, previousRow = true, upNext = true, browse = false }) {
  const inputs = { text, hasPhoto, previousRow, upNext, browse };
  const fit = { photo: FIT.photoMax, gap: FIT.gap, steppers: FIT.steppers, arc: FIT.arc, thumb: false, statsLine: true };
  const over = () => fitHeight(fit, inputs) - available;
  if (over() <= 0) {
    return { ...fit, fits: true };
  }
  // 1. The photo gives up what is missing, down to its floor.
  if (hasPhoto) {
    fit.photo = Math.max(FIT.photoFloor, fit.photo - over());
    if (over() <= 0) {
      return { ...fit, fits: true };
    }
  }
  // 3–5, in order.
  const steps = [() => (fit.gap = FIT.gapTight), () => !browse && (fit.steppers = FIT.steppersTight), () => (fit.arc = FIT.arcTight)];
  for (const step of steps) {
    step();
    if (over() <= 0) {
      return { ...fit, fits: true };
    }
  }
  // 6. The photo becomes a thumb beside the text (with no photo there is nothing left to give).
  if (hasPhoto) {
    fit.thumb = true;
    fit.photo = 0;
    if (over() <= 0) {
      return { ...fit, fits: true };
    }
  }
  // 7 (browse, last): the Volume·Reps line hides only where it doesn't fit.
  if (browse) {
    fit.statsLine = false;
  }
  return { ...fit, fits: over() <= 0 };
}
