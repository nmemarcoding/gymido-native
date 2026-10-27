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

// v2 L ND2 (approved): the phone page groups rows under "Today" / "Earlier"
// by the existing created_at in the DEVICE's local day. Order is kept; an
// unreadable time goes to Earlier; an empty group is left out.
export function groupByLocalDay(notifications, now = new Date(), parse = (value) => new Date(value)) {
  const today = [];
  const earlier = [];
  (notifications ?? []).forEach((item) => {
    const date = item?.created_at ? parse(item.created_at) : null;
    const valid = date instanceof Date && !Number.isNaN(date.getTime());
    const sameDay =
      valid &&
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    (sameDay ? today : earlier).push(item);
  });
  return [
    { key: 'today', label: 'Today', items: today },
    { key: 'earlier', label: 'Earlier', items: earlier },
  ].filter((group) => group.items.length > 0);
}

// The tablet hero's count badge: the loaded unread count, capped "99+";
// hidden at 0.
export function unreadBadge(count) {
  if (!count || count < 1) {
    return null;
  }
  return count > 99 ? '99+' : String(count);
}

// §3 a11y: an unread row's name = "Notification: {title}, unread".
export function rowAccessibilityLabel(item) {
  const base = item?.title ? `Notification: ${item.title}` : 'Notification';
  return item?.read_at ? base : `${base}, unread`;
}
