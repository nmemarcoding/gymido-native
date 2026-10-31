import { act, create } from 'react-test-renderer';

import CoachingCard from './CoachingCard';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockFontScale }),
}));
jest.mock('../myTrainer/api/myTrainerApi', () => ({ getMyTrainer: jest.fn(() => Promise.resolve(null)), listPendingTrainerRequests: jest.fn(() => Promise.resolve([])) }));
jest.mock('../myTrainer/myTrainerFormat', () => ({ coachingStatus: jest.fn(() => 'No trainer yet') }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ push: () => {}, addListener: () => () => {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockFontScale = 1;
});

// T-170 step 4: the status line is one line up to 1.3, then wraps.
describe('CoachingCard text scale branch', () => {
  describe.each(['pair', 'row'])('layout %s', (layout) => {
    it.each([
      [1, 1],
      [1.15, 1],
      [1.3, 1],
      [1.31, undefined],
      [2, undefined],
    ])('fontScale %s: status numberOfLines = %s', async (scale, lines) => {
      mockFontScale = scale;
      let tree;
      await act(async () => {
        tree = create(<CoachingCard layout={layout} />);
      });
      mounted.push(tree);
      const status = tree.root.findAll((n) => n.type === 'Text' && n.props.children === 'No trainer yet')[0];
      expect(status.props.numberOfLines).toBe(lines);
      expect(status.props.maxFontSizeMultiplier).toBe(2);
    });
  });
});
