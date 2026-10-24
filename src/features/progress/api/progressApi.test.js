import { apiClient } from '../../../shared/api/client';
import { loadProgress } from './progressApi';

jest.mock('../../../shared/api/client', () => ({ apiClient: { get: jest.fn() } }));

const ok = (body) => Promise.resolve({ data: { data: body } });

function stub(overrides = {}) {
  const responses = {
    '/weight-progress': () => ok({ current_weight: 80 }),
    '/weight-logs': () => ok({ items: [{ id: 1 }] }),
    '/progress/overview': () => ok({ current_streak: 2 }),
    '/history/workouts': () => ok({ total_workouts: 4 }),
    '/progress/frequency': () => ok({ items: [{ workout_count: 1 }] }),
    ...overrides,
  };
  apiClient.get.mockImplementation((path) => responses[path]());
}

describe('loadProgress (PR1.1)', () => {
  beforeEach(() => apiClient.get.mockReset());

  it('makes the five calls with the exact params', async () => {
    stub();
    const result = await loadProgress();
    expect(apiClient.get.mock.calls).toEqual([
      ['/weight-progress'],
      ['/weight-logs', { params: { page: 1, per_page: 20, sort: 'desc' } }],
      ['/progress/overview'],
      ['/history/workouts'],
      ['/progress/frequency'],
    ]);
    expect(result).toEqual({
      weightProgress: { current_weight: 80 },
      weightLogs: [{ id: 1 }],
      overview: { current_streak: 2 },
      history: { total_workouts: 4 },
      frequency: [{ workout_count: 1 }],
    });
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
