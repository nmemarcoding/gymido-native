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

  it('makes one request per mount: the mount fetch seeds the baseline, the first poll is at +30 s (T-24)', async () => {
    const { fetchNotifications } = useNotificationStore.getState();
    fetchNotifications.mockResolvedValue({ total: 3, items: [] });
    fetchNotificationsPage.mockResolvedValue({ total: 3, items: [] });
    mountBell('full');
    await flush();
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
    expect(fetchNotificationsPage).not.toHaveBeenCalled();

    jest.advanceTimersByTime(30000);
    await flush();
    expect(fetchNotificationsPage).toHaveBeenCalledTimes(1);
    expect(fetchNotifications).toHaveBeenCalledTimes(1);

    // ⚠S3: refetch through the store only when total changes against the baseline.
    fetchNotificationsPage.mockResolvedValue({ total: 4, items: [] });
    jest.advanceTimersByTime(30000);
    await flush();
    expect(fetchNotifications).toHaveBeenCalledTimes(2);
  });

  it('falls back to one immediate poll when the mount fetch fails (T-24)', async () => {
    const { fetchNotifications } = useNotificationStore.getState();
    fetchNotifications.mockResolvedValue(null);
    fetchNotificationsPage.mockResolvedValue({ total: 2, items: [] });
    mountBell('full');
    await flush();
    expect(fetchNotificationsPage).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30000);
    await flush();
    expect(fetchNotificationsPage).toHaveBeenCalledTimes(2);
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
  });

  it('keeps one mount per header variant (⚠S4)', async () => {
    useNotificationStore.getState().fetchNotifications.mockResolvedValue({ total: 0, items: [] });
    mountBell('full');
    mountBell('full');
    await flush();
    expect(useNotificationStore.getState().fetchNotifications).toHaveBeenCalledTimes(1);
    mountBell('compact');
    await flush();
    expect(useNotificationStore.getState().fetchNotifications).toHaveBeenCalledTimes(2);
  });

  it('pauses in the background and resumes without an extra request', async () => {
    useNotificationStore.getState().fetchNotifications.mockResolvedValue({ total: 0, items: [] });
    fetchNotificationsPage.mockResolvedValue({ total: 0, items: [] });
    mountBell('full');
    await flush();
    appStateListener('background');
    jest.advanceTimersByTime(90000);
    await flush();
    expect(fetchNotificationsPage).not.toHaveBeenCalled();
    appStateListener('active');
    await flush();
    expect(fetchNotificationsPage).not.toHaveBeenCalled();
    jest.advanceTimersByTime(30000);
    await flush();
    expect(fetchNotificationsPage).toHaveBeenCalledTimes(1);
  });
});
