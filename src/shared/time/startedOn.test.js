import { runStartPlan } from '../../features/myPlans/myPlanFormat';
import { buildAcceptBody } from '../../features/planGenerator/generatorLogic';
import { formatLocalDateForInput } from './format';

// Owner decision (23 Oct 2026): every `started_on` is the device's LOCAL date
// (⚠7/⚠T6 retired). The LA-evening case: 20:30 on 22 Oct in Los Angeles is
// already 23 Oct in UTC, and the member must still start on the 22nd.
describe('started_on is the local date', () => {
  const savedTz = process.env.TZ;
  const laEvening = new Date('2026-10-23T03:30:00Z');

  beforeAll(() => {
    process.env.TZ = 'America/Los_Angeles';
  });

  afterAll(() => {
    if (savedTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = savedTz;
    }
  });

  it('formats the LA evening as that local day, not the UTC one', () => {
    expect(laEvening.toISOString().slice(0, 10)).toBe('2026-10-23');
    expect(formatLocalDateForInput(laEvening)).toBe('2026-10-22');
  });

  it('G2 accept sends the local date', () => {
    expect(buildAcceptBody('h', false, laEvening).started_on).toBe('2026-10-22');
  });

  it('M3 start sends the local date by default', async () => {
    jest.useFakeTimers({ now: laEvening });
    try {
      const api = { cancelEnrollment: jest.fn(), startPlan: jest.fn().mockResolvedValue({}) };
      await runStartPlan({ planId: '7', planName: 'Strength', enrollment: null, api });
      expect(api.startPlan).toHaveBeenCalledWith('7', '2026-10-22');
    } finally {
      jest.useRealTimers();
    }
  });
});
