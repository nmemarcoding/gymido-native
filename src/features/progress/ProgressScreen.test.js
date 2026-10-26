import { StyleSheet } from 'react-native';
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
}));

it('exports the Progress screen component', () => {
  expect(typeof ProgressScreen).toBe('function');
});

// QA 26 Oct 2026: Android measures text before textTransform, so the caps
// wrapped out of the line box ("WEIGHT" for "WEIGHT HISTORY"). The section
// titles carry the caps in the text itself.
it('writes the Body section titles in caps, with no textTransform', async () => {
  let tree;
  await act(async () => {
    tree = create(<ProgressScreen />);
  });
  const titles = ['GOAL PROGRESS', 'WEIGHT HISTORY'].map((title) =>
    tree.root.find((node) => node.type === 'Text' && node.props.children === title)
  );
  titles.forEach((title) => expect(StyleSheet.flatten(title.props.style).textTransform).toBeUndefined());
  act(() => tree.unmount());
});
