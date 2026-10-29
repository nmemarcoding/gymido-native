import { WEEKDAYS, isValidWeek, localDateKey } from './libraryFormat';

// T-102 (owner D1–D3 + UX ruling, RN-SPEC-home / RN-SPEC-workout dated 29 Oct
// 2026): this week's open misses and the Catch-up row. One rule set for
// Today and the Workout hub (web features/plans/utils/missedCatchUp.js).
// A miss = { weekdayName, planDay }, the most recent first. Pure.

const LIVE = 'This starts a live workout.';

// "{title or 'workout'}" of the headline, the row and the confirm.
export function missTitle(miss) {
  return miss?.planDay?.title || 'workout';
}

// Today: dashboard.missed_this_week as sent (server order = most recent first;
// a make-up clears its slot on the server).
export function dashboardMisses(dashboard) {
  return (dashboard?.missed_this_week ?? []).map((item) => ({ weekdayName: item?.weekday?.name ?? '', planDay: item?.plan_day ?? null }));
}

// The hub: GET /my-plans/current/week (no new call). Open = status 'missed',
// a workout day, a date before today (local); most recent first. A slot the
// server marks done (made up on another day) is not open. No /week → none.
export function weekMisses(week, now = new Date()) {
  if (!isValidWeek(week)) {
    return [];
  }
  const todayKey = localDateKey(now);
  return week
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item?.status === 'missed' && item?.is_workout_day && item?.plan_day && typeof item?.date === 'string' && item.date < todayKey)
    .sort((a, b) => b.item.date.localeCompare(a.item.date))
    .map(({ item, index }) => {
      const id = Number(item.weekday?.id);
      const weekday = WEEKDAYS[(id >= 1 && id <= 7 ? id : index + 1) - 1];
      return { weekdayName: weekday.name, planDay: item.plan_day };
    });
}

// T-113 table (owner; UX T113-rest-first-ruling, replaces T-102 §1): no
// Missed hero anywhere; on training / completed / rest days with an open
// miss, ONE Catch-up row names the most recent (misses[0]), more = the count
// left. `base` = setup | training | completed | rest (anything else, e.g. the
// hub's week complete, shows nothing). `hero` stays null (callers read it).
export function missedLayout(base, misses = []) {
  if (!misses.length || !['training', 'completed', 'rest'].includes(base)) {
    return { hero: null, catchUp: null };
  }
  return { hero: null, catchUp: { miss: misses[0], more: misses.length - 1 } };
}

// The row's two lines and its one SR label. Line 2 only when more > 0.
export function catchUpRowCopy({ miss, more }) {
  const title = missTitle(miss);
  const line2 = more > 0 ? `+${more} more missed this week` : null;
  const label = `Catch up on ${miss.weekdayName}'s ${title}.${line2 ? ` ${more} more missed this week.` : ''}`;
  return { line1: `Catch up: ${miss.weekdayName}'s ${title}`, line2, label };
}

function stateSentence(base, todayTitle) {
  switch (base) {
    case 'training':
      return `Today’s plan is ${todayTitle}.`;
    case 'completed':
      return `You’ve already done ${todayTitle} today.`;
    case 'rest':
      return 'Today is a rest day.';
    default:
      return '';
  }
}

// The T-80 confirm for a catch-up start. `title` defaults to the miss's.
export function catchUpConfirmCopy({ miss, base, todayTitle = '', title = missTitle(miss) }) {
  return {
    title: `Catch up on ${title}?`,
    body: [`You missed it on ${miss.weekdayName}.`, stateSentence(base, todayTitle), LIVE].filter(Boolean).join(' '),
  };
}
