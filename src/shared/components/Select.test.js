import { Keyboard } from 'react-native';
import { act, create } from 'react-test-renderer';

import Select from './Select';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-picker/picker', () => {
  const Picker = ({ children }) => children ?? null;
  Picker.Item = () => null;
  return { Picker };
});

describe('Select', () => {
  it('closes the keyboard when it opens, like a browser <select> taking focus (#17)', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    let tree;
    act(() => {
      tree = create(<Select testID="unit" accessibilityLabel="Unit" value="lb" options={[{ value: 'lb', label: 'lb' }]} onChange={() => {}} />);
    });
    const opener = tree.root.findAll((node) => node.props.testID === 'unit' && typeof node.props.onPress === 'function')[0];
    act(() => opener.props.onPress());
    expect(dismiss).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    dismiss.mockRestore();
  });
});
