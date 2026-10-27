const ReactNative = require('react-native');
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { ModalActions } from './AppModal';
import PillButton from './PillButton';
import ChangePasswordModal from '../../features/profile/ChangePasswordModal';
import { markResetEmailSent } from '../../features/profile/passwordReset';
import InviteClientModal from '../../features/trainer/clients/components/InviteClientModal';
import WeightHistoryModal from '../../features/trainer/clients/components/WeightHistoryModal';
import WorkoutDetailModal from '../../features/trainer/clients/components/WorkoutDetailModal';

// Kit 2: the caller dialogs' footers use ModalActions, so past 1.3× text the
// tablet row stacks (primary on top, full width; UX §9 rule 4).

jest.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => 0 }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./BlurLayer', () => () => null);
jest.mock('../../features/profile/api/profileApi', () => ({ sendPasswordResetEmail: jest.fn(() => new Promise(() => {})) }));
jest.mock('../../features/trainer/clients/api/clientsApi', () => ({
  searchMembers: jest.fn(() => new Promise(() => {})),
  inviteClient: jest.fn(() => new Promise(() => {})),
  listClientWeightLogs: jest.fn(() => new Promise(() => {})),
  getClientWorkout: jest.fn(() => new Promise(() => {})),
}));
jest.mock('./toastStore', () => ({ ...jest.requireActual('./toastStore'), addToast: jest.fn(), ToastTone: { success: 'success', error: 'error' } }));

const PHONE = 390;
const TABLET = 1024;

function atWindow(width, fontScale) {
  jest.spyOn(ReactNative, 'useWindowDimensions', 'get').mockReturnValue(() => ({ width, height: 900, scale: 2, fontScale }));
}
afterEach(() => jest.restoreAllMocks());

const mounted = [];
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
});

const flat = (node) => StyleSheet.flatten(node.props.style);
const actionsOf = (tree) => tree.root.findByType(ModalActions);
// The host View ModalActions draws (row or stacked column).
const actionsLayout = (tree) => flat(actionsOf(tree).findAll((n) => typeof n.type === 'string')[0]);
const fillCells = (tree) => tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'modal-actions-fill');
const buttonIds = (tree) => actionsOf(tree).findAllByType(PillButton).map((b) => b.props.testID);

const CASES = [
  ['ChangePasswordModal', () => <ChangePasswordModal visible onClose={jest.fn()} email="a@b.co" />, ['change-password-cancel', 'change-password-submit'], true],
  ['InviteClientModal', () => <InviteClientModal isOpen onClose={jest.fn()} onInvited={jest.fn()} />, ['invite-done'], true],
  ['WeightHistoryModal', () => <WeightHistoryModal isOpen clientUserId={7} profile={null} onClose={jest.fn()} />, ['weight-history-close'], false],
  ['WorkoutDetailModal', () => <WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} />, ['workout-detail-close'], false],
];

describe.each(CASES)('%s footer → ModalActions', (_name, element, ids, fill) => {
  it('phone at 1×: stacked column, the verb on top (column-reverse)', () => {
    atWindow(PHONE, 1);
    const tree = render(element());
    expect(buttonIds(tree)).toEqual(ids);
    expect(actionsLayout(tree)).toEqual({ flexDirection: 'column-reverse', gap: 8 });
    expect(fillCells(tree)).toHaveLength(0);
  });

  it(`tablet at 1×: the row at the right${fill ? ', each action sharing the width' : ''}`, () => {
    atWindow(TABLET, 1);
    const tree = render(element());
    expect(actionsOf(tree).props.fill ?? false).toBe(fill);
    expect(fillCells(tree)).toHaveLength(fill ? ids.length : 0);
  });

  it.each([2, 3.1])('tablet at %f×: the row stacks (primary on top, full width)', (fontScale) => {
    atWindow(TABLET, fontScale);
    const tree = render(element());
    expect(fillCells(tree)).toHaveLength(0);
    const column = tree.root.findAll((n) => typeof n.type === 'string' && flat(n)?.flexDirection === 'column-reverse');
    expect(column).toHaveLength(1);
  });

  it('labels never truncate (no numberOfLines on the footer labels)', () => {
    atWindow(PHONE, 3.1);
    const tree = render(element());
    actionsOf(tree)
      .findAll((n) => n.type === 'Text')
      .forEach((text) => expect(text.props.numberOfLines).toBeUndefined());
  });
});

describe('ChangePasswordModal sent state', () => {
  it('Send again (secondary) + Done (primary) through ModalActions, Done on top on a phone', () => {
    markResetEmailSent(Date.now());
    atWindow(PHONE, 1);
    const tree = render(<ChangePasswordModal visible onClose={jest.fn()} email="a@b.co" />);
    expect(buttonIds(tree)).toEqual(['change-password-resend', 'change-password-done']);
    expect(actionsLayout(tree).flexDirection).toBe('column-reverse');
    markResetEmailSent(0);
  });
});
