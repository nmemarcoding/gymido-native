import { NBSP, formatCount, keepUnitsTogether, pluralWord } from './counts';

describe('formatCount (RN-SPEC-v2-foundation §7.1, 27 Oct 2026)', () => {
  it('uses the singular for exactly 1 and the plural otherwise, joined by U+00A0', () => {
    expect(NBSP).toBe(' ');
    expect(formatCount(1, 'day', 'days')).toBe('1 day');
    expect(formatCount(3, 'day', 'days')).toBe('3 days');
    expect(formatCount(0, 'day', 'days')).toBe('0 days');
    expect(formatCount(1, 'training day', 'training days')).toBe('1 training day');
    expect(formatCount(4, 'training day', 'training days')).toBe('4 training days');
    expect(formatCount('1', 'day', 'days')).toBe('1 day');
  });

  it('pluralWord picks the word only', () => {
    expect(pluralWord(1, 'day', 'days')).toBe('day');
    expect(pluralWord(2, 'day', 'days')).toBe('days');
  });
});

describe('keepUnitsTogether (RN-SPEC-v2-foundation §7.1, 27 Oct 2026)', () => {
  it('joins a number and day / days / min with U+00A0', () => {
    expect(keepUnitsTogether('Get stronger · 3 days')).toBe('Get stronger · 3 days');
    expect(keepUnitsTogether('Full body 1 day')).toBe('Full body 1 day');
    expect(keepUnitsTogether('Quick 45 min plan')).toBe('Quick 45 min plan');
    expect(keepUnitsTogether('12 days, 30 min.')).toBe('12 days, 30 min.');
  });

  it('leaves "Day 3 ·", "3 Days", "minutes", "dayso" and numbers written as words untouched', () => {
    ['Day 3 · Legs', '3 Days split', '20 minutes', 'three days a week', '3 daysplit', '3 mins', '3  days', 'Upper / Lower'].forEach((text) =>
      expect(keepUnitsTogether(text)).toBe(text)
    );
  });

  it('is idempotent on text that already has U+00A0', () => {
    const once = keepUnitsTogether('Get stronger · 3 days');
    expect(keepUnitsTogether(once)).toBe(once);
    expect(keepUnitsTogether('3 days')).toBe('3 days');
  });

  it('passes non-strings through', () => {
    expect(keepUnitsTogether(undefined)).toBeUndefined();
    expect(keepUnitsTogether(null)).toBeNull();
    expect(keepUnitsTogether('')).toBe('');
  });
});
