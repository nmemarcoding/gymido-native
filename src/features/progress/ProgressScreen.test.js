import ProgressScreen from './ProgressScreen';

jest.mock('../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../shell/ShellPage', () => ({ children }) => children);

// No renderer is a declared dependency, so this only proves the screen and
// its imports load; the behaviour lives in progressFormat / progressApi.
it('exports the Progress screen component', () => {
  expect(typeof ProgressScreen).toBe('function');
});
