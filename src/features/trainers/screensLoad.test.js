// Import smoke test: every new screen module resolves and exports a component.
jest.mock('../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../shell/ShellPage', () => 'ShellPage');

describe('new screens load', () => {
  it.each([
    ['./screens/TrainersScreen'],
    ['./screens/TrainerDetailScreen'],
    ['./screens/TrainerApplyScreen'],
    ['../notifications/NotificationsScreen'],
    ['../notifications/NotificationPanel'],
  ])('%s', (path) => {
    expect(typeof require(path).default).toBe('function');
  });
});
