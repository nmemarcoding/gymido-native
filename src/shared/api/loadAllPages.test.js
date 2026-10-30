import { apiClient } from './client';
import { ALL_PAGES_GUARD, loadAllPages } from './loadAllPages';

jest.mock('./client', () => ({ apiClient: { get: jest.fn() } }));

const reply = (items, page, totalPages) => ({ data: { data: { items, pagination: { page, per_page: 100, total_pages: totalPages } } } });

beforeEach(() => jest.clearAllMocks());

describe('loadAllPages (T-121, web 2.1.10)', () => {
  it('one page: one call at per_page 100', async () => {
    apiClient.get.mockResolvedValueOnce(reply([{ id: 1 }], 1, 1));
    await expect(loadAllPages('/plans')).resolves.toEqual([{ id: 1 }]);
    expect(apiClient.get.mock.calls).toEqual([['/plans', { params: { page: 1, per_page: 100 } }]]);
  });

  it('every page in order, extra params kept', async () => {
    apiClient.get.mockResolvedValueOnce(reply([{ id: 1 }], 1, 2)).mockResolvedValueOnce(reply([{ id: 2 }], 2, 2));
    await expect(loadAllPages('/trainer/plans', { q: 'x' })).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(apiClient.get.mock.calls.map((call) => call[1].params)).toEqual([
      { q: 'x', page: 1, per_page: 100 },
      { q: 'x', page: 2, per_page: 100 },
    ]);
  });

  it('no pagination block = one page; missing items = []', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { data: {} } });
    await expect(loadAllPages('/plans')).resolves.toEqual([]);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('more pages than the guard throws (never a partial list); a failed page rejects', async () => {
    apiClient.get.mockImplementation((path, { params }) => Promise.resolve(reply([{ id: params.page }], params.page, 999)));
    await expect(loadAllPages('/plans')).rejects.toThrow('Too many pages to load.');
    expect(apiClient.get).toHaveBeenCalledTimes(ALL_PAGES_GUARD);
    apiClient.get.mockReset();
    apiClient.get.mockResolvedValueOnce(reply([{ id: 1 }], 1, 2)).mockRejectedValueOnce(new Error('down'));
    await expect(loadAllPages('/plans')).rejects.toThrow('down');
  });
});
