import { StyleSheet, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import PillButton from '../../shared/components/PillButton';
import { colors, radii, textScale, typography } from '../../shared/theme/tokens';
import NotificationItem, { DEFAULT_TYPE, TYPE_STYLES } from './NotificationItem';
import NotificationPanel from './NotificationPanel';
import NotificationsScreen, { NOTIFICATIONS_GLOW_TABLET } from './NotificationsScreen';
import { useNotificationStore } from './notificationStore';
import { groupByLocalDay, rowAccessibilityLabel, unreadBadge } from './notificationsPageFormat';

// v2 Phase 5 L (p5l): the Notifications page (ND2 Today/Earlier on phones,
// ND3 Delete always visible, the tablet hero + cards), the row a11y names and
// the panel's All / Unread tabs.

const mockShellPage = jest.fn();
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('../../shared/components/GradientFill', () => () => null);
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../shell/ShellPage', () => (props) => {
  mockShellPage(props);
  return props.children;
});
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../shell/shellUiStore', () => ({
  closePanel: jest.fn(),
  useShellUiStore: (select) => select({ bellFrame: null }),
}));
jest.mock('../../shared/config/env', () => ({ env: { appEnv: 'development' } }));

const { openShellPath } = require('../shell/shellLinks');
const { closePanel } = require('../shell/shellUiStore');

const flat = (node) => StyleSheet.flatten(node.props.style);
const hostAll = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const host = (tree, id) => hostAll(tree, id)[0];
const textOf = (node) =>
  node
    .findAll((n) => n.type === 'Text')
    .map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''))
    .join('');

// In-order text of a node (nested Text included).
const deepText = (node) =>
  []
    .concat(node.children ?? [])
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : deepText(child)))
    .join('');

function setWindow(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 1000, scale: 2, fontScale });
}

const actions = {
  fetchNotifications: jest.fn(),
  loadMore: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
  markNotificationAsRead: jest.fn(),
  removeNotification: jest.fn(),
};

const NOW = new Date();
const earlierDay = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 3, 12).toISOString();
const ITEMS = [
  { id: 1, type: 'trainer_invitation', title: 'Coach K wants to coach you', body: 'Open My trainer page to answer.', created_at: NOW.toISOString(), read_at: null },
  { id: 2, type: 'workout_completed', title: 'Workout complete', body: 'You finished today’s workout.', created_at: NOW.toISOString(), read_at: '2026-10-20' },
  { id: 3, type: 'goal_achieved', title: 'Goal achieved', body: 'Nice work.', created_at: earlierDay, read_at: null },
];

function seed(overrides = {}) {
  const notifications = overrides.notifications ?? ITEMS;
  useNotificationStore.setState({
    notifications,
    unreadCount: notifications.filter((item) => !item.read_at).length,
    isLoading: false,
    hasMore: false,
    ...actions,
    ...overrides,
  });
}

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
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
});
beforeEach(() => setWindow(390));

