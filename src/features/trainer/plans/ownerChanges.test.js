import { builderMessage } from '../../../shared/api/apiError';
import { PlanAction, getActionCopy } from './planActions';
import { getNextSetNumber } from './planFormat';
import { TRAINER_PLAN_TEXT, createTrainerPlanAdapter } from './trainerPlanAdapter';

jest.mock('../../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

describe('builderMessage (§A3.7, C4)', () => {
  const notYours = 'Not yours.';

  it('uses the not-yours copy on a 404 only when given', () => {
    const error = { response: { status: 404, data: { message: 'Workout plan not found' } } };
    expect(builderMessage(error, undefined, notYours)).toBe(notYours);
    expect(builderMessage(error)).toBe('Workout plan not found');
  });

  it('names the first field on a 422', () => {
    const error = {
      response: {
        status: 422,
        data: { message: 'Validation failed', errors: { set_number: ['set_number already exists for this exercise'], x: ['y'] } },
      },
    };
    expect(builderMessage(error, undefined, notYours)).toBe('set_number already exists for this exercise');
    expect(builderMessage({ response: { status: 422, data: { errors: { a: [], b: 'plain' } } } })).toBe('plain');
  });

  it('falls back to the server message, then "Please try again."', () => {
    expect(builderMessage({ message: 'Network Error' })).toBe('Network Error');
    expect(builderMessage({})).toBe('Please try again.');
  });
});

describe('getNextSetNumber (C5)', () => {
  it('is the highest set_number + 1, not the count + 1', () => {
    expect(getNextSetNumber([])).toBe(1);
    expect(getNextSetNumber([{ set_number: 1 }, { set_number: 3 }])).toBe(4);
  });
});

describe('trainer adapter (C6)', () => {
  it('counts clients, uses the trainer copy and the ownership probe', () => {
    const adapter = createTrainerPlanAdapter(5);
    expect(adapter.countsClients).toBe(true);
    expect(adapter.text).toBe(TRAINER_PLAN_TEXT);
    expect(adapter.getCapabilities({ isOwnPlan: true }).reorderExercises).toBe(true);
    const navigation = { push: jest.fn() };
    adapter.openBack(navigation);
    adapter.openCreate(navigation);
    expect(navigation.push.mock.calls).toEqual([['TrainerPlans'], ['TrainerPlanCreate']]);
  });

  it('feeds the audience-specific dialog descriptions', () => {
    expect(getActionCopy({ type: PlanAction.deactivatePlan }, TRAINER_PLAN_TEXT).description).toBe(
      TRAINER_PLAN_TEXT.deactivateDescription
    );
    expect(getActionCopy({ type: PlanAction.deactivateRefused }, { refusedDeleteDescription: 'm' }).description).toBe('m');
  });
});

describe('Part C copy', () => {
  const { apiClient } = require('../../../shared/api/client');
  const { canEditPlan } = require('./trainerPlanBuilder');

  it('adds copyPlan outside the edit keys', () => {
    const catalog = createTrainerPlanAdapter(5).getCapabilities({ isOwnPlan: false });
    expect(catalog.copyPlan).toBe(true);
    expect(canEditPlan(catalog)).toBe(false);
  });

  it('posts the plan id as a number and lands on a flagged fresh T3', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { data: { plan: { id: 99 } } } });
    const adapter = createTrainerPlanAdapter('5');
    await expect(adapter.mutations.copyPlan()).resolves.toEqual({ id: 99 });
    expect(apiClient.post).toHaveBeenLastCalledWith('/trainer/plans/copies', { workout_plan_id: 5 });
    const navigation = { push: jest.fn() };
    adapter.openCopy(navigation, 99);
    expect(navigation.push).toHaveBeenCalledWith('TrainerPlan', { planId: 99, nameTheCopy: true });
  });

  it('uses the not-yours copy for a 404', () => {
    expect(builderMessage({ response: { status: 404 } }, undefined, TRAINER_PLAN_TEXT.copyNotYoursCopy)).toBe(
      'This plan can’t be copied.'
    );
  });
});
