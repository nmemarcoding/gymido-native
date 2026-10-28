import { textScale } from '../../shared/theme/tokens';

// PM fix (27 Oct 2026; Edit profile at 320 dp showed "78" / "70" for 178 /
// 170 lb): a single-line input narrower than its value scrolls to the caret,
// so the first digits vanish. A phone weight pair stays side by side only
// while each input keeps the text room for a whole weight: WEIGHT_DIGITS
// tabular digits (about 0.62 em each in Geist 700) at the field's text scale
// (capped as the input caps it). Otherwise the pair stacks, full width.
export const WEIGHT_DIGITS = 4;
export const TABULAR_DIGIT_EM = 0.62;

// `column`: the pair's width; `gap`: between the two cells; `chrome`: what a
// cell spends around the text (card padding + borders, the box border, the
// input's left and right paddings); `fontSize`: the value's size at 1×.
export function weightTextRoom({ column, gap, chrome }) {
  return (column - gap) / 2 - chrome;
}

export function weightPairStacks({ column, gap, chrome, fontSize, fontScale = 1 }) {
  const scale = Math.min(fontScale, textScale.body);
  return weightTextRoom({ column, gap, chrome }) < WEIGHT_DIGITS * TABULAR_DIGIT_EM * fontSize * scale;
}
