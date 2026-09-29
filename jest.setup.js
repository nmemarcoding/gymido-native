// Native modules without a JS implementation in Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// auth0Client constructs the SDK at import time; screen tests only need the
// module to load (they never sign in).
jest.mock('react-native-auth0', () => ({
  __esModule: true,
  default: jest.fn(() => ({ webAuth: {}, credentialsManager: {} })),
}));

// Animations jump to their end state by default (the reduce-motion path), so
// screen tests aren't flooded with timer-driven updates. Tests that cover the
// animations themselves switch it off with mockReturnValue(false).
jest.mock('./src/shared/hooks/useReducedMotion', () => ({ useReducedMotion: jest.fn(() => true) }));

// Native audio/notification modules: mocked so tests can assert the rest-alert
// and [O4] background-notification behavior.
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), seekTo: jest.fn(), remove: jest.fn() })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted', granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted', granted: true })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  getPresentedNotificationsAsync: jest.fn(() => Promise.resolve([])),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-screen-orientation', () => ({
  OrientationLock: { PORTRAIT_UP: 2 },
  lockAsync: jest.fn(() => Promise.resolve()),
  unlockAsync: jest.fn(() => Promise.resolve()),
}));
