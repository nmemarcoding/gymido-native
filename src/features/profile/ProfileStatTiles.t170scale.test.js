import { act, create } from 'react-test-renderer';

import { getDashboard } from '../home/api/homeApi';
import ProfileStatTiles from './ProfileStatTiles';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockFontScale }),
}));
jest.mock('../home/api/homeApi', () => ({ getDashboard: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ push: () => {}, addListener: () => () => {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

const PROFILE = { current_weight_value: 82.5, current_weight_unit: 'kg', goal_weight_value: 78, goal_weight_unit: 'lb' };
const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockFontScale = 1;
});

// T-170 step 4: the stat tiles become label -> value rows past 1.3.
describe('ProfileStatTiles text scale branch', () => {
  it.each([
    [1, false],
    [1.15, false],
    [1.3, false],
    [1.31, true],
    [2, true],
  ])('fontScale %s: stacked rows = %s', async (scale, stacked) => {
    mockFontScale = scale;
    getDashboard.mockResolvedValue({ quick_stats: { completed_workouts_total: 37 } });
    let tree;
    await act(async () => {
      tree = create(<ProfileStatTiles profile={PROFILE} />);
    });
    mounted.push(tree);
    // Stacked rows read label -> value; the columns read value -> label.
    const tile = tree.root.find((n) => n.props.testID === 'profile-stat-workouts' && typeof n.type === 'string');
    const order = tile.findAll((n) => n.type === 'Text').map((n) => [].concat(n.props.children).join(''));
    expect(order).toEqual(stacked ? ['Workouts', '37'] : ['37', 'Workouts']);
    ['now', 'goal'].forEach((id) => {
      expect(tree.root.findAll((n) => n.props.testID === `profile-stat-${id}` && typeof n.type === 'string')).toHaveLength(1);
    });
  });
});
