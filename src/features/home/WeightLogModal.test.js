jest.mock('./api/homeApi', () => ({ logWeight: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { act, create } from 'react-test-renderer';

import WeightLogModal from './WeightLogModal';

describe('WeightLogModal (RN-SPEC-home H2)', () => {
  it('"Today\'s weight" has no placeholder (dated 25 Oct 2026, T-16), a decimal keypad and autofocus', () => {
    let tree;
    act(() => {
      tree = create(<WeightLogModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} defaultUnit="kg" />);
    });
    const input = tree.root.find((node) => node.type === 'TextInput' && node.props.testID === 'weight-log-value');
    expect(input.props.placeholder).toBeUndefined();
    expect(input.props.keyboardType).toBe('decimal-pad');
    expect(input.props.autoFocus).toBe(true);
    act(() => tree.unmount());
  });
});
