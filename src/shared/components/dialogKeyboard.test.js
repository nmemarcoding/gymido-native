// UX native final audit 27 Oct 2026, ruling 12 (rows A141, A142, A150,
// A151, B225, B250 footer half): every dialog / sheet with a field rises
// above the keyboard and keeps its buttons visible; on a landscape tablet the
// dialog scrolls with its title pinned. These render the real dialogs with
// the REAL keyboard hook and a mocked keyboard frame, then check the
// geometry: the card's bottom edge is at or above the keyboard's top edge
// and the footer buttons sit outside the scroll (always on screen).
import { Dimensions, Keyboard, ScrollView, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import ExerciseFilterSheet from '../../features/exercises/components/ExerciseFilterSheet';
import { NO_FILTERS, equipmentNameMap, filterFacets } from '../../features/exercises/exerciseFilters';
import WeightLogModal from '../../features/home/WeightLogModal';
import DeleteAccountDialog from '../../features/profile/DeleteAccountDialog';
import AddDayModal from '../../features/trainer/plans/components/AddDayModal';

let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
let mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../hooks/useSheetFocus', () => ({ useSheetFocus: jest.fn() }));
jest.mock('./BlurLayer', () => () => null);
jest.mock('../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../features/home/api/homeApi', () => ({ logWeight: jest.fn() }));
jest.mock('../../features/profile/api/profileApi', () => ({ getProfile: jest.fn(), createProfile: jest.fn(), deleteAccount: jest.fn() }));

let listeners;
beforeEach(() => {
  listeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, cb) => {
    listeners[name] = cb;
    return { remove: () => delete listeners[name] };
  });
  jest.spyOn(Dimensions, 'get').mockImplementation(() => mockWindow);
  jest.spyOn(Dimensions, 'addEventListener').mockImplementation(() => ({ remove: () => {} }));
});
afterEach(() => jest.restoreAllMocks());

// iPhone 15: the keyboard frame's height equals what it covers.
const IPHONE = { window: { width: 390, height: 844, scale: 3, fontScale: 1 }, insets: { top: 47, bottom: 34, left: 0, right: 0 }, frame: { height: 336, screenY: 844 - 336 } };
// Reviewer carry (final batch, 27 Oct 2026): the small phone, 375 × 667
// (iPhone SE / 8, no home indicator), keyboard 216 + the 44 suggestion bar.
const IPHONE_SE = { window: { width: 375, height: 667, scale: 2, fontScale: 1 }, insets: { top: 20, bottom: 0, left: 0, right: 0 }, frame: { height: 260, screenY: 667 - 260 } };
// … and both phones at fontScale 1.3 (the reflow edge: still the 1× layouts).
const at13 = (device) => ({ ...device, window: { ...device.window, fontScale: 1.3 } });
// Android phone, 3-button nav (48): RN reports height = IME − system bars
// (ReactRootView.checkForKeyboardEvents), but the edge-to-edge Modal draws to
// the screen bottom, so the keyboard covers height + 48 of the window.
const ANDROID = { window: { width: 412, height: 915, scale: 2.625, fontScale: 1 }, insets: { top: 24, bottom: 48, left: 0, right: 0 }, frame: { height: 300, screenY: 915 - 348 } };
// iPad landscape (1180 × 820): the keyboard covers ~40 % of the height.
const IPAD_L = { window: { width: 1180, height: 820, scale: 2, fontScale: 1 }, insets: { top: 24, bottom: 20, left: 0, right: 0 }, frame: { height: 398, screenY: 820 - 398 } };
// Android tablet landscape with the taskbar (48): height again excludes it.
const ANDROID_TABLET_L = { window: { width: 1280, height: 800, scale: 2, fontScale: 1 }, insets: { top: 24, bottom: 48, left: 0, right: 0 }, frame: { height: 330, screenY: 800 - 378 } };

const nodeMock = () => ({ focus: jest.fn() });

function openWithKeyboard(device, element) {
  mockWindow = device.window;
  mockInsets = device.insets;
  let tree;
  act(() => {
    tree = create(element, { createNodeMock: nodeMock });
  });
  const show = listeners.keyboardWillShow ?? listeners.keyboardDidShow;
  act(() => show({ endCoordinates: device.frame }));
  return tree;
}

const host = (tree, id) => tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id)[0];
const flat = (node) => StyleSheet.flatten(node.props.style);
// The dialog's own scroll is the outermost ScrollView in the card.
const dialogScroll = (tree, dialogId) => host(tree, dialogId).findAllByType(ScrollView)[0];

