// C1: the native "Open settings" call is synchronous and may throw
// (ActivityNotFoundException on some OEM builds); it must never escape.
jest.mock('expo', () => ({
  requireOptionalNativeModule: () => ({
    openExactAlarmSettings: () => {
      throw new Error('ActivityNotFoundException');
    },
  }),
}));

const { restCountdown } = require('./restCountdown');

describe('restCountdown.openExactAlarmSettings', () => {
  it('swallows a native throw', () => {
    expect(() => restCountdown.openExactAlarmSettings()).not.toThrow();
  });
});
