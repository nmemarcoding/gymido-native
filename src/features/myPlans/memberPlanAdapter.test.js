import { apiClient } from '../../shared/api/client';
import { cancelEnrollment, copyToMyPlans, createMyPlan, getMyPlan, isGeneratorAvailable, listMyPlans, startPlan } from './api/myPlansApi';
import { MEMBER_PLAN_TEXT, createMemberPlanAdapter } from './memberPlanAdapter';
import { MEMBER_CREATE_VARIANT } from './MyPlanCreateScreen';

jest.mock('../../shared/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../trainer/plans/screens/CreatePlanScreen', () => ({ CreatePlanForm: () => null }));

const ok = (data) => ({ data: { data } });

beforeEach(() => jest.clearAllMocks());

describe('member adapter (§M3.1)', () => {
  const adapter = createMemberPlanAdapter('9');

  it('is always own, every T3 key on, no copy, enrol on, no client count', async () => {
    await expect(adapter.probeOwnership()).resolves.toBe(true);
    const capabilities = adapter.getCapabilities({ isOwnPlan: false });
    const { copyPlan, enrol, ...t3 } = capabilities;
    expect(copyPlan).toBe(false);
    expect(enrol).toBe(true);
    expect(Object.keys(t3)).toHaveLength(11);
    expect(Object.values(t3).every(Boolean)).toBe(true);
    expect(adapter.countsClients).toBe(false);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('loads the header from /my-custom-plans/{id}', async () => {
    apiClient.get.mockResolvedValueOnce(ok({ plan: { id: 9, name: 'Mine' } }));
    await expect(adapter.loadHeader()).resolves.toEqual({ id: 9, name: 'Mine' });
    expect(apiClient.get).toHaveBeenCalledWith('/my-custom-plans/9');
  });

  it('writes to /my-custom-plans/{id}/… with the §M6 keys', async () => {
    const { mutations } = adapter;
    apiClient.post.mockResolvedValueOnce(ok({ plan_day: { id: 1 } }));
    await expect(mutations.addDay({ day_number: 1, title: 'A', description: '' })).resolves.toEqual({ id: 1 });
    expect(apiClient.post).toHaveBeenLastCalledWith('/my-custom-plans/9/days', { day_number: 1, title: 'A', description: '' });

    apiClient.put.mockResolvedValueOnce(ok({ day: { id: 1 } }));
    await expect(mutations.updateDay(1, {})).resolves.toEqual({ id: 1 });
    expect(apiClient.put).toHaveBeenLastCalledWith('/my-custom-plans/9/days/1', {});

    apiClient.delete.mockResolvedValueOnce(ok({ day: { id: 1 } }));
    await expect(mutations.deleteDay(1)).resolves.toEqual({ id: 1 });
    expect(apiClient.delete).toHaveBeenLastCalledWith('/my-custom-plans/9/days/1');

    apiClient.patch.mockResolvedValueOnce(ok({ plan: { id: 9 } }));
    await mutations.updatePlan({ is_active: false });
    expect(apiClient.patch).toHaveBeenLastCalledWith('/my-custom-plans/9', { is_active: false });

    apiClient.post.mockResolvedValueOnce(ok({ items: [] }));
    await mutations.reorderExercises(1, [3, 2]);
    expect(apiClient.post).toHaveBeenLastCalledWith('/my-custom-plans/9/days/1/exercises/reorder', { order: [3, 2] });

    apiClient.post.mockResolvedValueOnce(ok({ plan_day_exercise_set: { id: 5 }, target_set_summary: {} }));
    await mutations.addSet(1, 2, {});
    expect(apiClient.post).toHaveBeenLastCalledWith('/my-custom-plans/9/days/1/exercises/2/sets', {});
  });

  it('carries the member texts (§M3.2)', () => {
    expect(adapter.text).toBe(MEMBER_PLAN_TEXT);
    expect(MEMBER_PLAN_TEXT.eyebrowOwn).toBe('My plan');
    expect(MEMBER_PLAN_TEXT.backLabel).toBe('← My plans');
    expect(MEMBER_PLAN_TEXT.notFoundMessage).toBe('This plan isn’t one of yours.');
    expect(MEMBER_PLAN_TEXT.notYoursCopy).toBe('This plan is no longer available.');
  });

  it('goes back and after delete to M1, and takes the UI pieces it is given', () => {
    const navigation = { push: jest.fn() };
    adapter.openBack(navigation);
    adapter.openAfterDelete(navigation);
    expect(navigation.push.mock.calls).toEqual([['MyPlans'], ['MyPlans']]);
    const renderOnHold = () => null;
    const useExtension = () => ({});
    const withUi = createMemberPlanAdapter('9', { renderOnHold, useExtension });
    expect(withUi.renderOnHold).toBe(renderOnHold);
    expect(withUi.useExtension).toBe(useExtension);
  });
});

describe('My plans API (§M6)', () => {
  it('lists a page of 20 and normalises the pagination', async () => {
    apiClient.get.mockResolvedValueOnce(
      ok({ items: [{ id: 1 }], pagination: { page: 2, total_pages: 3, total: 41, per_page: 20 } })
    );
    await expect(listMyPlans(2)).resolves.toEqual({
      items: [{ id: 1 }],
      currentPage: 2,
      totalPages: 3,
      totalRecords: 41,
      perPage: 20,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/my-custom-plans', { params: { page: 2, per_page: 20 } });
  });

  it('creates, copies, reads, cancels and enrols on the exact paths', async () => {
    apiClient.post.mockResolvedValue(ok({ plan: { id: 3 }, enrollment: { id: 8 } }));
    apiClient.get.mockResolvedValue(ok({ plan: { id: 3 } }));
    await createMyPlan({ name: 'A' });
    expect(apiClient.post).toHaveBeenLastCalledWith('/my-custom-plans', { name: 'A' });
    await copyToMyPlans('12');
    expect(apiClient.post).toHaveBeenLastCalledWith('/my-custom-plans/copies', { workout_plan_id: 12 });
    await getMyPlan('3');
    expect(apiClient.get).toHaveBeenLastCalledWith('/my-custom-plans/3');
    await cancelEnrollment(8);
    expect(apiClient.post).toHaveBeenLastCalledWith('/my-plans/8/cancel');
    await startPlan('3', '2026-10-23');
    expect(apiClient.post).toHaveBeenLastCalledWith('/my-plans', { workout_plan_id: 3, started_on: '2026-10-23' });
  });

  it('shows the generator only on available === true', async () => {
    apiClient.get.mockResolvedValueOnce(ok({ available: true }));
    await expect(isGeneratorAvailable()).resolves.toBe(true);
    apiClient.get.mockResolvedValueOnce(ok({ available: false }));
    await expect(isGeneratorAvailable()).resolves.toBe(false);
    apiClient.get.mockRejectedValueOnce({ response: { status: 403 } });
    await expect(isGeneratorAvailable()).resolves.toBe(false);
    expect(apiClient.get).toHaveBeenLastCalledWith('/plan-generator/profile');
  });
});

describe('M2 create variant (§M2)', () => {
  it('hides the slug and sends a suffixed member slug to /my-custom-plans', async () => {
    expect(MEMBER_CREATE_VARIANT.showSlug).toBe(false);
    expect(MEMBER_CREATE_VARIANT.subtitle).toBe('Private to you. Build it out, then start it.');
    expect(MEMBER_CREATE_VARIANT.namePlaceholder).toBe('My strength plan');
    expect(MEMBER_CREATE_VARIANT.backLabel).toBe('← My plans');
    expect(MEMBER_CREATE_VARIANT.planRoute).toBe('MyPlan');
    apiClient.post.mockResolvedValueOnce(ok({ plan: { id: 4 } }));
    const plan = await MEMBER_CREATE_VARIANT.create({
      name: ' My Strength Plan! ',
      slug: '',
      categoryId: '2',
      daysPerWeek: '3',
      difficultyLevelId: '',
      description: '',
    });
    expect(plan).toEqual({ id: 4 });
    const [path, body] = apiClient.post.mock.calls[0];
    expect(path).toBe('/my-custom-plans');
    expect(body.slug).toMatch(/^my-strength-plan-[a-z]{6}$/);
    expect(body).toMatchObject({ name: 'My Strength Plan!', category_id: 2, days_per_week: 3, is_active: true });
  });
});
