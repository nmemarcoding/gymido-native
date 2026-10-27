import { Modal, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import ConfirmDialog from './ConfirmDialog';
import PillButton from './PillButton';

const ReactNative = require('react-native');

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => 0 }));
jest.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('./BlurLayer', () => () => null);

afterEach(() => jest.restoreAllMocks());

function atWidth(width) {
  jest.spyOn(ReactNative, 'useWindowDimensions', 'get').mockReturnValue(() => ({ width, height: 900, scale: 2, fontScale: 1 }));
}

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const flat = (node) => StyleSheet.flatten(node.props.style);
const host = (tree, testID) => tree.root.findAll((n) => n.props.testID === testID && typeof n.type === 'string')[0];
const button = (tree, testID) => tree.root.findAll((n) => n.type === PillButton && n.props.testID === testID)[0];
const scrimPress = (tree) => tree.root.findAll((n) => n.props.accessibilityLabel === 'Close' && typeof n.props.onPress === 'function')[0].props.onPress();

function dialog(props = {}) {
  return (
    <ConfirmDialog
      testID="confirm"
      isOpen
      onClose={jest.fn()}
      onConfirm={jest.fn()}
      title="Discard this workout?"
      description="Logged sets will be lost."
      confirmLabel="Discard"
      {...props}
    />
  );
}

describe('ConfirmDialog (v2 §6)', () => {
  it('renders the verb and Cancel with the default testIDs and labels', () => {
    const tree = render(dialog());
    expect(button(tree, 'confirm-confirm').props).toMatchObject({ title: 'Discard', variant: 'danger', loading: false });
    expect(button(tree, 'confirm-cancel').props).toMatchObject({ title: 'Cancel', variant: 'secondary' });
  });

  it('phone: a bottom sheet with the verb stacked on top of Cancel', () => {
    atWidth(390);
    const tree = render(dialog());
    expect(host(tree, 'app-modal-grab-handle')).toBeDefined();
    const actions = button(tree, 'confirm-cancel').parent;
    expect(flat(actions)).toMatchObject({ flexDirection: 'column-reverse' });
    // Children stay [Cancel, verb]; column-reverse draws the verb first.
    expect(actions.props.children.map((c) => c.props.testID)).toEqual(['confirm-cancel', 'confirm-confirm']);
  });

  it('tablet: a centred 448 card with Cancel left and the verb right', () => {
    atWidth(1024);
    const tree = render(dialog());
    expect(flat(host(tree, 'confirm')).maxWidth).toBe(448);
    expect(host(tree, 'app-modal-grab-handle')).toBeUndefined();
    expect(flat(button(tree, 'confirm-cancel').parent)).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end' });
  });

  it('primary tone uses the primary variant', () => {
    const tree = render(dialog({ tone: 'primary' }));
    expect(button(tree, 'confirm-confirm').props.variant).toBe('primary');
  });

  it('passes loading to the verb', () => {
    const tree = render(dialog({ loading: true }));
    expect(button(tree, 'confirm-confirm').props.loading).toBe(true);
  });

  it('confirms', () => {
    const onConfirm = jest.fn();
    const tree = render(dialog({ onConfirm }));
    act(() => button(tree, 'confirm-confirm').props.onPress());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Cancel, the scrim and Android back close it when dismissible', () => {
    const onClose = jest.fn();
    const tree = render(dialog({ onClose }));
    act(() => button(tree, 'confirm-cancel').props.onPress());
    act(() => scrimPress(tree));
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('nothing closes it while not dismissible (a request is running)', () => {
    const onClose = jest.fn();
    const tree = render(dialog({ onClose, dismissible: false, loading: true }));
    act(() => button(tree, 'confirm-cancel').props.onPress());
    act(() => scrimPress(tree));
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('takes explicit button testIDs, a custom cancel label and children', () => {
    const tree = render(
      dialog({ cancelTestID: 'keep', confirmTestID: 'go', cancelLabel: 'Keep going', children: <Text testID="extra">Extra</Text> }),
    );
    expect(button(tree, 'keep').props.title).toBe('Keep going');
    expect(button(tree, 'go')).toBeDefined();
    expect(host(tree, 'extra')).toBeDefined();
  });

  it('is hidden when closed', () => {
    const tree = render(dialog({ isOpen: false }));
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
  });
});
