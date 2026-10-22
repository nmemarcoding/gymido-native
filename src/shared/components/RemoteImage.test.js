import { isCancelledLoad, nextImageState } from './RemoteImage';

const start = { index: 0, attempt: 0, cancels: 0 };
const cancelled = { nativeEvent: { error: 'Error Domain=NSURLErrorDomain Code=-999 "cancelled"' } };
const failed = { nativeEvent: { error: 'Failed to load' } };

describe('RemoteImage fallback rule', () => {
  it('detects cancelled loads', () => {
    expect(isCancelledLoad(cancelled)).toBe(true);
    expect(isCancelledLoad(failed)).toBe(false);
    expect(isCancelledLoad(undefined)).toBe(false);
  });

  it('retries the current candidate on a cancel', () => {
    expect(nextImageState(start, cancelled)).toEqual({ index: 0, attempt: 1, cancels: 1 });
  });

  it('advances only on a real failure', () => {
    expect(nextImageState({ index: 0, attempt: 1, cancels: 1 }, failed)).toEqual({ index: 1, attempt: 1, cancels: 0 });
  });

  it('stops retrying a candidate after repeated cancels', () => {
    expect(nextImageState({ index: 2, attempt: 2, cancels: 2 }, cancelled)).toEqual({ index: 3, attempt: 2, cancels: 0 });
  });
});
