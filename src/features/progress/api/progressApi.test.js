import { apiClient } from '../../../shared/api/client';
import { getMissedWeeks, getWeightLogsInRange, loadProgress } from './progressApi';

jest.mock('../../../shared/api/client', () => ({ apiClient: { get: jest.fn() } }));

const ok = (body) => Promise.resolve({ data: { data: body } });

function stub(overrides = {}) {
  const responses = {
    '/weight-progress': () => ok({ current_weight: 80 }),
    '/weight-logs': () => ok({ items: [{ id: 1 }] }),
    '/progress/overview': () => ok({ current_streak: 2 }),
    '/history/workouts': () => ok({ total_workouts: 4 }),
    '/progress/frequency': () => ok({ items: [{ workout_count: 1 }] }),
    '/my-plans/current/missed': () => ok({ count: 1, planned_count: 4 }),
    '/dashboard': () => ok({ recent_workouts: [{ id: 7 }] }),
    '/my-plans/current/week': () => ok({ week: [{ is_workout_day: true }] }),
    ...overrides,
  };
  apiClient.get.mockImplementation((path) => responses[path]());
}

describe('loadProgress (PR1.1)', () => {
  beforeEach(() => apiClient.get.mockReset());

  // v2 Phase 3 (declared): + the three optional calls (#23 / U8 / ND-6).
  it('makes the five v1 calls with the exact params, plus the three optional v2 calls', async () => {
    stub();
    const result = await loadProgress();
    expect(apiClient.get.mock.calls).toEqual([
      ['/weight-progress'],
      ['/weight-logs', { params: { page: 1, per_page: 20, sort: 'desc' } }],
      ['/progress/overview'],
      ['/history/workouts'],
      ['/progress/frequency'],
      ['/my-plans/current/missed', { params: { weeks: 12 } }],
      ['/dashboard'],
      ['/my-plans/current/week'],
    ]);
    expect(result).toEqual({
      weightProgress: { current_weight: 80 },
      weightLogs: [{ id: 1 }],
      overview: { current_streak: 2 },
      history: { total_workouts: 4 },
      frequency: [{ workout_count: 1 }],
      missed: { count: 1, planned_count: 4 },
      recentWorkouts: [{ id: 7 }],
      week: [{ is_workout_day: true }],
    });
  });

  it('the v2 optional calls fail silently into null / [] / null (404 = no plan)', async () => {
    const fail = () => Promise.reject(Object.assign(new Error('Current active plan not found'), { status: 404 }));
    stub({ '/my-plans/current/missed': fail, '/dashboard': fail, '/my-plans/current/week': fail });
    const result = await loadProgress();
    expect(result).toMatchObject({ missed: null, recentWorkouts: [], week: null });
  });

  it('lets the optional calls fail silently', async () => {
    const fail = () => Promise.reject(new Error('nope'));
    stub({ '/progress/overview': fail, '/history/workouts': fail, '/progress/frequency': fail });
    const result = await loadProgress();
    expect(result.overview).toBeNull();
    expect(result.history).toBeNull();
    expect(result.frequency).toEqual([]);
  });

  it('rejects with the transport error of a required call (⚠PR-1)', async () => {
    const error = new Error('Network Error');
    stub({ '/weight-logs': () => Promise.reject(error) });
    await expect(loadProgress()).rejects.toBe(error);
    stub({ '/weight-progress': () => Promise.reject(error) });
    await expect(loadProgress()).rejects.toBe(error);
  });
});

describe('getWeightLogsInRange (N1)', () => {
  beforeEach(() => apiClient.get.mockReset());
  it('pages while page < total_pages, oldest first, 100 per page', async () => {
    apiClient.get
      .mockResolvedValueOnce({ data: { data: { items: [{ id: 1 }], pagination: { total_pages: 2 } } } })
      .mockResolvedValueOnce({ data: { data: { items: [{ id: 2 }], pagination: { total_pages: 2 } } } });
    const logs = await getWeightLogsInRange({ start_date: '2026-07-01', end_date: '2026-10-01' });
    expect(logs).toEqual([{ id: 1 }, { id: 2 }]);
    expect(apiClient.get.mock.calls).toEqual([
      ['/weight-logs', { params: { start_date: '2026-07-01', end_date: '2026-10-01', sort: 'asc', per_page: 100, page: 1 } }],
      ['/weight-logs', { params: { start_date: '2026-07-01', end_date: '2026-10-01', sort: 'asc', per_page: 100, page: 2 } }],
    ]);
  });
  it('getMissedWeeks: a 404 → null', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('404'));
    expect(await getMissedWeeks()).toBeNull();
  });
});
