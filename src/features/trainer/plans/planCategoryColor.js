import { muscle } from '../../../shared/theme/tokens';

// RN-SPEC-v2-phase5 §1 "Category chip colour rule" (phase6 O ruling 3):
// index = (sum of the UTF-16 code units of the category name) mod 6 over the
// avatar list (0 chest, 1 back, 2 teal, 3 legs, 4 arms, 5 core); the chip fill
// is that colour at 14 % and the text is that colour. Look only.
export const CATEGORY_COLORS = Object.freeze([muscle.chest, muscle.back, muscle.cardio, muscle.legs, muscle.arms, muscle.core]);
export const CATEGORY_FILL_ALPHA = 0.14;

export function categoryColorIndex(name) {
  const text = String(name ?? '');
  let sum = 0;
  for (let index = 0; index < text.length; index += 1) {
    sum += text.charCodeAt(index);
  }
  return sum % CATEGORY_COLORS.length;
}

export function categoryColor(name) {
  return CATEGORY_COLORS[categoryColorIndex(name)];
}

// The card's chip text: the server category name, or "Plan" (spec §A4.3).
export function planCategoryLabel(plan) {
  return plan?.category?.name || 'Plan';
}
