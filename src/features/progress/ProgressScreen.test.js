import { act, create } from 'react-test-renderer';

import ProgressScreen from './ProgressScreen';

jest.mock('../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./api/progressApi', () => ({
  loadProgress: jest.fn(() =>
    Promise.resolve({ weightProgress: {}, weightLogs: [], overview: null, history: null, frequency: [] })
  ),
  getWeightLogsInRange: jest.fn(() => Promise.resolve([])),
}));

it('exports the Progress screen component', () => {
  expect(typeof ProgressScreen).toBe('function');
});

// QA 26 Oct 2026: Android's default highQuality break measured "WEIGHT
// HISTORY" narrower than drawn, so it showed as "WEIGHT".
it('Body section titles use the simple Android text break', async () => {
  let tree;
  await act(async () => {
    tree = create(<ProgressScreen />);
  });
  ['Goal progress', 'Weight history'].forEach((title) => {
    const text = tree.root.find((node) => node.type === 'Text' && node.props.children === title);
    expect(text.props.textBreakStrategy).toBe('simple');
  });
  act(() => tree.unmount());
});