describe('helpers', () => {
  it('groupByLocalDay: Today = the device day; the rest (and unreadable times) Earlier; order kept; empty groups dropped', () => {
    const now = new Date(2026, 9, 27, 9, 0);
    const items = [
      { id: 'a', created_at: new Date(2026, 9, 27, 0, 5).toISOString() },
      { id: 'b', created_at: new Date(2026, 9, 26, 23, 59).toISOString() },
      { id: 'c', created_at: 'nonsense' },
      { id: 'd', created_at: new Date(2026, 9, 27, 8, 0).toISOString() },
      { id: 'e' },
    ];
    expect(groupByLocalDay(items, now).map((group) => [group.label, group.items.map((item) => item.id)])).toEqual([
      ['Today', ['a', 'd']],
      ['Earlier', ['b', 'c', 'e']],
    ]);
    expect(groupByLocalDay([items[0]], now).map((group) => group.key)).toEqual(['today']);
    expect(groupByLocalDay([], now)).toEqual([]);
  });

  it('unreadBadge: hidden at 0, the count, capped "99+"', () => {
    expect([unreadBadge(0), unreadBadge(1), unreadBadge(99), unreadBadge(100)]).toEqual([null, '1', '99', '99+']);
  });

  it('row names: "Notification: {title}, unread" / "Notification: {title}"', () => {
    expect(rowAccessibilityLabel({ title: 'Hi', read_at: null })).toBe('Notification: Hi, unread');
    expect(rowAccessibilityLabel({ title: 'Hi', read_at: 'x' })).toBe('Notification: Hi');
    expect(rowAccessibilityLabel({ read_at: null })).toBe('Notification, unread');
  });

  it('icon tiles: the colour tint + colour per type; the default bell (info)', () => {
    expect(TYPE_STYLES.trainer_invitation).toMatchObject({ tint: colors.tealTint, color: colors.teal, glyph: 'person' });
    expect(TYPE_STYLES.workout_completed).toMatchObject({ tint: colors.goldTint, color: colors.gold, glyph: 'workout' });
    expect(TYPE_STYLES.goal_achieved.glyph).toBe('trophy');
    expect(DEFAULT_TYPE).toMatchObject({ tint: colors.infoTint, color: colors.info, glyph: 'bell' });
  });
});

describe('Notifications page, phone (UX L §Notifications)', () => {
  it('the unread line with the count in gold 700 (a polite live region) and Mark all as read (glass compact 44)', () => {
    seed();
    const tree = render(<NotificationsScreen />);
    const line = host(tree, 'notifications-unread');
    expect(deepText(line)).toBe('You have 2 unread notifications.');
    expect(line.props.accessibilityLiveRegion).toBe('polite');
    const count = line.findAll((node) => node.type === 'Text' && node !== line)[0];
    expect(flat(count)).toMatchObject({ color: colors.gold, fontFamily: 'Geist-Bold' });
    const markAll = tree.root.find((node) => node.type === PillButton && node.props.testID === 'notifications-mark-all');
    expect(markAll.props).toMatchObject({ variant: 'secondary', size: 'compact' });
    act(() => markAll.props.onPress());
    expect(actions.markAllNotificationsAsRead).toHaveBeenCalled();
  });

  it('ND2: "Today" / "Earlier" headings, each with its own list card', () => {
    seed();
    const tree = render(<NotificationsScreen />);
    const today = host(tree, 'notifications-group-today');
    const earlier = host(tree, 'notifications-group-earlier');
    expect(textOf(today)).toContain('Today');
    expect(hostAll(tree, 'notification-row-1')).toHaveLength(1);
    expect(today.findAll((node) => node.props.testID === 'notification-row-3')).toHaveLength(0);
    expect(earlier.findAll((node) => node.props.testID === 'notification-row-3' && typeof node.type === 'string')).toHaveLength(1);
  });

  it('no unread: Mark all hidden; the line reads 0', () => {
    seed({ notifications: [ITEMS[1]] });
    const tree = render(<NotificationsScreen />);
    expect(hostAll(tree, 'notifications-mark-all')).toHaveLength(0);
    expect(deepText(host(tree, 'notifications-unread'))).toBe('You have 0 unread notifications.');
  });

  it('rows: unread = gold dot + 600 title; read = muted title and body, no dot', () => {
    seed();
    const tree = render(<NotificationsScreen />);
    expect(hostAll(tree, 'notification-dot-1')).toHaveLength(1);
    expect(hostAll(tree, 'notification-dot-2')).toHaveLength(0);
    expect(flat(host(tree, 'notification-dot-1')).backgroundColor).toBe(colors.gold);
    expect(flat(host(tree, 'notification-tile-1'))).toMatchObject({ width: 40, borderRadius: radii.sm, backgroundColor: colors.tealTint });
    expect(flat(host(tree, 'notification-tile-2')).backgroundColor).toBe(colors.fillSkeleton);
  });

  it('a row tap marks it read; an invitation also closes the panel and opens My trainer; others route nowhere', () => {
    seed();
    const tree = render(<NotificationsScreen />);
    const row = (id) => tree.root.find((node) => node.props.testID === `notification-row-${id}` && node.props.onPress);
    expect(row(1).props.accessibilityLabel).toBe('Notification: Coach K wants to coach you, unread');
    expect(row(2).props.accessibilityLabel).toBe('Notification: Workout complete');
    act(() => row(1).props.onPress());
    expect(actions.markNotificationAsRead).toHaveBeenCalledWith(1);
    expect(closePanel).toHaveBeenCalled();
    expect(openShellPath).toHaveBeenCalledWith('/my-trainer');
    jest.clearAllMocks();
    act(() => row(2).props.onPress());
    expect(actions.markNotificationAsRead).not.toHaveBeenCalled();
    expect(openShellPath).not.toHaveBeenCalled();
  });

  it('ND3 / phone reveal kept visible: Delete is its own 32 button (44 hit), not inside the row button; it removes the row', () => {
    seed();
    const tree = render(<NotificationsScreen />);
    const del = tree.root.find((node) => node.props.testID === 'notification-delete-1' && node.props.onPress);
    expect(del.props.accessibilityLabel).toBe('Delete notification');
    expect(del.props.hitSlop).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
    const style = StyleSheet.flatten(del.props.style({ pressed: false }));
    expect(style).toMatchObject({ width: 32, height: 32, backgroundColor: colors.fillGlass });
    expect(style.opacity).toBeUndefined();
    const rowButton = tree.root.find((node) => node.props.testID === 'notification-row-1' && node.props.onPress);
    expect(rowButton.findAll((node) => node.props.testID === 'notification-delete-1')).toHaveLength(0);
    act(() => del.props.onPress());
    expect(actions.removeNotification).toHaveBeenCalledWith(1);
  });

  it('Load more: glass secondary full width; while loading "Loading…" and disabled', () => {
    seed({ hasMore: true, isLoading: true });
    const tree = render(<NotificationsScreen />);
    const more = tree.root.find((node) => node.type === PillButton && node.props.testID === 'notifications-load-more');
    expect(more.props).toMatchObject({ title: 'Loading…', disabled: true, variant: 'secondary', fullWidth: true });
  });
});

