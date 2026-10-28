import { Linking, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ConfirmDialog from '../../shared/components/ConfirmDialog';
import GradientFill from '../../shared/components/GradientFill';
import PillButton from '../../shared/components/PillButton';
import StatusPill from '../../shared/components/StatusPill';
import { addToast } from '../../shared/components/toastStore';
import { colors, gradients, muscle, radii, textScale } from '../../shared/theme/tokens';
import { getMyTrainerApplication, getTrainer, listTrainers, requestCoaching, submitTrainerApplication } from './api/trainersApi';
import TrainerCard from './components/TrainerCard';
import TrainerApplyScreen, { applicationPill } from './screens/TrainerApplyScreen';
import TrainerDetailScreen, { detailGlow } from './screens/TrainerDetailScreen';
import TrainersScreen, { TRAINERS_GLOW } from './screens/TrainersScreen';

// v2 Phase 5 L (p5l): Find a trainer, Trainer detail, Trainer apply: look,
// the avatar colour rule, the back-link rule, ND4 and large text.

const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockRoute = { key: 'TrainerDetail-1', name: 'TrainerDetail', params: { trainerUserId: '8' } };
let mockIsTrainer = false;
const mockShellPage = jest.fn();

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation, useRoute: () => mockRoute }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../shared/components/BlurLayer', () => () => null);
jest.mock('../../shared/components/GradientFill', () => () => null);
jest.mock('../shell/ShellPage', () => (props) => {
  mockShellPage(props);
  return props.children;
});
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../shell/shellRules', () => ({ isTrainerUser: () => mockIsTrainer }));
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: {} }) }));
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'), ToastTone: { success: 'success', error: 'error' }, addToast: jest.fn() }));
jest.mock('./api/trainersApi', () => ({
  TRAINERS_PER_PAGE: 20,
  listTrainers: jest.fn(),
  getTrainer: jest.fn(),
  requestCoaching: jest.fn(),
  getMyTrainerApplication: jest.fn(),
  submitTrainerApplication: jest.fn(),
}));

const { openShellPath } = require('../shell/shellLinks');

const flat = (node) => StyleSheet.flatten(node.props.style);
const byId = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const allById = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const textsOf = (node) =>
  node
    .findAll((n) => n.type === 'Text')
    .map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string').join(''));
const allText = (tree) => textsOf(tree.root).join('|');

function setWindow(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 1000, scale: 2, fontScale });
}

const mounted = [];
async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
});

const SARA = { user_id: 8, display_name: 'Sara Lopez', email: 'sara.lopez@example.com', bio: 'Strength coach.' };
const ALEX = { user_id: 9, display_name: 'Alex Kim', email: 'alex@example.com', bio: null };
const page = (items, pagination = { page: 1, per_page: 20, total: items.length, total_pages: 1 }) => ({ items, pagination });

beforeEach(() => {
  setWindow(390);
  mockIsTrainer = false;
  mockRoute = { key: 'TrainerDetail-1', name: 'TrainerDetail', params: { trainerUserId: '8' } };
});

