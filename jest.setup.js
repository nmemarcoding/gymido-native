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
