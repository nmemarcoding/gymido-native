import { StyleSheet, Text } from 'react-native';
import { act, create as createRenderer } from 'react-test-renderer';

import StateSlot, { STATE_COLUMN_MAX, STATE_LOADER_PADDING } from './StateSlot';

// RN-SPEC-v2-phase2 §D1 placement: whole-page states in the content column,
// centred, max 640, in the page flow under the header.
function create(element) {
  let tree;
  act(() => {
    tree = createRenderer(element);
  });
  return tree;
}
const slotStyle = (tree) => StyleSheet.flatten(tree.root.find((node) => node.type === 'View').props.style);

describe('StateSlot', () => {
  it('centres its card at max 640 and full width below that (phone and tablet)', () => {
    const tree = create(
      <StateSlot>
        <Text>card</Text>
      </StateSlot>,
    );
    expect(STATE_COLUMN_MAX).toBe(640);
    expect(slotStyle(tree)).toEqual({ width: '100%', maxWidth: 640, alignSelf: 'center' });
    expect(tree.root.findByType(Text).props.children).toBe('card');
  });

  it('never centres vertically (no flex fill, no justifyContent): it sits under the header', () => {
    const style = slotStyle(create(<StateSlot />));
    expect(style.flex).toBeUndefined();
    expect(style.justifyContent).toBeUndefined();
  });

  it('`loader` adds the page Loader padding (48 above and below)', () => {
    const tree = create(<StateSlot loader />);
    expect(STATE_LOADER_PADDING).toBe(48);
    expect(slotStyle(tree)).toEqual(expect.objectContaining({ paddingVertical: 48, maxWidth: 640 }));
  });

  it('takes a testID and an extra layout style', () => {
    const tree = create(<StateSlot testID="page-state" style={{ gap: 12 }} />);
    const view = tree.root.find((node) => node.type === 'View');
    expect(view.props.testID).toBe('page-state');
    expect(StyleSheet.flatten(view.props.style)).toEqual(expect.objectContaining({ gap: 12, maxWidth: 640 }));
  });
});
