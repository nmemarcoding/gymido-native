import { formatDuration, formatLocalDateForInput } from '../time/format';
import { formatNumber, formatSignedNumber, formatWeight } from './numbers';

describe('en-US number formats (home §H1.5)', () => {
  it('formats numbers, weights and signed differences', () => {
    expect(formatNumber(82.25)).toBe('82.3');
    expect(formatNumber(1234, 0)).toBe('1,234');
    expect(formatNumber(undefined)).toBe('—');
    expect(formatWeight(80, 'kg')).toBe('80 kg');
    expect(formatWeight(null, 'kg')).toBe('—');
    expect(formatWeight(1234.6, 'lb', 0)).toBe('1,235 lb');
    expect(formatSignedNumber(2.5, 'kg')).toBe('+2.5 kg');
    expect(formatSignedNumber(-3, 'kg')).toBe('-3 kg');
    expect(formatSignedNumber(0, 'kg')).toBe('0 kg');
    expect(formatSignedNumber(NaN, 'kg')).toBe('—');
  });
});

describe('formatDuration (time §5)', () => {
  it('never shows hours', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(725)).toBe('12m 5s');
    expect(formatDuration(5703)).toBe('95m 3s');
    expect(formatDuration(-4)).toBe('0s');
  });
});

describe('formatLocalDateForInput', () => {
  it('uses the local calendar date', () => {
    expect(formatLocalDateForInput(new Date(2026, 9, 22, 23, 30))).toBe('2026-10-22');
  });
});
