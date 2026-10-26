import { Animated, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import Spinner from '../../../shared/components/Spinner';
import { addToast } from '../../../shared/components/toastStore';
import { colors } from '../../../shared/theme/tokens';
import { inviteClient, searchMembers } from './api/clientsApi';
import { isEmailShaped } from './clientFormat';
import InviteClientModal from './components/InviteClientModal';

let mockReducedMotion = true;
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./api/clientsApi', () => ({ searchMembers: jest.fn(), inviteClient: jest.fn() }));
jest.mock('../../../shared/components/toastStore', () => ({
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));

const MEMBER = { id: 41, email: 'client@example.com' };
const REMOVED_COPY = [
  'Search members by email and invite them to be coached by you.',
  'Search members',
  'Search by email',
  'Search for a member',
  'Type at least 3 characters of their email address to find them.',
  'Searching',
  'No members found',
  'Try a different email.',
];

const texts = (tree) =>
  tree.root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => [].concat(node.props.children).filter((part) => typeof part !== 'object').join(''));
const field = (tree) => tree.root.find((node) => node.type === 'TextInput' && node.props.testID === 'invite-search');
const byTestId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string');
const hiddenStatus = (tree) => tree.root.findAll((node) => typeof node.type === 'string' && node.props.testID === 'invite-searching-status');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const mounted = [];
function render(props = {}) {
  let tree;
  act(() => {
    tree = create(<InviteClientModal isOpen onClose={jest.fn()} onInvited={jest.fn()} {...props} />);
  });
  mounted.push(tree);
  return tree;
}

function type(tree, text) {
  act(() => field(tree).props.onChangeText(text));
}

async function settle(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockReducedMotion = true;
});

afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.useRealTimers();
});