describe('Notifications page, tablet (UX L §Tablet: Notifications)', () => {
  beforeEach(() => setWindow(834));

  it('the hero card: gold bell tile 96 with the count badge (aria-hidden), the line, Mark all; the gold page glow', () => {
    seed();
    const tree = render(<NotificationsScreen />);
    expect(mockShellPage.mock.calls.at(-1)[0].glow).toBe(NOTIFICATIONS_GLOW_TABLET);
    expect(flat(host(tree, 'notifications-hero'))).toMatchObject({ borderRadius: radii.xxxl, flexDirection: 'row' });
    const tile = host(tree, 'notifications-bell-tile');
    expect(tile.props.accessibilityElementsHidden).toBe(true);
    expect(flat(tile)).toMatchObject({ width: 96, height: 96 });
    expect(textOf(host(tree, 'notifications-badge'))).toBe('2');
    expect(flat(host(tree, 'notifications-badge'))).toMatchObject({ borderColor: colors.gold, backgroundColor: colors.ground });
  });

  it('the badge hides at 0 and caps at "99+"', () => {
    seed({ notifications: [ITEMS[1]] });
    let tree = render(<NotificationsScreen />);
    expect(hostAll(tree, 'notifications-badge')).toHaveLength(0);
    seed({ notifications: ITEMS, unreadCount: 120 });
    tree = render(<NotificationsScreen />);
    expect(textOf(host(tree, 'notifications-badge'))).toBe('99+');
  });

  it('rows are cards (no day headings): unread = gold line edge + wash shown; read = hairline, wash hidden; Delete 44', () => {
    seed();
    const tree = render(<NotificationsScreen />);
    expect(hostAll(tree, 'notifications-group-today')).toHaveLength(0);
    expect(flat(host(tree, 'notification-item-1'))).toMatchObject({ borderRadius: radii.xl, borderColor: colors.goldLine });
    expect(flat(host(tree, 'notification-item-2'))).toMatchObject({ borderColor: colors.hairline, backgroundColor: colors.surface });
    expect(flat(host(tree, 'notification-tile-1'))).toMatchObject({ width: 52, borderRadius: radii.md });
    const del = tree.root.find((node) => node.props.testID === 'notification-delete-2' && node.props.onPress);
    expect(StyleSheet.flatten(del.props.style({ pressed: false }))).toMatchObject({ width: 44, height: 44, backgroundColor: colors.fillWell });
    expect(del.props.hitSlop).toBeUndefined();
  });
});

