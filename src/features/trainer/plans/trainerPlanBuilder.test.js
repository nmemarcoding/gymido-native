import { apiClient } from '../../../shared/api/client';
import { probeIsOwnPlan } from './api/plansApi';
import { loadExerciseCatalog } from './loadExerciseCatalog';
import { canEditPlan, createTrainerPlanMutations, getTrainerPlanCapabilities } from './trainerPlanBuilder';

jest.mock('../../../shared/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

describe('getTrainerPlanCapabilities', () => {
  it('turns every key on for an own plan and off for a catalog plan', () => {
    const own = getTrainerPlanCapabilities({ isOwnPlan: true });
    const catalog = getTrainerPlanCapabilities({ isOwnPlan: false });
    expect(Object.keys(own)).toHaveLength(11);
    expect(Object.values(own).every(Boolean)).toBe(true);
    expect(Object.values(catalog).some(Boolean)).toBe(false);
    expect(canEditPlan(own)).toBe(true);
    expect(canEditPlan(catalog)).toBe(false);
  });

  it('ignores the add keys when deciding canEdit', () => {
    expect(canEditPlan({ addDay: true, addExercise: true, addSet: true })).toBe(false);
  });
});

describe('probeIsOwnPlan', () => {
  it('is own only on a 404', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { data: {} } });
    await expect(probeIsOwnPlan(5)).resolves.toBe(false);
    apiClient.get.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(probeIsOwnPlan(5)).resolves.toBe(true);
    // ⚠T3-1: any other failure shows the catalog view.
    apiClient.get.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(probeIsOwnPlan(5)).resolves.toBe(false);
    apiClient.get.mockRejectedValueOnce(new Error('Network Error'));
    await expect(probeIsOwnPlan(5)).resolves.toBe(false);
    expect(apiClient.get).toHaveBeenLastCalledWith('/plans/5');
  });
});

describe('createTrainerPlanMutations', () => {
  it('posts to the trainer routes and reads the confirmed keys', async () => {
    const mutations = createTrainerPlanMutations(9);
    apiClient.post.mockResolvedValueOnce({ data: { data: { plan_day: { id: 31 } } } });
    await expect(mutations.addDay({ day_number: 1, title: 'A', description: '' })).resolves.toEqual({ id: 31 });
    expect(apiClient.post).toHaveBeenLastCalledWith('/trainer/plans/9/days', { day_number: 1, title: 'A', description: '' });

    apiClient.post.mockResolvedValueOnce({ data: { data: { plan_day_exercise: { id: 4 } } } });
    await mutations.addExercise(31, { exercise_id: 2, order_index: 1, notes: '' });
    expect(apiClient.post).toHaveBeenLastCalledWith('/trainer/plans/9/days/31/exercises', {
      exercise_id: 2,
      order_index: 1,
      notes: '',
    });

    apiClient.post.mockResolvedValueOnce({ data: { data: { plan_day_exercise_set: { id: 8 }, target_set_summary: {} } } });
    await expect(mutations.addSet(31, 4, { set_number: 1 })).resolves.toEqual({ set: { id: 8 }, targetSetSummary: {} });
    expect(apiClient.post).toHaveBeenLastCalledWith('/trainer/plans/9/days/31/exercises/4/sets', { set_number: 1 });
  });
});

describe('loadExerciseCatalog', () => {
  const page = (ids, totalPages) => ({ items: ids.map((id) => ({ id })), totalPages });

  it('pages until total_pages', async () => {
    const fetchPage = jest.fn().mockResolvedValueOnce(page([1, 2], 2)).mockResolvedValueOnce(page([3], 2));
    await expect(loadExerciseCatalog(fetchPage)).resolves.toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('keeps what it has on a failure (⚠T5-1)', async () => {
    const fetchPage = jest.fn().mockResolvedValueOnce(page([1], 3)).mockRejectedValueOnce(new Error('boom'));
    await expect(loadExerciseCatalog(fetchPage)).resolves.toEqual([{ id: 1 }]);
    await expect(loadExerciseCatalog(jest.fn().mockRejectedValue(new Error('x')))).resolves.toEqual([]);
  });

  it('stops on a short page when there is no page count', async () => {
    const fetchPage = jest.fn().mockResolvedValueOnce(page([1], undefined));
    await expect(loadExerciseCatalog(fetchPage)).resolves.toEqual([{ id: 1 }]);
  });
});

describe('Part B mutations', () => {
  it('uses the edit routes and reads the confirmed keys', async () => {
    const mutations = createTrainerPlanMutations(9);
    apiClient.get.mockResolvedValueOnce({ data: { data: { active_client_count: 'x' } } });
    await expect(mutations.affectedClientCount()).resolves.toBe(0);
    expect(apiClient.get).toHaveBeenLastCalledWith('/trainer/plans/9/affected-clients');

    apiClient.put = jest.fn().mockResolvedValueOnce({ data: { data: { day: { id: 3 } } } });
    await expect(mutations.updateDay(3, { day_number: 1, title: 'A', description: '' })).resolves.toEqual({ id: 3 });
    expect(apiClient.put).toHaveBeenLastCalledWith('/trainer/plans/9/days/3', { day_number: 1, title: 'A', description: '' });

    apiClient.post.mockResolvedValueOnce({ data: { data: { items: [{ id: 5, order_index: 1 }] } } });
    await expect(mutations.reorderExercises(3, [5])).resolves.toEqual([{ id: 5, order_index: 1 }]);
    expect(apiClient.post).toHaveBeenLastCalledWith('/trainer/plans/9/days/3/exercises/reorder', { order: [5] });

    apiClient.patch = jest.fn().mockResolvedValueOnce({ data: { data: { plan: { id: 9, is_active: false } } } });
    await mutations.updatePlan({ is_active: false });
    expect(apiClient.patch).toHaveBeenLastCalledWith('/trainer/plans/9', { is_active: false });

    apiClient.delete = jest.fn().mockResolvedValue({ data: { data: {} } });
    await mutations.deleteSet(3, 5, 8);
    expect(apiClient.delete).toHaveBeenLastCalledWith('/trainer/plans/9/days/3/exercises/5/sets/8');
  });
});