describe('C1a exact-email invite (§C3.3 T-32 M1)', () => {
  it('description and field: "Client\'s email", email keyboard, no capitalisation/correction/autocomplete, no placeholder', () => {
    const tree = render();
    const shown = texts(tree);
    expect(shown).toContain("Enter your client's full email address to invite them.");
    expect(shown).toContain("Client's email");
    const props = field(tree).props;
    expect(props.keyboardType).toBe('email-address');
    expect(props.autoCapitalize).toBe('none');
    expect(props.autoCorrect).toBe(false);
    expect(props.textContentType).toBe('emailAddress');
    expect(props.autoComplete).toBe('off');
    expect(props.placeholder).toBeUndefined();
  });

  it('opening starts with the helper "Enter their full email address." and nothing below the field', () => {
    const tree = render();
    const shown = texts(tree);
    expect(shown).toContain('Enter their full email address.');
    expect(shown.filter((text) => REMOVED_COPY.includes(text))).toEqual([]);
    expect(shown).not.toContain('No member found');
  });

  it('email-shaped gate matches the web regex (one "@", a char before it, a "." after it with a char after the dot, no spaces)', () => {
    ['client@example.com', 'a@b.c', 'a@.c'].forEach((text) => expect(isEmailShaped(text)).toBe(true));
    ['', 'client', 'client@', '@example.com', 'client@example', 'client@example.', 'a@b@example.com', 'client @example.com', 'client@exa mple.com'].forEach(
      (text) => expect(isEmailShaped(text)).toBe(false)
    );
  });

  it('not email-shaped (incl. empty) → no request, the helper, and no empty state or results', async () => {
    const tree = render();
    for (const text of ['clie', 'client@example', 'client@example.', '   ']) {
      type(tree, text);
      await settle(300);
      act(() => field(tree).props.onSubmitEditing());
      await settle();
      expect(texts(tree)).toContain('Enter their full email address.');
      expect(texts(tree)).not.toContain('No member found');
    }
    expect(searchMembers).not.toHaveBeenCalled();
  });

  it('query is the input trimmed', async () => {
    searchMembers.mockResolvedValue([MEMBER]);
    const tree = render();
    type(tree, '  client@example.com  ');
    await settle(300);
    expect(searchMembers).toHaveBeenCalledWith('client@example.com');
  });

  it('email-shaped → searches 300 ms after typing stops (each keystroke restarts the wait)', async () => {
    searchMembers.mockResolvedValue([MEMBER]);
    const tree = render();
    type(tree, 'client@example.co');
    await settle(200);
    type(tree, 'client@example.com');
    await settle(299);
    expect(searchMembers).not.toHaveBeenCalled();
    await settle(1);
    expect(searchMembers).toHaveBeenCalledTimes(1);
    expect(searchMembers).toHaveBeenCalledWith('client@example.com');
  });

  it('email-shaped → searches at once on Enter/return, and the pending debounce does not search again', async () => {
    searchMembers.mockResolvedValue([MEMBER]);
    const tree = render();
    type(tree, 'client@example.com');
    act(() => field(tree).props.onSubmitEditing());
    await settle();
    expect(searchMembers).toHaveBeenCalledTimes(1);
    expect(searchMembers).toHaveBeenCalledWith('client@example.com');
    await settle(300);
    expect(searchMembers).toHaveBeenCalledTimes(1);
  });

  it('while a request runs: 18px in-field spinner (border ring, brand-700 arc), right padding 44, hidden "Searching…" status, no centred Loader', async () => {
    const pending = deferred();
    searchMembers.mockReturnValue(pending.promise);
    const tree = render();
    expect(tree.root.findAllByType(Spinner)).toHaveLength(0);
    type(tree, 'client@example.com');
    await settle(300);

    const spinner = tree.root.findByType(Spinner);
    expect(spinner.props).toEqual(expect.objectContaining({ size: 18, thickness: 2, color: colors.brand700, track: colors.border }));
    const trailing = StyleSheet.flatten(spinner.parent.parent.props.style);
    expect(trailing).toEqual(expect.objectContaining({ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }));
    expect(StyleSheet.flatten(field(tree).props.style).paddingRight).toBe(44);
    expect(hiddenStatus(tree)).toHaveLength(1);
    expect(hiddenStatus(tree)[0].props.accessibilityLiveRegion).toBe('polite');
    expect(texts(tree)).toContain('Searching…');
    expect(tree.root.findAll((node) => node.props.accessibilityRole === 'progressbar')).toHaveLength(0);
    expect(texts(tree)).not.toContain('Searching');

    await act(async () => pending.resolve([MEMBER]));
    expect(tree.root.findAllByType(Spinner)).toHaveLength(0);
    expect(StyleSheet.flatten(field(tree).props.style).paddingRight).toBeUndefined();
    // The live region stays mounted (Android reads the change); only its text empties.
    expect(hiddenStatus(tree)).toHaveLength(1);
    expect(texts(tree)).not.toContain('Searching…');
  });

  it('in-field spinner: 1 turn/s, and under reduced motion 3 s/turn without stopping', () => {
    const timing = jest.spyOn(Animated, 'timing');
    let tree;
    mockReducedMotion = false;
    act(() => {
      tree = create(<Spinner size={18} thickness={2} reducedMotionLoopMs={3000} />);
    });
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: 1000 }));
    act(() => tree.unmount());
    mockReducedMotion = true;
    act(() => {
      tree = create(<Spinner size={18} thickness={2} reducedMotionLoopMs={3000} />);
    });
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: 3000 }));
    expect(tree.root.findByType(Animated.View).props.accessibilityElementsHidden).toBe(true);
    act(() => tree.unmount());
    timing.mockRestore();
  });

  it('the modal passes the 3 s reduced-motion pace to its spinner', async () => {
    searchMembers.mockReturnValue(new Promise(() => {}));
    const tree = render();
    type(tree, 'client@example.com');
    await settle(300);
    expect(tree.root.findByType(Spinner).props.reducedMotionLoopMs).toBe(3000);
  });

  it('the previous result stays until the next answer arrives', async () => {
    searchMembers.mockResolvedValueOnce([MEMBER]);
    const tree = render();
    type(tree, 'client@example.com');
    await settle(300);
    expect(texts(tree)).toContain('client@example.com');

    const pending = deferred();
    searchMembers.mockReturnValueOnce(pending.promise);
    type(tree, 'other@example.com');
    await settle(300);
    expect(tree.root.findAllByType(Spinner)).toHaveLength(1);
    expect(texts(tree)).toContain('client@example.com');

    await act(async () => pending.resolve([]));
    expect(texts(tree)).not.toContain('client@example.com');
    expect(texts(tree)).toContain('No member found');
  });

  it('first request of an opening shows nothing below the field until it answers', async () => {
    const pending = deferred();
    searchMembers.mockReturnValue(pending.promise);
    const tree = render();
    type(tree, 'client@example.com');
    await settle(300);
    expect(texts(tree)).not.toContain('No member found');
    await act(async () => pending.resolve([]));
    expect(texts(tree)).toContain('No member found');
  });

  it('0 found → EmptyState "No member found" / "Check the spelling. If they\'re new to Gymido, ask them to sign up first."', async () => {
    searchMembers.mockResolvedValue([]);
    const tree = render();
    type(tree, 'nobody@example.com');
    await settle(300);
    const shown = texts(tree);
    expect(shown).toContain('No member found');
    expect(shown).toContain("Check the spelling. If they're new to Gymido, ask them to sign up first.");
    expect(shown).not.toContain('Enter their full email address.');
    expect(shown.filter((text) => REMOVED_COPY.includes(text))).toEqual([]);
  });

  it('1 found → the one row (email + "Invite" → "Invited"), unchanged', async () => {
    searchMembers.mockResolvedValue([MEMBER]);
    inviteClient.mockResolvedValue({ id: 9 });
    const onInvited = jest.fn();
    const tree = render({ onInvited });
    type(tree, 'client@example.com');
    await settle(300);
    expect(texts(tree)).toContain('client@example.com');
    const [inviteButton] = byTestId(tree, 'invite-user-41');
    await act(async () => inviteButton.props.onPress());
    expect(inviteClient).toHaveBeenCalledWith(41);
    expect(texts(tree)).toContain('Invited');
    expect(addToast).toHaveBeenCalledWith('success', 'Invitation sent', 'client@example.com can accept or decline it.');
    expect(onInvited).toHaveBeenCalled();
  });

  it('error → unchanged ErrorAlert "Could not search" + Retry searches again', async () => {
    searchMembers.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server down' } } });
    const tree = render();
    type(tree, 'client@example.com');
    await settle(300);
    expect(texts(tree)).toContain('Could not search');

    searchMembers.mockResolvedValueOnce([MEMBER]);
    const retry = tree.root.find((node) => typeof node.props.onRetry === 'function');
    await act(async () => retry.props.onRetry());
    expect(searchMembers).toHaveBeenLastCalledWith('client@example.com');
    expect(texts(tree)).not.toContain('Could not search');
    expect(texts(tree)).toContain('client@example.com');
  });

  it('going back to not email-shaped clears the result and shows the helper again', async () => {
    searchMembers.mockResolvedValue([MEMBER]);
    const tree = render();
    type(tree, 'client@example.com');
    await settle(300);
    type(tree, 'client@example');
    await settle(300);
    expect(texts(tree)).toContain('Enter their full email address.');
    expect(texts(tree)).not.toContain('client@example.com');
    expect(searchMembers).toHaveBeenCalledTimes(1);
  });

  it('the helper follows each keystroke, before the 300 ms debounce (FE a5e852b3 #1)', async () => {
    const tree = render();
    type(tree, 'client@example.com');
    expect(texts(tree)).not.toContain('Enter their full email address.');
    expect(searchMembers).not.toHaveBeenCalled();
    type(tree, 'client@example');
    expect(texts(tree)).toContain('Enter their full email address.');
  });

  it('results show only while BOTH the live text and the searched query are email-shaped; the spinner follows the live text (FE a5e852b3 #1)', async () => {
    searchMembers.mockResolvedValueOnce([MEMBER]);
    const tree = render();
    type(tree, 'client@example.com');
    await settle(300);
    expect(texts(tree)).toContain('client@example.com');
    const pending = deferred();
    searchMembers.mockReturnValueOnce(pending.promise);
    type(tree, 'other@example.com');
    await settle(300);
    expect(tree.root.findAllByType(Spinner)).toHaveLength(1);
    // Broken before the next debounce fires: no results and no spinner at once.
    type(tree, 'other@example');
    expect(texts(tree)).not.toContain('client@example.com');
    expect(tree.root.findAllByType(Spinner)).toHaveLength(0);
    expect(texts(tree)).not.toContain('Searching…');
    await act(async () => pending.resolve([]));
  });

  it('Retry clears the error at once and shows only the spinner until the answer (FE a5e852b3 #4)', async () => {
    searchMembers.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server down' } } });
    const tree = render();
    type(tree, 'client@example.com');
    await settle(300);
    expect(texts(tree)).toContain('Could not search');
    const pending = deferred();
    searchMembers.mockReturnValueOnce(pending.promise);
    const retry = tree.root.find((node) => typeof node.props.onRetry === 'function');
    act(() => {
      retry.props.onRetry();
    });
    expect(texts(tree)).not.toContain('Could not search');
    expect(texts(tree)).not.toContain('No member found');
    expect(tree.root.findAllByType(Spinner)).toHaveLength(1);
    await act(async () => pending.resolve([MEMBER]));
    expect(texts(tree)).toContain('client@example.com');
  });

  it('per-opening reset: closing clears the field, result and "Invited" marks; reopening starts with the helper', async () => {
    searchMembers.mockResolvedValue([MEMBER]);
    inviteClient.mockResolvedValue({ id: 9 });
    const tree = render();
    type(tree, 'client@example.com');
    await settle(300);
    await act(async () => byTestId(tree, 'invite-user-41')[0].props.onPress());

    act(() => tree.update(<InviteClientModal isOpen={false} onClose={jest.fn()} onInvited={jest.fn()} />));
    act(() => tree.update(<InviteClientModal isOpen onClose={jest.fn()} onInvited={jest.fn()} />));
    expect(field(tree).props.value).toBe('');
    const shown = texts(tree);
    expect(shown).toContain('Enter their full email address.');
    expect(shown).not.toContain('Invited');
    expect(shown).not.toContain('client@example.com');
    expect(shown).not.toContain('Search for a member');
  });
});
