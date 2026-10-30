import { apiClient } from './client';

export const ALL_PAGES_PER_PAGE = 100;
export const ALL_PAGES_GUARD = 20;

// T-121 (web 2.1.10 loadAllPages): every page of a paginated list, in order,
// at per_page 100. More than ALL_PAGES_GUARD pages throws, so a caller never
// works from a partial list it believes is complete.
export async function loadAllPages(path, params = {}) {
  const items = [];
  for (let page = 1; page <= ALL_PAGES_GUARD; page += 1) {
    const response = await apiClient.get(path, { params: { ...params, page, per_page: ALL_PAGES_PER_PAGE } });
    const data = response.data?.data ?? {};
    items.push(...(data.items ?? []));
    const totalPages = Number(data.pagination?.total_pages) || 1;
    if (page >= totalPages) {
      return items;
    }
  }
  throw new Error('Too many pages to load.');
}
