jest.mock('../../../shared/api/client', () => ({
  apiClient: { get: jest.fn(), put: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../../../shared/api/client';
import {
  acceptGeneratedPlan,
  getGeneratorProfile,
  previewGeneratedPlan,
  saveGeneratorProfile,
  searchExercises,
} from './generatorApi';

const ok = (data) => Promise.resolve({ data: { data } });

beforeEach(() => jest.clearAllMocks());

test('every call has the exact method, path and body (§G3)', async () => {
  apiClient.get.mockReturnValueOnce(ok({ available: true }));
  await expect(getGeneratorProfile()).resolves.toEqual({ available: true });
  expect(apiClient.get).toHaveBeenCalledWith('/plan-generator/profile');

  apiClient.put.mockReturnValueOnce(ok({}));
  await saveGeneratorProfile({ goal: 'X' });
  expect(apiClient.put).toHaveBeenCalledWith('/plan-generator/profile', { goal: 'X' });

  apiClient.post.mockReturnValueOnce(ok({ feasible: true }));
  await expect(previewGeneratedPlan()).resolves.toEqual({ feasible: true });
  expect(apiClient.post).toHaveBeenLastCalledWith('/plan-generator/preview');

  apiClient.post.mockReturnValueOnce(ok({}));
  const body = { preview_hash: 'h', started_on: '2026-10-23', replace_active_enrollment: false };
  await acceptGeneratedPlan(body);
  expect(apiClient.post).toHaveBeenLastCalledWith('/plan-generator/accept', body);

  apiClient.get.mockReturnValueOnce(ok({ items: [{ id: 1, name: 'Row' }] }));
  await expect(searchExercises('row')).resolves.toEqual([{ id: 1, name: 'Row' }]);
  expect(apiClient.get).toHaveBeenLastCalledWith('/exercises', { params: { search: 'row', per_page: 20 } });
});