describe('large text (UX §9)', () => {
  it.each([
    [390, 1],
    [390, 2],
    [390, 3.1],
    [834, 3.1],
  ])('%s wide at %s×: every text capped, nothing cut to one line; the tablet hero stacks past 1.3', (width, scale) => {
    setWindow(width, scale);
    seed();
    const tree = render(<NotificationsScreen />);
    tree.root
      .findAll((node) => node.type === 'Text' && node.parent?.type !== 'Text' && typeof node.parent?.type !== 'string')
      .forEach((node) => {
        expect(node.props.numberOfLines === undefined || node.props.numberOfLines >= 2).toBe(true);
      });
    if (width >= 768) {
      expect(flat(host(tree, 'notifications-hero')).flexDirection).toBe(scale > textScale.reflowAbove ? 'column' : 'row');
    }
  });
});

describe('the bell panel', () => {
  it('All / Unread are tabs with the selected state in a tablist; rows drop the tablet card look', () => {
    seed();
    const tree = render(<NotificationPanel />);
    const tabs = tree.root.findAll((node) => node.props.accessibilityRole === 'tab' && node.props.onPress);
    expect(tabs.map((tab) => [tab.props.accessibilityLabel, tab.props.accessibilityState.selected])).toEqual([
      ['Show all notifications', true],
      ['Show unread notifications', false],
    ]);
    expect(tree.root.findAll((node) => node.props.accessibilityRole === 'tablist')).not.toHaveLength(0);
    tree.root.findAllByType(NotificationItem).forEach((item) => expect(item.props.tablet).toBeUndefined());
  });

  // T-61 B: the panel eyebrow is the kit Eyebrow (caption 12/600 gold,
  // sentence case), not v1 tracked caps.
  it('the eyebrow is the sentence-case kit Eyebrow: "Notifications", 12/600 gold, no caps or tracking', () => {
    seed();
    const tree = render(<NotificationPanel />);
    const eyebrow = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Notifications');
    expect(eyebrow).toHaveLength(1);
    const style = StyleSheet.flatten(eyebrow[0].props.style);
    expect(style).toMatchObject({ ...typography.eyebrow, fontSize: 12, color: colors.gold });
    expect(style.textTransform).toBeUndefined();
    expect(style.letterSpacing ?? 0).toBe(0);
  });
});

// p5fix (review LOW): the unread live region is Android-only, so iOS
// announces the new line when the count changes (e.g. after Mark all as read).
describe('p5fix: unread count announcement', () => {
  const { AccessibilityInfo, Platform } = require('react-native');
  const realOS = Platform.OS;
  afterEach(() => {
    Platform.OS = realOS;
  });

  it.each([
    ['ios', 1],
    ['android', 0],
  ])('%s: a changed count is announced %s time(s); the first render is not', (os, times) => {
    Platform.OS = os;
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    seed();
    render(<NotificationsScreen />);
    expect(spy).not.toHaveBeenCalled();
    act(() => useNotificationStore.setState({ unreadCount: 0 }));
    expect(spy).toHaveBeenCalledTimes(times);
    if (times) {
      expect(spy).toHaveBeenCalledWith('You have 0 unread notifications.');
    }
    spy.mockRestore();
  });
});
