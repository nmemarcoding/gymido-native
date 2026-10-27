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

// §1.1 long text (UX final audit X7) for list rows and cards: a name wraps by
// word to at most 2 lines, then an ellipsis; a single word too long for the
// line shrinks (down to 0.75×) instead of breaking inside it. NAME_TEXT is
// body-sized (capped like body), NAME_TITLE_TEXT title-sized (a card name).
// LINE_TEXT: a secondary line or caption, 1 line + an ellipsis.
const NAME_RULE = {
  textBreakStrategy: 'simple',
  numberOfLines: 2,
  ellipsizeMode: 'tail',
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.75,
};
export const NAME_TEXT = Object.freeze({ ...NAME_RULE, maxFontSizeMultiplier: textScale.body });
export const NAME_TITLE_TEXT = Object.freeze({ ...NAME_RULE, maxFontSizeMultiplier: textScale.title });
export const LINE_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body, numberOfLines: 1, ellipsizeMode: 'tail' });

// True when the system text size is past the reflow point (§9 rule 4): button
// pairs stack and trailing actions drop below the text. Read from
// useWindowDimensions so a live font-size change re-renders the layout.
export function useLargeTextReflow() {
  const { fontScale } = useWindowDimensions();
  return fontScale > textScale.reflowAbove;
}
