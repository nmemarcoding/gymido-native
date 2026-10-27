// Review "untested": the Home week fetch failing. getCurrentWeek never throws: a failure (or a body without a week
// array) is null, so Today hides "Your week" and the rest of the page stays.
jest.mock('../../../shared/api/client', () => ({ apiClient: { get: jest.fn() } }));

import { apiClient } from '../../../shared/api/client';
import { getCurrentWeek } from './homeApi';

describe('getCurrentWeek', () => {
  it('a network or server error → null (no throw)', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Network Error'));
    await expect(getCurrentWeek()).resolves.toBeNull();
    apiClient.get.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(getCurrentWeek()).resolves.toBeNull();
    expect(apiClient.get).toHaveBeenCalledWith('/my-plans/current/week');
  });

  it('no week array → null; a week array comes back as is', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { data: { week: 'nope' } } });
    await expect(getCurrentWeek()).resolves.toBeNull();
    const week = [{ date: '2026-10-26', status: 'done' }];
    apiClient.get.mockResolvedValueOnce({ data: { data: { week } } });
    await expect(getCurrentWeek()).resolves.toEqual(week);
  });
});
