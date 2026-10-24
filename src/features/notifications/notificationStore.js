import { create } from 'zustand';

import { apiClient } from '../../shared/api/client';
import { AuthStatus, useAuthStore } from '../auth/authStore';

// App-shell spec §7.1. `unreadCount` counts only LOADED items without
// `read_at` (⚠S2). Mutation errors set `error`, which nothing displays.

const countUnread = (items) => items.filter((item) => !item.read_at).length;

export async function fetchNotificationsPage(page) {
  const response = await apiClient.get('/notifications', { params: { page, per_page: 10 } });
  return response.data?.data ?? {};
}

const INITIAL = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  hasMore: false,
};

// Bumped on every reset, so a page that arrives after sign-out is dropped.
let session = 0;

export const useNotificationStore = create((set, get) => ({
  ...INITIAL,

  fetchNotifications: async (page = 1) => {
    const fetchSession = session;
    set({ isLoading: true, error: null });
    try {
      const data = await fetchNotificationsPage(page);
      if (fetchSession !== session) {
        return null;
      }
      const items = data.items ?? [];
      const notifications = page === 1 ? items : [...get().notifications, ...items];
      const totalPages = data.total_pages ?? 1;
      set({
        notifications,
        unreadCount: countUnread(notifications),
        currentPage: page,
        totalPages,
        hasMore: page < totalPages,
        isLoading: false,
      });
      return data;
    } catch (error) {
      if (fetchSession === session) {
        set({ error, isLoading: false });
      }
      return null;
    }
  },

  markNotificationAsRead: async (id) => {
    try {
      const response = await apiClient.post(`/notifications/${id}/read`);
      const updated = response.data?.data?.notification ?? {};
      const notifications = get().notifications.map((item) => (item.id === id ? { ...item, ...updated } : item));
      set({ notifications, unreadCount: countUnread(notifications) });
    } catch (error) {
      set({ error });
    }
  },

  // ⚠S11: read_at comes from the device clock, not the server.
  markAllNotificationsAsRead: async () => {
    try {
      await apiClient.post('/notifications/read-all');
      const now = new Date().toISOString();
      const notifications = get().notifications.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at ?? now,
      }));
      set({ notifications, unreadCount: 0 });
    } catch (error) {
      set({ error });
    }
  },

  removeNotification: async (id) => {
    try {
      await apiClient.delete(`/notifications/${id}`);
      const notifications = get().notifications.filter((item) => item.id !== id);
      set({ notifications, unreadCount: countUnread(notifications) });
    } catch (error) {
      set({ error });
    }
  },

  loadMore: () => {
    const { hasMore, isLoading, currentPage, fetchNotifications } = get();
    if (hasMore && !isLoading) {
      fetchNotifications(currentPage + 1);
    }
  },
}));

export function resetNotificationStore() {
  session += 1;
  useNotificationStore.setState({ ...INITIAL });
}

// A new session never sees the last account's notifications.
useAuthStore.subscribe((state, previous) => {
  if (previous.status === AuthStatus.signedIn && state.status !== AuthStatus.signedIn) {
    resetNotificationStore();
  }
});
