import { rowTapActions } from './NotificationItem';
import {
  EMPTY_MESSAGE,
  EMPTY_TITLE,
  loadMoreLabel,
  ERROR_MESSAGE,
  ERROR_TITLE,
  pageBodyState,
  showsLoadMore,
  unreadSubtitle,
} from './notificationsPageFormat';

jest.mock('../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../shell/shellUiStore', () => ({ closePanel: jest.fn() }));
jest.mock('../../shared/config/env', () => ({ env: { appEnv: 'development' } }));

describe('Notifications page (N1)', () => {
  it('pluralises the unread subtitle', () => {
    expect(unreadSubtitle(0)).toBe('You have 0 unread notifications.');
    expect(unreadSubtitle(1)).toBe('You have 1 unread notification.');
    expect(unreadSubtitle(12)).toBe('You have 12 unread notifications.');
  });

  it('shows the loader only when loading with no items (⚠N-2)', () => {
    expect(pageBodyState({ isLoading: true, notifications: [] })).toBe('loading');
    expect(pageBodyState({ isLoading: true, notifications: [{ id: 1 }] })).toBe('list');
    expect(pageBodyState({ isLoading: false, notifications: [] })).toBe('empty');
    expect(pageBodyState({ isLoading: false, notifications: [{ id: 1 }] })).toBe('list');
  });

  // Audit b1 X4: an error with no items (not loading) is the error state.
  it('an error with no items loaded and not loading is the error state; with items or while loading it is not', () => {
    const error = new Error('500');
    expect(pageBodyState({ isLoading: false, notifications: [], error })).toBe('error');
    expect(pageBodyState({ isLoading: true, notifications: [], error })).toBe('loading');
    expect(pageBodyState({ isLoading: false, notifications: [{ id: 1 }], error })).toBe('list');
    expect(ERROR_TITLE).toBe("Couldn't load notifications");
    expect(ERROR_MESSAGE).toBe('Please try again.');
  });

  it('shows load more only with items and more pages', () => {
    expect(showsLoadMore({ hasMore: true, notifications: [{ id: 1 }] })).toBe(true);
    expect(showsLoadMore({ hasMore: true, notifications: [] })).toBe(false);
    expect(showsLoadMore({ hasMore: false, notifications: [{ id: 1 }] })).toBe(false);
  });

  it('uses the page copy (⚠N-4, ⚠N-6)', () => {
    expect(loadMoreLabel(false)).toBe('Load More Notifications');
    expect(loadMoreLabel(true)).toBe('Loading…');
    expect(EMPTY_TITLE).toBe('No notifications');
    expect(EMPTY_MESSAGE).toBe('You’re all caught up. New updates will appear here.');
  });

  it('marks unread rows read and routes invitations to My trainer', () => {
    expect(rowTapActions({ read_at: null, type: 'workout_completed' })).toEqual({ markRead: true, openMyTrainer: false });
    expect(rowTapActions({ read_at: 'x', type: 'trainer_invitation' })).toEqual({ markRead: false, openMyTrainer: true });
  });
});
