import { AppState } from 'react-native';

import { mountBell, unmountBell } from './bellPolling';
import { fetchNotificationsPage, useNotificationStore } from './notificationStore';

jest.mock('./notificationStore', () => {
  const fetchNotifications = jest.fn();
  return {
    fetchNotificationsPage: jest.fn(),
    useNotificationStore: { getState: () => ({ fetchNotifications }) },
  };
});
jest.mock('../shell/shellUiStore', () => ({ closePanel: jest.fn() }));

const flush = () => new Promise((resolve) => jest.requireActual('timers').setImmediate(resolve));

describe('bell polling (§7.2)', () => {
  let appStateListener;

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    });
    fetchNotificationsPage.mockReset();
    useNotificationStore.getState().fetchNotifications.mockReset();
  });

  afterEach(() => {
    unmountBell();
    jest.useRealTimers();
  });

  it('fetches, polls now and every 30 s, and refetches only when total changes (⚠S3)', async () => {
    fetchNotificationsPage.mockResolvedValue({ total: 3, items: [] });
    mountBell('full');
    await flush();
    expect(useNotificationStore.getState().fetchNotifications).toHaveBeenCalledTimes(1);
    expect(fetchNotificationsPage).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30000);
    await flush();
    expect(fetchNotificationsPage).toHaveBeenCalledTimes(2);
    expect(useNotificationStore.getState().fetchNotifications).toHaveBeenCalledTimes(1);

    fetchNotificationsPage.mockResolvedValue({ total: 4, items: [] });
    jest.advanceTimersByTime(30000);
    await flush();
    expect(useNotificationStore.getState().fetchNotifications).toHaveBeenCalledTimes(2);
  });

  it('keeps one mount per header variant (⚠S4)', async () => {
    fetchNotificationsPage.mockResolvedValue({ total: 0, items: [] });
    mountBell('full');
    mountBell('full');
    await flush();
    expect(useNotificationStore.getState().fetchNotifications).toHaveBeenCalledTimes(1);
    mountBell('compact');
    await flush();
    expect(useNotificationStore.getState().fetchNotifications).toHaveBeenCalledTimes(2);
  });

  it('pauses in the background and resumes without an extra request', async () => {
    fetchNotificationsPage.mockResolvedValue({ total: 0, items: [] });
    mountBell('full');
    await flush();
    appStateListener('background');
    jest.advanceTimersByTime(90000);
    await flush();
    expect(fetchNotificationsPage).toHaveBeenCalledTimes(1);
    appStateListener('active');
    await flush();
    expect(fetchNotificationsPage).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30000);
    await flush();
    expect(fetchNotificationsPage).toHaveBeenCalledTimes(2);
  });
});
