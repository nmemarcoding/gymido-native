import { useWindowDimensions } from 'react-native';

import { textScale } from '../theme/tokens';

// UX §9 large text, the kit's shared text roles. Spread these on a <Text>:
// - CAP_* caps how far a role scales with the system text size;
// - TITLE_TEXT / DISPLAY_TITLE_TEXT are the title rule: wrap by word, at most
//   3 lines, and a single word wider than the line shrinks the title (down
//   to 0.7×) instead of breaking inside it.
export const CAP_BODY = Object.freeze({ maxFontSizeMultiplier: textScale.body });
export const CAP_PILL = Object.freeze({ maxFontSizeMultiplier: textScale.pill });

const TITLE_RULE = {
  textBreakStrategy: 'simple',
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
};
export const TITLE_TEXT = Object.freeze({ ...TITLE_RULE, maxFontSizeMultiplier: textScale.title });
export const DISPLAY_TITLE_TEXT = Object.freeze({ ...TITLE_RULE, maxFontSizeMultiplier: textScale.display });

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
