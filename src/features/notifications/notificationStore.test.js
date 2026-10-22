import { apiClient } from '../../shared/api/client';
import { useNotificationStore } from './notificationStore';

jest.mock('../../shared/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

const page = (items, totalPages) => ({ data: { data: { items, total_pages: totalPages, total: items.length } } });
const initial = useNotificationStore.getState();

beforeEach(() => {
  useNotificationStore.setState(initial, true);
  jest.clearAllMocks();
});

describe('notificationStore (§7.1)', () => {
  it('replaces on page 1, appends after, and counts only loaded unread items (⚠S2)', async () => {
    apiClient.get.mockResolvedValueOnce(page([{ id: 1 }, { id: 2, read_at: 'x' }], 2));
    await useNotificationStore.getState().fetchNotifications();
    expect(apiClient.get).toHaveBeenLastCalledWith('/notifications', { params: { page: 1, per_page: 10 } });
    expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 1, hasMore: true, currentPage: 1 });

    apiClient.get.mockResolvedValueOnce(page([{ id: 3 }], 2));
    useNotificationStore.getState().loadMore();
    await new Promise((resolve) => setImmediate(resolve));
    expect(useNotificationStore.getState().notifications.map((n) => n.id)).toEqual([1, 2, 3]);
    expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 2, hasMore: false });
  });

  it('returns null and sets error on a failed fetch', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('x'));
    await expect(useNotificationStore.getState().fetchNotifications()).resolves.toBeNull();
    expect(useNotificationStore.getState().error).toBeTruthy();
  });

  it('marks all read with device time, keeping existing read_at (⚠S11)', async () => {
    useNotificationStore.setState({ notifications: [{ id: 1 }, { id: 2, read_at: 'old' }], unreadCount: 1 });
    apiClient.post.mockResolvedValueOnce({ data: { data: { updated_count: 1 } } });
    await useNotificationStore.getState().markAllNotificationsAsRead();
    const [first, second] = useNotificationStore.getState().notifications;
    expect(first.read_at).toEqual(expect.any(String));
    expect(second.read_at).toBe('old');
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('merges a read item and removes a deleted one', async () => {
    useNotificationStore.setState({ notifications: [{ id: 1 }, { id: 2 }], unreadCount: 2 });
    apiClient.post.mockResolvedValueOnce({ data: { data: { notification: { id: 1, read_at: 't' } } } });
    await useNotificationStore.getState().markNotificationAsRead(1);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
    apiClient.delete.mockResolvedValueOnce({ data: { data: {} } });
    await useNotificationStore.getState().removeNotification(2);
    expect(useNotificationStore.getState().notifications).toEqual([{ id: 1, read_at: 't' }]);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('leaves the list unchanged when a mutation fails', async () => {
    useNotificationStore.setState({ notifications: [{ id: 1 }], unreadCount: 1 });
    apiClient.delete.mockRejectedValueOnce(new Error('x'));
    await useNotificationStore.getState().removeNotification(1);
    expect(useNotificationStore.getState().notifications).toEqual([{ id: 1 }]);
  });
});
