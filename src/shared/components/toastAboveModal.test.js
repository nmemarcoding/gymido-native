// QA BUG-N4: after a successful invite the "Invitation sent" toast was never
// visible — React Native draws <Modal> in its own window, so the app-level
// ToastHost sat UNDER the invite sheet. App-shell spec §8: toasts sit above
// everything. While a modal is open, the topmost modal hosts the toast stack
// inside its own window and the app-level host steps aside (no duplicate,
// no double announcement).
import { AccessibilityInfo, Animated, Modal, Platform, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import AppModal from './AppModal';
import ToastHost from './ToastHost';
import { ToastTone, addToast, useToastStore } from './toastStore';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./BlurLayer', () => () => null);

const mounted = [];
beforeEach(() => {
  act(() => useToastStore.setState({ toasts: [] }));
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

const toastTexts = (node) => node.findAll((n) => n.type === Text && n.props.children === 'Invitation sent');

function app(open, second = false) {
  return (
    <>
      <AppModal isOpen={open} onClose={() => {}} title="Invite a client" testID="m1">
        <Text>sheet</Text>
      </AppModal>
      <AppModal isOpen={second} onClose={() => {}} title="Second" testID="m2">
        <Text>second</Text>
      </AppModal>
      <ToastHost />
    </>
  );
}

describe('toasts above an open sheet (BUG-N4)', () => {
  it('no modal open: the app-level host shows the toast', () => {
    let tree;
    act(() => {
      tree = create(app(false));
    });
    mounted.push(tree);
    act(() => addToast(ToastTone.success, 'Invitation sent', 'client can accept or decline it.'));
    expect(toastTexts(tree.root)).toHaveLength(1);
    expect(tree.root.findAllByType(Modal).some((m) => m.props.visible && toastTexts(m).length > 0)).toBe(false);
  });

  it('a sheet open: the toast renders INSIDE the sheet\'s Modal, exactly once', () => {
    let tree;
    act(() => {
      tree = create(app(true));
    });
    mounted.push(tree);
    act(() => addToast(ToastTone.success, 'Invitation sent', 'client can accept or decline it.'));
    const open = tree.root.findAllByType(Modal).find((m) => m.props.visible);
    expect(toastTexts(open)).toHaveLength(1);
    expect(toastTexts(tree.root)).toHaveLength(1);
  });

  it('two sheets open: only the topmost (last opened) hosts it', () => {
    let tree;
    act(() => {
      tree = create(app(true));
    });
    mounted.push(tree);
    act(() => tree.update(app(true, true)));
    act(() => addToast(ToastTone.success, 'Invitation sent', ''));
    const [first, second] = tree.root.findAllByType(Modal);
    expect(toastTexts(second)).toHaveLength(1);
    expect(toastTexts(first)).toHaveLength(0);
    expect(toastTexts(tree.root)).toHaveLength(1);
  });

  it('the sheet closes: the toast moves back to the app-level host', () => {
    let tree;
    act(() => {
      tree = create(app(true));
    });
    mounted.push(tree);
    act(() => addToast(ToastTone.success, 'Invitation sent', ''));
    act(() => tree.update(app(false)));
    expect(toastTexts(tree.root)).toHaveLength(1);
    expect(tree.root.findAllByType(Modal).some((m) => m.props.visible)).toBe(false);
  });
});

// Review db5ff79 LOW: a toast that MOVES between hosts (the sheet closes while
// it shows) must not replay its entrance or be announced twice on iOS.
describe('a toast moving between hosts is silent (review LOW)', () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Platform.OS = realOS;
    jest.restoreAllMocks();
  });

  it('iOS: announced once and the entrance plays once across the move', () => {
    Platform.OS = 'ios';
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    // RN's jest setup already mocks this; clear calls from earlier tests.
    announce.mockClear();
    let tree;
    act(() => {
      tree = create(app(true));
    });
    mounted.push(tree);
    const timing = jest.spyOn(Animated, 'timing');
    act(() => addToast(ToastTone.success, 'Invitation sent', 'client can accept or decline it.'));
    const entrances = timing.mock.calls.length;
    const toastAnnouncements = () => announce.mock.calls.filter(([text]) => String(text).includes('Invitation sent')).length;
    expect(toastAnnouncements()).toBe(1);
    act(() => tree.update(app(false)));
    expect(toastTexts(tree.root)).toHaveLength(1);
    expect(toastAnnouncements()).toBe(1);
    expect(timing.mock.calls.length).toBe(entrances);
  });
});

