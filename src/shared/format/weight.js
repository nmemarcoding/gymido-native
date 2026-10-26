// Weight unit conversion shared by Progress (RN-SPEC-progress PR1.2) and the
// trainer's client weight history (RN-SPEC-TRAINER-CLIENTS §C5.3).

const KG_PER_LB = 0.45359237;

// 1 lb = 0.45359237 kg exactly. Only lb → kg and kg → lb convert; any other
// pair (same, unknown or missing units) passes through unchanged.
export function convertWeight(value, from, to) {
  const number = Number(value);
  if (from === 'lb' && to === 'kg') {
    return number * KG_PER_LB;
  }
  if (from === 'kg' && to === 'lb') {
    return number / KG_PER_LB;
  }
  return number;
}
