// RN-SPEC-notifications N1 text and state rules.

// N1.2: "notification" when n = 1, else "notifications" (⚠N-3: loaded items only).
export function unreadSubtitle(count) {
  return `You have ${count} unread notification${count === 1 ? '' : 's'}.`;
}

// N1.2 body: the first matching state. ⚠N-2: the loader only with no items.
export function pageBodyState({ isLoading, notifications }) {
  const count = notifications?.length ?? 0;
  if (isLoading && count === 0) {
    return 'loading';
  }
  return count === 0 ? 'empty' : 'list';
}

export function showsLoadMore({ hasMore, notifications }) {
  return Boolean(hasMore) && (notifications?.length ?? 0) > 0;
}

// ⚠N-6: U+2026 on the page (the panel uses three dots).
export function loadMoreLabel(isLoading) {
  return isLoading ? 'Loading…' : 'Load More Notifications';
}

export const EMPTY_TITLE = 'No notifications';
// ⚠N-4: differs from the panel's message.
export const EMPTY_MESSAGE = 'You’re all caught up. New updates will appear here.';
