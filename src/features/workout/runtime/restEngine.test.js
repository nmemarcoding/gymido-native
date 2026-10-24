import { adjustTimer, formatClock, rebasedTotal, remainingSeconds } from './restEngine';

describe('rest engine (time §7.2)', () => {
  const start = 1_000_000;

  it('counts down on the wall clock and never goes negative', () => {
    expect(remainingSeconds(90, start, start + 30_400)).toBe(60);
    expect(remainingSeconds(90, start, start + 200_000)).toBe(0);
  });

  it('rebases the total only for a jump larger than one second', () => {
    expect(rebasedTotal(60, 90, start, start + 30_000)).toBe(90);
    expect(rebasedTotal(65, 90, start, start + 30_000)).toBe(95);
    expect(rebasedTotal(55, 90, start, start + 30_000)).toBe(85);
  });

  it('adjusts by five seconds and grows the total for +5', () => {
    expect(adjustTimer({ secondsLeft: 3, totalSeconds: 90 }, -5)).toEqual({ secondsLeft: 0, totalSeconds: 90 });
    expect(adjustTimer({ secondsLeft: 88, totalSeconds: 90 }, 5)).toEqual({ secondsLeft: 93, totalSeconds: 93 });
  });

  it('formats m:ss', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(5)).toBe('0:05');
  });
});
