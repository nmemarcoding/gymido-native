import { createDeclineLimiter } from './declineLimiter';

describe('declineLimiter', () => {
  it('recovers the first two declines silently and fails on the third within 60 seconds', () => {
    const limiter = createDeclineLimiter();
    expect(limiter.record(0)).toBe('silent');
    expect(limiter.record(1_000)).toBe('silent');
    expect(limiter.record(59_000)).toBe('fail');
    expect(limiter.record(59_500)).toBe('fail');
  });

  it('forgets declines older than 60 seconds', () => {
    const limiter = createDeclineLimiter();
    expect(limiter.record(0)).toBe('silent');
    expect(limiter.record(1_000)).toBe('silent');
    expect(limiter.record(61_000)).toBe('silent');
  });
});
