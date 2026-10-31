import { useWindowDimensions } from 'react-native';

import { textScale } from '../theme/tokens';

// UX §9 large text, the kit's shared text roles. Spread these on a <Text>:
// - CAP_* caps how far a role scales with the system text size;
// - TITLE_TEXT / DISPLAY_TITLE_TEXT are the title rule: wrap by word, at most
//   3 lines, and a single word wider than the line shrinks the title (down
//   to 0.7×) instead of breaking inside it.
//
// T-170: this file is the ONE role table. Every top-level <Text> / <TextInput>
// spreads a role from here (lint rule gymido/text-cap); screens don't keep
// their own copies. Plain caps (no wrap rule):
export const CAP_BODY = Object.freeze({ maxFontSizeMultiplier: textScale.body });
export const CAP_PILL = Object.freeze({ maxFontSizeMultiplier: textScale.pill });
export const CAP_TITLE = Object.freeze({ maxFontSizeMultiplier: textScale.title });
// Display-sized text that never shrinks (big stat numbers, tile numerals).
export const CAP_DISPLAY = Object.freeze({ maxFontSizeMultiplier: textScale.display });
// Text inside fixed geometry (avatar circles, count badges, glyphs in chips).
export const CAP_BADGE = Object.freeze({ maxFontSizeMultiplier: textScale.badge });
export const CAP_TIMER = Object.freeze({ maxFontSizeMultiplier: textScale.timer });
// A field's unit suffix (kg, cm …).
export const CAP_SUFFIX = Object.freeze({ maxFontSizeMultiplier: textScale.suffix });
// Never scales (initials and glyphs sized to their circle).
export const CAP_NONE = Object.freeze({ maxFontSizeMultiplier: 1 });

// LIVE-WORKOUT-SPEC §0.1 (v2.3.1, T-170): on the live workout every text marked
// "cap 1.3" (initials tile, exercise name, arc count, stepper values, rest
// digits, Skip, rest name) is the Fit display role; everything else there is
// CAP_BODY (2.0, D-T170-1). FIT_CAP is the number, for props that take one.
export const FIT_CAP = textScale.display;
export const CAP_FIT = Object.freeze({ maxFontSizeMultiplier: FIT_CAP });

const TITLE_RULE = {
  textBreakStrategy: 'simple',
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
};
export const TITLE_TEXT = Object.freeze({ ...TITLE_RULE, maxFontSizeMultiplier: textScale.title });
export const DISPLAY_TITLE_TEXT = Object.freeze({ ...TITLE_RULE, maxFontSizeMultiplier: textScale.display });
// A display title held to 2 lines (the create-profile page title).
export const SHORT_DISPLAY_TITLE_TEXT = Object.freeze({ ...TITLE_RULE, numberOfLines: 2, maxFontSizeMultiplier: textScale.display });
// A title-capped name that wraps by word only, with no line limit or shrink
// (the phone workout plan name, the invite name).
export const WORD_TITLE_TEXT = Object.freeze({ textBreakStrategy: 'simple', maxFontSizeMultiplier: textScale.title });

// §1.1 long text (UX final audit X7, ruling 27 Oct) for list rows and cards:
// a name wraps by word to at most 2 lines, then an ellipsis; it never shrinks
// (shrink-to-fit is only for single-word stat-tile values, at 0.75). NAME_TEXT
// is body-sized (capped like body), NAME_TITLE_TEXT title-sized (a card name).
// LINE_TEXT: a secondary line or caption, 1 line + an ellipsis.
const NAME_RULE = {
  textBreakStrategy: 'simple',
  numberOfLines: 2,
  ellipsizeMode: 'tail',
};
export const NAME_TEXT = Object.freeze({ ...NAME_RULE, maxFontSizeMultiplier: textScale.body });
export const NAME_TITLE_TEXT = Object.freeze({ ...NAME_RULE, maxFontSizeMultiplier: textScale.title });
export const LINE_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body, numberOfLines: 1, ellipsizeMode: 'tail' });

// UX native final audit 27 Oct 2026, ruling 5: TOKEN_TEXT is one value that
// must never break inside itself (a date "10/15/1978", a weekday chip "Mon").
// One line; when it doesn't fit it shrinks (to 0.75) instead of splitting,
// and only past that ends in a tail ellipsis (never a silent cut).
// Android splits a word that is wider than the line whatever the break
// strategy, so the guard is the one-line cap + shrink, not textBreakStrategy
// alone (kept 'simple' so a fitting token never hyphenates or rebalances).
export const TOKEN_TEXT = Object.freeze({
  maxFontSizeMultiplier: textScale.body,
  numberOfLines: 1,
  ellipsizeMode: 'tail',
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.75,
  textBreakStrategy: 'simple',
});

// True when the system text size is past the reflow point (§9 rule 4): button
// pairs stack and trailing actions drop below the text. Read from
// useWindowDimensions so a live font-size change re-renders the layout.
export function useLargeTextReflow() {
  const { fontScale } = useWindowDimensions();
  return fontScale > textScale.reflowAbove;
}

// LIVE-WORKOUT-SPEC §5.4 (D-T170-2, PM 31 Oct): the phone live workout leaves
// the fit for large text by the web rule `(width < 19rem)`: width < 304 ×
// fontScale, so both platforms switch at the same scale on the same phone
// (360 → 1.184, 390 → 1.283, 440 → 1.447). Tablets have no large-text mode
// (§8) and keep the app reflow rule above.
export const LIVE_LARGE_TEXT_WIDTH = 19 * 16;
export function isLiveLargeText(width, fontScale) {
  return width < LIVE_LARGE_TEXT_WIDTH * fontScale;
}
export function useLiveLargeText(tablet) {
  const { width, fontScale } = useWindowDimensions();
  return tablet ? fontScale > textScale.reflowAbove : isLiveLargeText(width, fontScale);
}
