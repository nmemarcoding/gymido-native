import {
  ON_HOLD_TAIL,
  canStartPlan,
  copyErrorMessage,
  getStartHint,
  isCurrentPlan,
  memberSlug,
  myPlansLoadFailure,
  runStartPlan,
} from './myPlanFormat';

const httpError = (status, message) => ({ response: { status, data: message ? { message } : {} } });

describe('memberSlug (§M2, D1)', () => {
  it('appends 6 random a–z letters to the name slug', () => {
    const letters = [0, 0.04, 0.5, 0.99, 0.2, 0.3];
    let i = 0;
    expect(memberSlug('My Strength Plan!', () => letters[i++])).toBe('my-strength-plan-abnzfh');
    expect(memberSlug('My Strength Plan!')).toMatch(/^my-strength-plan-[a-z]{6}$/);
  });

  it('falls back to "plan"', () => {
    expect(memberSlug('!!!')).toMatch(/^plan-[a-z]{6}$/);
  });

  it('draws a new suffix each call', () => {
    const seen = new Set(Array.from({ length: 20 }, () => memberSlug('x')));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('myPlansLoadFailure (§M1)', () => {
  it('is on hold by status 403 only, never by text', () => {
    expect(myPlansLoadFailure(httpError(403, 'Unavailable'))).toEqual({ status: 'onHold', message: 'Unavailable' });
    expect(myPlansLoadFailure(httpError(500, 'Your own plans are unavailable while you have a trainer'))).toEqual({
      status: 'error',
      message: 'Your own plans are unavailable while you have a trainer',
    });
  });
});

describe('current plan and the start hint (§M3.4)', () => {
  it('compares the enrollment plan id loosely with the route id', () => {
    expect(isCurrentPlan({ enrollment: { workout_plan_id: 12 } }, '12')).toBe(true);
    expect(isCurrentPlan({ enrollment: { workout_plan_id: 12 } }, '13')).toBe(false);
    expect(isCurrentPlan(null, '12')).toBe(false);
    expect(isCurrentPlan({ enrollment: null }, '12')).toBe(false);
  });

  it('disables Start for an inactive plan or one with no days', () => {
    expect(canStartPlan({ is_active: true }, [{ id: 1 }])).toBe(true);
    expect(canStartPlan({}, [{ id: 1 }])).toBe(true);
    expect(canStartPlan({ is_active: false }, [{ id: 1 }])).toBe(false);
    expect(canStartPlan({ is_active: true }, [])).toBe(false);
  });

  it('shows at most one hint, in order current → inactive → no days', () => {
    const inactive = { is_active: false };
    expect(getStartHint({ isCurrent: true, plan: inactive, days: [] })).toBe('current');
    expect(getStartHint({ isCurrent: false, plan: inactive, days: [] })).toBe('inactive');
    expect(getStartHint({ isCurrent: false, plan: {}, days: [] })).toBe('noDays');
    expect(getStartHint({ isCurrent: false, plan: {}, days: [{ id: 1 }] })).toBeNull();
  });
});

describe('runStartPlan (§M3.4)', () => {
  const api = () => ({ cancelEnrollment: jest.fn().mockResolvedValue({}), startPlan: jest.fn().mockResolvedValue({}) });

  it('cancels the current enrollment, then enrols with the UTC date', async () => {
    const calls = api();
    const outcome = await runStartPlan({
      planId: '7',
      planName: 'Strength',
      enrollment: { id: 40 },
      api: calls,
      today: '2026-10-23',
    });
    expect(calls.cancelEnrollment).toHaveBeenCalledWith(40);
    expect(calls.startPlan).toHaveBeenCalledWith('7', '2026-10-23');
    expect(calls.cancelEnrollment.mock.invocationCallOrder[0]).toBeLessThan(calls.startPlan.mock.invocationCallOrder[0]);
    expect(outcome).toEqual({ type: 'success', message: 'Strength activated.', cancelled: true });
  });

  it('reports the cancel when the enrol fails after it (W4)', async () => {
    const calls = api();
    calls.startPlan.mockRejectedValueOnce(httpError(500, 'Server error'));
    const outcome = await runStartPlan({ planId: '7', planName: 'S', enrollment: { id: 40 }, api: calls, today: 'd' });
    expect(outcome).toEqual({ type: 'toast', message: 'Server error', cancelled: true });
  });

  it('treats a 404 on cancel as already cancelled and enrols', async () => {
    const calls = api();
    calls.cancelEnrollment.mockRejectedValueOnce(httpError(404));
    const outcome = await runStartPlan({ planId: '7', planName: 'S', enrollment: { id: 40 }, api: calls, today: 'd' });
    expect(calls.startPlan).toHaveBeenCalledWith('7', 'd');
    expect(outcome).toEqual({ type: 'success', message: 'S activated.', cancelled: true });
  });

  it('skips the cancel with no known enrollment (⚠M-1)', async () => {
    const calls = api();
    calls.startPlan.mockRejectedValueOnce(httpError(409, 'You already have an active plan.'));
    const outcome = await runStartPlan({ planId: '7', planName: 'S', enrollment: null, api: calls, today: 'd' });
    expect(calls.cancelEnrollment).not.toHaveBeenCalled();
    expect(outcome).toEqual({ type: 'toast', message: 'You already have an active plan.' });
  });

  it('stops on a 409 trainer lock with the server message inline', async () => {
    const calls = api();
    calls.cancelEnrollment.mockRejectedValueOnce(httpError(409, 'Your trainer manages this plan.'));
    const outcome = await runStartPlan({ planId: '7', planName: 'S', enrollment: { id: 1 }, api: calls, today: 'd' });
    expect(calls.startPlan).not.toHaveBeenCalled();
    expect(outcome).toEqual({ type: 'inline', message: 'Your trainer manages this plan.' });
  });

  it('shows a 403 enrol inline with the on-hold explanation', async () => {
    const calls = api();
    calls.startPlan.mockRejectedValueOnce(httpError(403, 'You have a trainer.'));
    const outcome = await runStartPlan({ planId: '7', planName: 'S', enrollment: null, api: calls, today: 'd' });
    expect(outcome).toEqual({ type: 'inline', message: `You have a trainer. ${ON_HOLD_TAIL}` });
  });
});

describe('copyErrorMessage (§M5)', () => {
  it('maps 403, 404 and the rest exactly', () => {
    expect(copyErrorMessage(httpError(403, 'Unavailable.'))).toBe(
      'Unavailable. They’re kept safe and come back when coaching ends. Your trainer manages your training for now.'
    );
    expect(copyErrorMessage(httpError(404, 'Not found'))).toBe('This plan can’t be copied.');
    expect(copyErrorMessage(httpError(500, 'Boom'))).toBe('Boom');
    expect(copyErrorMessage(httpError(500))).toBe('Something went wrong. Please try again.');
    expect(
      copyErrorMessage({ response: { status: 422, data: { errors: { plan: ['Plan is archived.'] } } } })
    ).toBe('Plan is archived.');
    expect(copyErrorMessage(new Error('Network Error'))).toBe('Network Error');
  });
});
