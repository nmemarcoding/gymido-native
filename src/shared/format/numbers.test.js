import { formatDuration, formatLocalDateForInput } from '../time/format';
import { formatNumber, formatSignedChange, formatSignedNumber, formatToGoal, formatWeight, parseDecimal } from './numbers';

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

// T-64 (27 Oct 2026): one minus app-wide (U+2212), "+" for a gain, no sign
// once the value rounds to 0 at one decimal.
describe('formatSignedChange / formatToGoal (T-64)', () => {
  const MINUS = '\u2212';
  it('signs a change with a real minus, "+" above 0, nothing at a rounded 0', () => {
    expect(formatSignedChange(-1.5, 'kg')).toBe(`${MINUS}1.5 kg`);
    expect(formatSignedChange(2.25, 'lb')).toBe('+2.3 lb');
    expect(formatSignedChange(0, 'kg')).toBe('0 kg');
    expect(formatSignedChange(-0.04, 'kg')).toBe('0 kg');
    expect(formatSignedChange(0.04, 'kg')).toBe('0 kg');
    expect(formatSignedChange(-1234.5, 'lb')).toBe(`${MINUS}1,234.5 lb`);
    expect(formatSignedChange(null, 'kg')).toBe('—');
    expect(formatSignedChange('x', 'kg')).toBe('—');
  });

  it('To goal = −difference_to_goal (goal − current): a loss goal "−10 lb", a gain goal "+5 kg", "0 kg" at 0', () => {
    expect(formatToGoal(10, 'lb')).toBe(`${MINUS}10 lb`);
    expect(formatToGoal(-5, 'kg')).toBe('+5 kg');
    expect(formatToGoal('4.1', 'kg')).toBe(`${MINUS}4.1 kg`);
    expect(formatToGoal(0, 'kg')).toBe('0 kg');
    expect(formatToGoal(0.04, 'kg')).toBe('0 kg');
    expect(formatToGoal(-0.04, 'kg')).toBe('0 kg');
    expect(formatToGoal(undefined, 'kg')).toBe('—');
    expect(formatToGoal(NaN, 'kg')).toBe('—');
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

describe('parseDecimal (T-16)', () => {
  it('reads a comma or a dot as the decimal mark', () => {
    expect(parseDecimal('83,5')).toBe(83.5);
    expect(parseDecimal('83.5')).toBe(83.5);
    expect(parseDecimal('83,')).toBe(83);
    expect(parseDecimal(',5')).toBe(0.5);
    expect(parseDecimal(' 83 ')).toBe(83);
    expect(parseDecimal(82.5)).toBe(82.5);
  });

  it('is null when blank and NaN for anything else', () => {
    expect(parseDecimal('  ')).toBeNull();
    expect(parseDecimal(null)).toBeNull();
    for (const text of ['abc', '8,5,1', '1e2', '-2', ',', '.']) {
      expect(parseDecimal(text)).toBeNaN();
    }
  });
});