function expectButtonsAboveKeyboard(tree, dialogId, buttonIds, device) {
  const keyboardTop = device.frame.screenY;
  const scrim = flat(host(tree, 'app-modal-overlay'));
  const card = flat(host(tree, dialogId));
  // The card lives inside the scrim's padding box; its bottom edge is the
  // box's bottom (sheet) or above it (centred card).
  const boxBottom = device.window.height - scrim.paddingBottom;
  expect(boxBottom).toBeLessThanOrEqual(keyboardTop);
  expect(card.maxHeight).toBeLessThanOrEqual(boxBottom - scrim.paddingTop);
  // The buttons are in the fixed footer, never scrolled away.
  const scroll = dialogScroll(tree, dialogId);
  buttonIds.forEach((id) => {
    expect(host(tree, id)).toBeTruthy();
    expect(scroll.findAll((n) => n.props.testID === id)).toHaveLength(0);
  });
}

const DIALOGS = [
  ['Weight log (A141)', () => <WeightLogModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} defaultUnit="kg" />, 'weight-log-modal', ['weight-log-save', 'weight-log-cancel']],
  ['Delete account (A150)', () => <DeleteAccountDialog isOpen onClose={jest.fn()} onDeleted={jest.fn()} />, 'delete-account-dialog', ['delete-account-submit', 'delete-account-cancel']],
  ['Add day (B225)', () => <AddDayModal isOpen onClose={jest.fn()} context={{ nextDayNumber: 4, dayLimit: 5, canAddDay: true }} day={null} onSubmit={jest.fn()} />, 'add-day-modal', ['day-modal-submit', 'day-modal-cancel']],
  [
    'Exercises filter "Show n" (B250)',
    () => {
      const items = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Move ${i + 1}`, primary_muscle_group: { name: ['Chest', 'Legs', 'Back', 'Core'][i % 4] }, equipment_type_id: (i % 3) + 1 }));
      const names = equipmentNameMap([{ id: 1, name: 'Dumbbell' }, { id: 2, name: 'Barbell' }, { id: 3, name: 'Cable' }]);
      return <ExerciseFilterSheet open facets={filterFacets(items, NO_FILTERS, names)} filters={NO_FILTERS} resultCount={30} onSelect={jest.fn()} onClose={jest.fn()} returnRef={{ current: null }} />;
    },
    'exercise-filter-sheet',
    ['exercise-filter-show'],
  ],
];

describe.each([
  ['iPhone', IPHONE],
  ['iPhone SE (375 × 667)', IPHONE_SE],
  ['iPhone SE (375 × 667) at fontScale 1.3', at13(IPHONE_SE)],
  ['iPhone at fontScale 1.3', at13(IPHONE)],
  ['Android phone (nav bar)', ANDROID],
  ['Android phone (nav bar) at fontScale 1.3', at13(ANDROID)],
  ['iPad landscape', IPAD_L],
  ['Android tablet landscape (taskbar)', ANDROID_TABLET_L],
])('ruling 12 on %s: the footer buttons sit above the keyboard top', (_, device) => {
  it.each(DIALOGS)('%s', (__, element, dialogId, buttonIds) => {
    const tree = openWithKeyboard(device, element());
    expectButtonsAboveKeyboard(tree, dialogId, buttonIds, device);
    act(() => tree.unmount());
  });
});

// Ruling 12, tablets in landscape (A142, A151): the form is taller than the
// room above the keyboard, so the body scrolls; the title stays pinned above
// the scroll (iOS scrolls the focused field into view, which used to push the
// title off the top with it).
describe.each([
  ['iPad landscape', IPAD_L],
  ['Android tablet landscape (taskbar)', ANDROID_TABLET_L],
])('ruling 12 on %s: a tall form scrolls under a pinned title', (_, device) => {
  it.each(DIALOGS.slice(0, 3))('%s', (__, element, dialogId) => {
    const tree = openWithKeyboard(device, element());
    const card = host(tree, dialogId);
    const title = card.props.accessibilityLabel;
    const titleNode = card.findAll((n) => n.type === Text && n.props.accessibilityRole === 'header' && n.props.children === title)[0];
    expect(titleNode).toBeTruthy();
    const scroll = dialogScroll(tree, dialogId);
    expect(scroll.findAll((n) => n === titleNode)).toHaveLength(0);
    expect(host(tree, 'app-modal-header').findAll((n) => n === titleNode)).toHaveLength(1);
    // The body is the scroll: it shrinks into the card's bounded height.
    expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({ flexShrink: 1 });
    expect(flat(card).maxHeight).toBeLessThan(device.window.height);
    act(() => tree.unmount());
  });
});
