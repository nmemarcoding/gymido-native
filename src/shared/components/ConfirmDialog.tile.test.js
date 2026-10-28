import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors } from '../theme/tokens';
import ConfirmDialog from './ConfirmDialog';

// T-80 (UX, web parity): the opt-in gold play tile above the confirm's title.
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: 1 }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./BlurLayer', () => () => null);
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Mock = ({ children, ...props }) => <View testID="svg" {...props}>{children}</View>;
  return { __esModule: true, default: Mock, Path: () => null };
});

const mounted = [];
function render(props) {
  let tree;
  act(() => {
    tree = create(<ConfirmDialog isOpen title="Start Lower B instead?" description="Body" confirmLabel="Start workout" tone="primary" hideClose onClose={() => {}} onConfirm={() => {}} {...props} />);
  });
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockWidth = 390;
});
const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const flat = (node) => StyleSheet.flatten(node.props.style);

describe('ConfirmDialog playTile (T-80)', () => {
  it('is opt-in: no tile by default (Discard etc. unchanged)', () => {
    expect(host(render({}), 'app-modal-tile')).toBeUndefined();
  });

  it('phone sheet: 56 r16 gold tint, centred, 20 above the title, a 20 gold play glyph; hidden from screen readers', () => {
    const tree = render({ playTile: true });
    const wrap = host(tree, 'app-modal-tile');
    expect(wrap.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
    expect(flat(wrap)).toMatchObject({ alignSelf: 'center', marginBottom: 20 });
    expect(flat(host(tree, 'confirm-play-tile'))).toMatchObject({ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.goldTint });
    expect(host(tree, 'svg').props).toMatchObject({ width: 20, height: 20, fill: colors.gold });
  });

  it('tablet dialog: 72 r18, left-aligned, a 24 glyph', () => {
    mockWidth = 834;
    const tree = render({ playTile: true });
    expect(flat(host(tree, 'app-modal-tile'))).toMatchObject({ alignSelf: 'flex-start', marginBottom: 20 });
    expect(flat(host(tree, 'confirm-play-tile'))).toMatchObject({ width: 72, height: 72, borderRadius: 18 });
    expect(host(tree, 'svg').props).toMatchObject({ width: 24, height: 24 });
  });
});