describe('Find a trainer (UX L §Trainers)', () => {
  it('phone: the h2 heading 44/44 under the shell title, the pill search with a hidden "Search" label, the gold page glow', async () => {
    listTrainers.mockResolvedValue(page([SARA, ALEX]));
    const tree = await render(<TrainersScreen />);
    expect(mockShellPage.mock.calls.at(-1)[0].glow).toBe(TRAINERS_GLOW.phone);
    expect(TRAINERS_GLOW.phone.colors).toBe(gradients.goldAmbient.colors);
    const heading = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(textsOf(heading)[0]).toBe('Find a trainer');
    expect(flat(heading)).toMatchObject({ fontSize: 44, lineHeight: 44 });
    expect(heading.props.maxFontSizeMultiplier).toBe(textScale.display);
    const input = tree.root.find((node) => node.type === 'TextInput');
    expect(input.props.accessibilityLabel).toBe('Search');
    expect(input.props.placeholder).toBe('Search by email');
  });

  it('phone card: gradient card radius 28, 64 rounded-square avatar in the person colour, "Trainer" gold pill, no-bio copy', async () => {
    listTrainers.mockResolvedValue(page([SARA, ALEX]));
    const tree = await render(<TrainersScreen />);
    const card = tree.root.find((node) => node.props.testID === 'trainers-card-9' && typeof node.props.style === 'function');
    expect(StyleSheet.flatten(card.props.style({ pressed: false }))).toMatchObject({ borderRadius: radii.xxl, borderColor: colors.choiceBorder });
    expect(flat(byId(tree, 'trainers-card-9-avatar'))).toMatchObject({ width: 64, borderRadius: radii.lgPlus });
    expect(flat(byId(tree, 'trainers-card-9-avatar-fill')).backgroundColor).toBe(muscle.legs);
    expect(flat(byId(tree, 'trainers-card-8-avatar-fill')).backgroundColor).toBe(muscle.cardio);
    const pills = tree.root.findAllByType(StatusPill);
    expect(pills.map((pill) => [pill.props.label, pill.props.tone])).toContainEqual(['Trainer', 'gold']);
    expect(allText(tree)).toContain('No bio yet.');
    expect(allText(tree)).toContain('View profile');
  });

  it('a card press opens the trainer; pressed = the 4 % overlay and the gold edge', async () => {
    listTrainers.mockResolvedValue(page([SARA]));
    const tree = await render(<TrainersScreen />);
    const card = tree.root.find((node) => node.props.testID === 'trainers-card-8' && typeof node.props.style === 'function');
    expect(StyleSheet.flatten(card.props.style({ pressed: true })).borderColor).toBe(colors.goldBorder);
    let pressedTree;
    act(() => {
      pressedTree = create(<Text>{card.props.children({ pressed: true })}</Text>);
    });
    expect(pressedTree.root.findAll((node) => node.props?.testID === 'trainers-card-8-pressed')).not.toHaveLength(0);
    act(() => pressedTree.unmount());
    act(() => card.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('TrainerDetail', { trainerUserId: '8' });
  });

  it('pager: phone glass Previous/Next (compact 44), Previous disabled on page 1; Next moves a page', async () => {
    listTrainers.mockResolvedValue(page([SARA], { page: 1, per_page: 20, total: 30, total_pages: 2 }));
    const tree = await render(<TrainersScreen />);
    const previous = tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainers-previous');
    const next = tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainers-next');
    expect([previous.props.variant, previous.props.size, previous.props.disabled]).toEqual(['secondary', 'compact', true]);
    expect([next.props.variant, next.props.disabled]).toEqual(['secondary', false]);
    await act(async () => next.props.onPress());
    expect(listTrainers).toHaveBeenLastCalledWith({ page: 2, search: '' });
  });

  it('tablet: 60/60 heading, two-column grid of column cards (72 circle avatar, eyebrow, glass "View profile →"), light Next in the pager pill', async () => {
    setWindow(834);
    listTrainers.mockResolvedValue(page([SARA, ALEX], { page: 1, per_page: 20, total: 30, total_pages: 2 }));
    const tree = await render(<TrainersScreen />);
    expect(mockShellPage.mock.calls.at(-1)[0].glow).toBe(TRAINERS_GLOW.tablet);
    const heading = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(flat(heading)).toMatchObject({ fontSize: 60, lineHeight: 60 });
    const cards = tree.root.findAllByType(TrainerCard);
    expect(cards.every((card) => card.props.tablet)).toBe(true);
    expect(cards[0].parent.props.style).toBeTruthy();
    expect(flat(byId(tree, 'trainers-card-8-avatar'))).toMatchObject({ width: 72, borderRadius: 36 });
    expect(allById(tree, 'trainers-card-8-glow')).toHaveLength(1);
    expect(textsOf(byId(tree, 'trainers-card-8-view'))).toContain('View profile →');
    const next = tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainers-next');
    const previous = tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainers-previous');
    expect([previous.props.variant, next.props.variant]).toEqual(['ghost', 'light']);
    expect(flat(byId(tree, 'trainers-pager'))).toMatchObject({ borderRadius: radii.full, backgroundColor: colors.glass });
  });

  it.each([1, 2, 3.1])('large text %s×: heading capped at 1.3 and word-wrapped; cards one column past 1.3; nothing cut to one line', async (scale) => {
    setWindow(834, scale);
    listTrainers.mockResolvedValue(page([SARA, ALEX]));
    const tree = await render(<TrainersScreen />);
    const grid = byId(tree, 'trainers-grid');
    const rows = grid.children.filter((child) => typeof child !== 'string');
    expect(rows).toHaveLength(scale > textScale.reflowAbove ? 2 : 1);
    tree.root
      .findAll((node) => node.type === 'Text' && node.props.maxFontSizeMultiplier !== undefined)
      .forEach((node) => expect(node.props.numberOfLines === undefined || node.props.numberOfLines >= 2).toBe(true));
    const heading = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(heading.props).toMatchObject({ maxFontSizeMultiplier: textScale.display, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
  });
});

describe('Trainer detail (UX L §Trainer detail)', () => {
  it('back-link rule: "← All trainers" text link (name "All trainers") on every state; it pushes the list (⚠TR-4)', async () => {
    getTrainer.mockReturnValue(new Promise(() => {}));
    const tree = await render(<TrainerDetailScreen />);
    const link = tree.root.find((node) => node.props.testID === 'trainer-detail-all' && node.props.accessibilityRole === 'link');
    expect(link.props.accessibilityLabel).toBe('All trainers');
    expect(textsOf(link)).toContain('← All trainers');
    act(() => link.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('Trainers');
  });

  it('the page glow takes the trainer colour from the route id (present from the first render)', async () => {
    getTrainer.mockReturnValue(new Promise(() => {}));
    await render(<TrainerDetailScreen />);
    const glow = mockShellPage.mock.calls[0][0].glow;
    expect(glow).toEqual(detailGlow('8', false));
    expect(glow.colors[0]).toBe('rgba(79, 216, 196, 0.30)');
  });

  // DECLARED (T-64, owner): was "muted email" under the name; no address is printed now.
  it('phone: centred identity (104 avatar + ring, gold "Trainer" pill, 34/38 name h2, no email), About card, full-width 60 CTA', async () => {
    getTrainer.mockResolvedValue(SARA);
    const tree = await render(<TrainerDetailScreen />);
    expect(flat(byId(tree, 'trainer-detail-avatar'))).toMatchObject({ width: 104 });
    expect(flat(byId(tree, 'trainer-detail-avatar-ring-line'))).toMatchObject({ borderColor: muscle.cardio, opacity: 0.45 });
    const name = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(name.props.children).toBe('Sara Lopez');
    expect(flat(name)).toMatchObject({ fontSize: 34, lineHeight: 38, textAlign: 'center' });
    expect(allById(tree, 'trainer-detail-email')).toHaveLength(0);
    expect(allById(tree, 'trainer-detail-contact')).toHaveLength(0);
    expect(allText(tree)).not.toContain('@');
    expect(flat(byId(tree, 'trainer-detail-about'))).toMatchObject({ borderRadius: radii.xl, backgroundColor: colors.surface });
    const ask = tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-detail-ask');
    expect(ask.props).toMatchObject({ title: 'Ask Sara Lopez to coach me', size: 'cta', fullWidth: true });
  });

  // T-64 (PM): no display_name → "Trainer" and the neutral "T", never the email's local part (detail + TR1 cards).
  it.each([390, 834])('T-64 at %s: an email-only trainer reads "Trainer" with the "T" avatar; tablet keeps Contact', async (width) => {
    setWindow(width);
    const EMAIL_ONLY = { user_id: 8, email: 'coach.mike@example.com', bio: null };
    getTrainer.mockResolvedValue(EMAIL_ONLY);
    const tree = await render(<TrainerDetailScreen />);
    const name = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(name.props.children).toBe('Trainer');
    expect(textsOf(byId(tree, 'trainer-detail-avatar'))).toEqual(['T']);
    expect(allText(tree)).not.toMatch(/@|coach\.mike|mike/i);
    expect(allById(tree, 'trainer-detail-contact')).toHaveLength(width >= 834 ? 1 : 0);
    listTrainers.mockResolvedValue(page([EMAIL_ONLY]));
    const list = await render(<TrainersScreen />);
    expect(textsOf(byId(list, 'trainers-card-8-avatar'))).toEqual(['T']);
    expect(allText(list)).toContain('Trainer');
    expect(allText(list)).not.toMatch(/coach\.mike|mike/i);
  });

  it('no bio: the italic faint line', async () => {
    getTrainer.mockResolvedValue(ALEX);
    const tree = await render(<TrainerDetailScreen />);
    const noBio = tree.root.find((node) => node.type === 'Text' && node.props.children === 'This trainer hasn’t written a bio yet.');
    expect(flat(noBio)).toMatchObject({ fontStyle: 'italic', color: colors.textFaint });
  });

  it('the request: confirm → toast + the requested state (warning "Pending" pill + sentence, no gold button)', async () => {
    getTrainer.mockResolvedValue(SARA);
    requestCoaching.mockResolvedValue({ status: 'pending' });
    const tree = await render(<TrainerDetailScreen />);
    act(() => tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-detail-ask').props.onPress());
    const dialog = tree.root.findByType(ConfirmDialog);
    expect(dialog.props).toMatchObject({ isOpen: true, title: 'Ask Sara Lopez to coach you?', confirmLabel: 'Send request', tone: 'brand' });
    await act(async () => dialog.props.onConfirm());
    expect(addToast).toHaveBeenCalledWith('success', 'Request sent', 'They’ll see it and can accept or decline.');
    const pill = tree.root.find((node) => node.type === StatusPill && node.props.testID === 'trainer-detail-requested-status');
    expect([pill.props.label, pill.props.tone]).toEqual(['Pending', 'warning']);
    expect(allText(tree)).toContain('Your request is waiting for Sara Lopez to respond.');
    expect(tree.root.findAll((node) => node.type === PillButton && node.props.testID === 'trainer-detail-ask')).toHaveLength(0);
    expect(tree.root.findByType(ConfirmDialog).props.isOpen).toBe(false);
  });

  it('UX R2-2: the phone request dialog keeps the title-row × AND the footer Cancel (the board draws both)', async () => {
    getTrainer.mockResolvedValue(SARA);
    const tree = await render(<TrainerDetailScreen />);
    act(() => tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-detail-ask').props.onPress());
    const hostIds = (id) => tree.root.findAll((node) => node.props?.testID === id && typeof node.type === 'string');
    expect(hostIds('app-modal-close')).toHaveLength(1);
    expect(hostIds('trainer-detail-dialog-cancel').length).toBeGreaterThan(0);
  });

  it('a failed request toasts the code copy and closes the dialog (⚠TR-9)', async () => {
    getTrainer.mockResolvedValue(SARA);
    requestCoaching.mockRejectedValue({ response: { status: 404 } });
    const tree = await render(<TrainerDetailScreen />);
    act(() => tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-detail-ask').props.onPress());
    await act(async () => tree.root.findByType(ConfirmDialog).props.onConfirm());
    expect(addToast).toHaveBeenCalledWith('error', 'Could not send request', 'This trainer is no longer available.');
    expect(tree.root.findByType(ConfirmDialog).props.isOpen).toBe(false);
  });

  // DECLARED (T-64, owner): the ND4 chip read the address; it now reads "Contact" and opens mailto: without printing it.
  it('tablet: the hero card (radius 36, 132 avatar, 56/58 name), ND4 = a "Contact" mailto chip, no address', async () => {
    setWindow(834);
    getTrainer.mockResolvedValue(SARA);
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const tree = await render(<TrainerDetailScreen />);
    expect(flat(byId(tree, 'trainer-detail-card'))).toMatchObject({ borderRadius: radii.xxxxl });
    expect(flat(byId(tree, 'trainer-detail-avatar'))).toMatchObject({ width: 132 });
    const name = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(flat(name)).toMatchObject({ fontSize: 56, lineHeight: 58 });
    const contact = tree.root.find((node) => node.props.testID === 'trainer-detail-contact' && node.props.accessibilityRole === 'link');
    expect(contact.props.accessibilityLabel).toBe('Contact');
    expect(textsOf(contact)).toEqual(['Contact']);
    expect(allText(tree)).not.toContain('@');
    act(() => contact.props.onPress());
    expect(spy).toHaveBeenCalledWith('mailto:sara.lopez@example.com');
    const ask = tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-detail-ask');
    expect(flat({ props: { style: ask.props.style } }).minHeight).toBe(64);
    spy.mockRestore();
  });

  // p5fix (review LOW): like My trainer's Contact, a missing mail handler
  // (openURL rejects) is caught, never an unhandled rejection.
  it('tablet: the mailto link catches a rejected openURL (no mail app)', async () => {
    setWindow(834);
    getTrainer.mockResolvedValue(SARA);
    let caught;
    const spy = jest.spyOn(Linking, 'openURL').mockImplementation(() => {
      const rejected = Promise.reject(new Error('No mail handler'));
      caught = jest.spyOn(rejected, 'catch');
      return rejected;
    });
    const tree = await render(<TrainerDetailScreen />);
    const contact = tree.root.find((node) => node.props.testID === 'trainer-detail-contact' && node.props.accessibilityRole === 'link');
    await act(async () => contact.props.onPress());
    expect(caught).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it.each([1, 2, 3.1])('large text %s×: the name follows the title rule; every text is capped', async (scale) => {
    setWindow(390, scale);
    getTrainer.mockResolvedValue(SARA);
    const tree = await render(<TrainerDetailScreen />);
    const name = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(name.props).toMatchObject({ numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    tree.root
      .findAll((node) => node.type === 'Text' && typeof node.props.children === 'string' && node.parent?.type !== 'Text')
      .forEach((node) => expect(node.props.maxFontSizeMultiplier).toBeGreaterThan(0));
  });
});

describe('Trainer apply (UX L §Trainer apply)', () => {
  it('applicationPill: sentence case; approved = success, rejected = danger, pending = warning, else neutral', () => {
    expect(applicationPill('approved')).toEqual({ label: 'Approved', tone: 'completed' });
    expect(applicationPill('REJECTED')).toEqual({ label: 'Rejected', tone: 'danger' });
    expect(applicationPill('pending')).toEqual({ label: 'Pending', tone: 'warning' });
    expect(applicationPill('weird')).toEqual({ label: 'Weird', tone: 'neutral' });
    expect(applicationPill(null)).toEqual({ label: '', tone: 'neutral' });
  });

  it('the back-link rule (newly added): "← Coaching" → /my-trainer', async () => {
    getMyTrainerApplication.mockResolvedValue(null);
    const tree = await render(<TrainerApplyScreen />);
    const link = tree.root.find((node) => node.props.testID === 'trainer-apply-back' && node.props.accessibilityRole === 'link');
    expect(link.props.accessibilityLabel).toBe('Coaching');
    act(() => link.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/my-trainer');
  });

  it('phone: "Become a trainer" (48/48, "trainer" gold), form card radius 28, well textarea, full-width 60 Submit', async () => {
    getMyTrainerApplication.mockResolvedValue(null);
    const tree = await render(<TrainerApplyScreen />);
    const heading = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header' && flat(node).fontSize === 48);
    const accent = heading.findAll((node) => node.type === 'Text' && node !== heading)[0];
    expect(accent.props.children).toBe(' trainer');
    expect(flat(accent).color).toBe(colors.gold);
    expect(flat(byId(tree, 'trainer-apply-form'))).toMatchObject({ borderRadius: radii.xxl, padding: 22 });
    const submit = tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-apply-submit');
    expect(submit.props).toMatchObject({ title: 'Submit application', size: 'cta', fullWidth: true });
    expect(allText(tree)).toContain('Optional — you can apply without one.');
  });

  it('submit: loading, then the toast and the pending status panel (warning pill)', async () => {
    getMyTrainerApplication.mockResolvedValue(null);
    let resolve;
    submitTrainerApplication.mockReturnValue(new Promise((r) => (resolve = r)));
    const tree = await render(<TrainerApplyScreen />);
    act(() => {
      tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-apply-submit').props.onPress();
    });
    expect(tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-apply-submit').props.loading).toBe(true);
    await act(async () => resolve({ status: 'pending', created_at: '2026-10-20T10:00:00Z', message: 'Hi' }));
    expect(addToast).toHaveBeenCalledWith('success', 'Application submitted', 'An admin will review it shortly.');
    const pill = tree.root.find((node) => node.type === StatusPill && node.props.testID === 'trainer-apply-status-pill');
    expect([pill.props.label, pill.props.tone]).toEqual(['Pending', 'warning']);
    expect(allText(tree)).toContain('Your message');
  });

  it('rejected: the status panel (danger pill) and the "Apply again" form', async () => {
    getMyTrainerApplication.mockResolvedValue({ status: 'rejected', created_at: '2026-10-20T10:00:00Z' });
    const tree = await render(<TrainerApplyScreen />);
    expect(tree.root.find((node) => node.type === StatusPill && node.props.testID === 'trainer-apply-status-pill').props.tone).toBe('danger');
    expect(allText(tree)).toContain('Apply again');
    expect(tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-apply-submit').props.title).toBe('Submit new application');
  });

  it('already a trainer: the card in the v2 style', async () => {
    mockIsTrainer = true;
    getMyTrainerApplication.mockResolvedValue(null);
    const tree = await render(<TrainerApplyScreen />);
    expect(flat(byId(tree, 'trainer-apply-already'))).toMatchObject({ borderRadius: radii.xxl });
    expect(allText(tree)).toContain('You’re already a trainer');
  });

  // DECLARED (UX native final audit 27 Oct 2026, ruling 4, C311 / C310): was
  // "tablet: the gold hero (150°, gold stops, ink text 58/58)". The hero card
  // is dropped (web parity): tablets draw the plain H1, "trainer" in gold.
  // The form card radius 32 and Submit-at-its-own-width checks are kept below.
  it.each([834, 1194])('ruling 4: tablet %s has no gold hero card', async (width) => {
    setWindow(width);
    getMyTrainerApplication.mockResolvedValue(null);
    const tree = await render(<TrainerApplyScreen />);
    expect(allById(tree, 'trainer-apply-hero')).toHaveLength(0);
    expect(tree.root.findAll((node) => node.type === GradientFill && node.props.colors === gradients.gold.colors)).toHaveLength(0);
  });

  it.each([834, 1194])('ruling 4: tablet %s draws the plain H1 "Become a trainer", "trainer" in gold', async (width) => {
    setWindow(width);
    getMyTrainerApplication.mockResolvedValue(null);
    const tree = await render(<TrainerApplyScreen />);
    const headers = tree.root.findAll((node) => node.type === 'Text' && node.props.accessibilityRole === 'header' && textsOf(node).join('') === 'Become a trainer');
    // One page title.
    expect(headers).toHaveLength(1);
    const heading = headers[0];
    expect(byId(tree, 'trainer-apply-heading').findAll((node) => node === heading)).toHaveLength(1);
    expect(flat(heading).color).toBe(colors.textPrimary);
    const accent = heading.findAll((node) => node.type === 'Text' && node !== heading)[0];
    expect(accent.props.children).toBe(' trainer');
    expect(flat(accent).color).toBe(colors.gold);
  });

  it('tablet: form card radius 32, Submit at its own width', async () => {
    setWindow(834);
    getMyTrainerApplication.mockResolvedValue(null);
    const tree = await render(<TrainerApplyScreen />);
    expect(flat(byId(tree, 'trainer-apply-form'))).toMatchObject({ borderRadius: radii.xxxl, padding: 30 });
    expect(tree.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-apply-submit').props.fullWidth).toBe(false);
  });

  it.each([1, 2, 3.1])('large text %s×: headings follow the title rule; no text cut to one line', async (scale) => {
    setWindow(390, scale);
    getMyTrainerApplication.mockResolvedValue(null);
    const tree = await render(<TrainerApplyScreen />);
    tree.root
      .findAll((node) => node.type === 'Text' && node.props.accessibilityRole === 'header')
      .forEach((node) => expect(node.props).toMatchObject({ adjustsFontSizeToFit: true, minimumFontScale: 0.7 }));
    tree.root
      .findAll((node) => node.type === Text && node.props.numberOfLines !== undefined)
      .forEach((node) => expect(node.props.numberOfLines).toBeGreaterThanOrEqual(2));
  });
});

// UX native final audit 27 Oct 2026, ruling 1 (PM: "nothing under the tab bar"):
// on a phone the TrainerDetail board pins "Ask … to coach me" above the tab bar.
// It sits in the ONE shared dock (fade 32, solid ground to the edge, 12 above
// the tab bar's top) and the page's scroll room = the dock's measured height,
// so the CTA is never under the floating tab bar and a tap never hits the nav.
describe('Trainer detail pinned CTA (UX native final audit 27 Oct 2026, ruling 1)', () => {
  const { default: PinnedDock } = require('../../shared/components/PinnedDock');
  const dockOf = (tree) => tree.root.findAll((node) => node.type === PinnedDock)[0];

  it('phone (360): the Ask CTA sits in the dock: fade 32, solid ground, 12 above the tab bar', async () => {
    setWindow(360);
    getTrainer.mockResolvedValue(SARA);
    const tree = await render(<TrainerDetailScreen />);
    const dock = dockOf(tree);
    expect(dock.props.testID).toBe('trainer-detail-dock');
    expect(dock.findAll((node) => node.type === PillButton && node.props.testID === 'trainer-detail-ask')).toHaveLength(1);
    expect(flat(byId(tree, 'trainer-detail-dock-fade')).height).toBe(32);
    expect(flat(byId(tree, 'trainer-detail-dock-body'))).toMatchObject({ backgroundColor: colors.ground, paddingBottom: 86 + 12 });
  });

  it('phone: the scroll room = the measured dock height', async () => {
    setWindow(360);
    getTrainer.mockResolvedValue(SARA);
    const tree = await render(<TrainerDetailScreen />);
    await act(async () => byId(tree, 'trainer-detail-dock').props.onLayout({ nativeEvent: { layout: { height: 170 } } }));
    expect(mockShellPage.mock.calls.at(-1)[0].dockHeight).toBe(170);
  });

  it('after a request (no CTA), on a tablet and at large text: no dock, the CTA slot stays in the page', async () => {
    setWindow(360);
    getTrainer.mockResolvedValue(SARA);
    requestCoaching.mockResolvedValue({ status: 'PENDING' });
    const sent = await render(<TrainerDetailScreen />);
    await act(async () => sent.root.find((node) => node.type === PillButton && node.props.testID === 'trainer-detail-ask').props.onPress());
    await act(async () => sent.root.findByType(ConfirmDialog).props.onConfirm());
    expect(dockOf(sent)).toBeUndefined();
    expect(allById(sent, 'trainer-detail-requested').length).toBeGreaterThan(0);
    for (const [width, scale] of [[834, 1], [390, 2]]) {
      setWindow(width, scale);
      const tree = await render(<TrainerDetailScreen />);
      expect(dockOf(tree)).toBeUndefined();
      expect(tree.root.findAll((node) => node.type === PillButton && node.props.testID === 'trainer-detail-ask')).toHaveLength(1);
    }
  });
});
