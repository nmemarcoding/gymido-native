import * as Notifications from 'expo-notifications';

import restAlertPlatform from '../workout/runtime/restAlertPlatform';
import { addReminderTapListener, deleteReminderChannel, initReminderChannel, lastReminderTap, reminderPlatform } from './reminderPlatform';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  deleteNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied', canAskAgain: true })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../workout/runtime/restAlertPlatform', () => ({ __esModule: true, default: { getPermission: jest.fn(), schedule: jest.fn() } }));
jest.mock('../myPlans/api/myPlansApi', () => ({ getCurrentPlan: jest.fn() }));
jest.mock('../workout/api/workoutApi', () => ({ listCompletedWorkouts: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('T-103 reminder platform', () => {
  test('Android: the "Workout reminders" channel (UX ruling §2), default importance, no badge', () => {
    initReminderChannel('android');
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('workout-reminders', {
      name: 'Workout reminders',
      description: 'Reminders on your training days',
      importance: 3,
      showBadge: false,
    });
  });

  test('deleteReminderChannel: Android removes the channel (trainer accounts, review L3); iOS does nothing', () => {
    deleteReminderChannel('ios');
    expect(Notifications.deleteNotificationChannelAsync).not.toHaveBeenCalled();
    deleteReminderChannel('android');
    expect(Notifications.deleteNotificationChannelAsync).toHaveBeenCalledWith('workout-reminders');
  });

  test('iOS: no channel', () => {
    initReminderChannel('ios');
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  test('shares the rest alerts\' primitives; canAskAgain reads the OS', async () => {
    expect(reminderPlatform.schedule).toBe(restAlertPlatform.schedule);
    await expect(reminderPlatform.canAskAgain()).resolves.toBe(true);
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied', canAskAgain: false });
    await expect(reminderPlatform.canAskAgain()).resolves.toBe(false);
  });

  test('tap listener and the launching tap', async () => {
    const listener = jest.fn();
    const remove = addReminderTapListener(listener);
    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(listener);
    remove();
    expect(Notifications.addNotificationResponseReceivedListener.mock.results[0].value.remove).toHaveBeenCalled();
    await expect(lastReminderTap()).resolves.toBeNull();
    Notifications.getLastNotificationResponseAsync.mockRejectedValueOnce(new Error('x'));
    await expect(lastReminderTap()).resolves.toBeNull();
  });
});
