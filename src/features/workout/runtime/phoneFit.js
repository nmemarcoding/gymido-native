// T-154 + T-155 (owner-approved look, PM 30 Oct; web 2.4.1): the phone set screen and the browse view fit the visible
// height without scrolling at normal text. The DEFAULT: the photo up to 300 (contain), the 2.3.2 Rest/How to row + name,
// the notes card, the compact half-circle card (steppers 108, ± 36, the previous row 28), the 64 Up next row and the
// full-width Discard.
// T-155 round 3 (PM 30 Oct; owner: the photo at least as big as web's): always the LARGEST layout that fits, found by a
// search, not a one-way ladder. The notes give first (clamped to 1 line + More), then the photo (300 → 112), then the
// gaps 12 → 8, the steppers 108 → 96 (live only), the arc 154 → 132, in that order of preference; past that the photo
// becomes a 56 thumb beside the row + name (the notes, clamped, full width under it) and the same steps are searched again
// from the full size; (browse, last) the Volume·Reps line hides. The model uses the MEASURED blocks (the name at both widths, the notes card full and clamped, the
// row, the photo's natural height) and a `correction`: the measured content minus the model for the layout on screen, so
// whatever the model doesn't know is fitted against the real height.

const DEFAULT = Object.freeze({
  compact: false,
  photoTop: 6,
  photoMax: 300,
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
  row: 36,
});

// A Weight / Reps cell as drawn (SetArcCard, compact): padding 6 + border 1 on each side, the 28 label slot, 4, the value
// (38; 34 tight), 4, the ± buttons (36; 32 tight). Its minimum is the fit's steppers height.
export function cellHeight(steppers) {
  const tight = steppers < DEFAULT.steppers;
  return Math.max(steppers, 14 + 28 + 4 + (tight ? 34 : 38) + 4 + (tight ? 32 : 36));
}

// The card: padding 12 + the arc box + (8 + the previous row) + (8 + the cells) + padding 12.
function cardHeight(fit, { previousRow, browse }) {
  return 12 + fit.arc + (previousRow ? 8 + fit.previousRow : 0) + (browse ? 0 : 8 + cellHeight(fit.steppers)) + 12;
}

function inputsWithDefaults({ name = 38, nameThumb, notes = 0, notesClamped, row = FIT.row, hasPhoto = true, photoNatural = Infinity, previousRow = true, upNext = true, browse = false, correction = 0 }) {
  return {
    name,
    nameThumb: nameThumb ?? name,
    notes,
    notesClamped: Math.min(notes, notesClamped ?? notes),
    row,
    hasPhoto,
    photoNatural,
    previousRow,
    upNext,
    browse,
    correction,
  };
}

// The model's height of a layout (without the correction). `notes` = the measured notes card with its space above.
export function fitHeight(fit, rawInputs) {
  const inputs = inputsWithDefaults(rawInputs);
  const notes = fit.notesClamp ? inputs.notesClamped : inputs.notes;
  const textBlock = fit.thumb ? Math.max(FIT.thumb, inputs.row + 4 + inputs.nameThumb) + notes : inputs.row + 4 + inputs.name + notes;
  const photo = inputs.hasPhoto && !fit.thumb ? fit.photoTop + Math.min(fit.photo, inputs.photoNatural) + fit.gap : fit.photoTop;
  const top = inputs.browse ? FIT.bannerGap + FIT.banner : 0;
  const stats = inputs.browse && fit.statsLine ? 8 + FIT.statsLine : 0;
  const tail = (inputs.upNext ? fit.upNextGap + fit.upNext : 0) + fit.discardGap + fit.discard;
  return top + photo + textBlock + fit.gap + cardHeight(fit, inputs) + stats + tail;
}

// The gap / steppers / arc steps, cumulative in the ruling's order (none; the gaps; + the steppers; + the arc). Browse has
// no steppers step.
function stepCombos(browse) {
  const none = { gap: DEFAULT.gap, steppers: DEFAULT.steppers, arc: DEFAULT.arc };
  const gaps = { ...none, gap: FIT.gapTight };
  const steppers = { ...gaps, steppers: FIT.steppersTight };
  return browse ? [none, gaps, { ...gaps, arc: FIT.arcTight }] : [none, gaps, steppers, { ...steppers, arc: FIT.arcTight }];
}

export function phoneFit({ available, ...raw }) {
  const inputs = inputsWithDefaults(raw);
  const room = available - inputs.correction;
  const base = { ...DEFAULT, photo: 0, thumb: false, notesClamp: false, statsLine: true };
  const result = (fit) => {
    const height = fitHeight(fit, inputs);
    return { ...fit, height, fits: height <= room };
  };
  const combos = stepCombos(inputs.browse);
  const clampable = inputs.notesClamped < inputs.notes;
  // 0. Everything at full size, the notes too.
  if (clampable) {
    const full = { ...base, photo: inputs.hasPhoto ? DEFAULT.photoMax : 0 };
    if (fitHeight(full, inputs) <= room) {
      return result(full);
    }
    base.notesClamp = true;
  }
  // 1. The full photo layout: the photo takes what the rest leaves, between its floor and 300 (and never more than it
  // draws at its own aspect).
  for (const combo of combos) {
    const fit = { ...base, ...combo, photo: inputs.hasPhoto ? DEFAULT.photoMax : 0 };
    if (!inputs.hasPhoto) {
      if (fitHeight(fit, inputs) <= room) {
        return result(fit);
      }
      continue;
    }
    const withoutPhoto = fitHeight({ ...fit, photo: 0 }, inputs);
    const photo = Math.min(DEFAULT.photoMax, room - withoutPhoto);
    if (photo >= Math.min(FIT.photoFloor, inputs.photoNatural)) {
      return result({ ...fit, photo: Math.floor(photo) });
    }
  }
  if (!inputs.hasPhoto) {
    return result({ ...base, ...combos[combos.length - 1], ...(inputs.browse ? { statsLine: false } : null) });
  }
  // 2. The thumb, the (clamped) notes full width under it; the steps searched again from the full size.
  for (const combo of combos) {
    const fit = { ...base, ...combo, thumb: true };
    if (fitHeight(fit, inputs) <= room) {
      return result(fit);
    }
  }
  // 3. (browse) the Volume·Reps line, last.
  return result({ ...base, ...combos[combos.length - 1], thumb: true, statsLine: !inputs.browse });
}
