import { convertWeight } from '../../../shared/format/weight';
import { colors, muscle } from '../../../shared/theme/tokens';
import { clientDisplayName, clientRowLabel } from './clientFormat';

// RN-SPEC-v2-phase6 §1 (BE data, confirmed 27 Oct): active rows of
// GET /trainer/clients may carry `client_activity`. Everything built on it is
// FEATURE-DETECTED: a row without the field shows none of it (no placeholder,
// no gap), and nothing here guesses a value.

// RN-SPEC-v2-phase5 §1 avatar colour rule (UX §8.2): user_id mod 6 over this
// fixed list; the circle is the colour at 16 %, the initials the colour.
export const AVATAR_HUES = Object.freeze([muscle.chest, muscle.back, colors.teal, muscle.legs, muscle.arms, muscle.core]);

export function avatarHue(userId) {
  const id = Math.abs(Math.trunc(Number(userId)));
  return AVATAR_HUES[Number.isFinite(id) ? id % AVATAR_HUES.length : 0];
}

// §2 X-2: first letter of first + last name; "Unnamed client" (no name) → "?".
export function initialsOf(person) {
  const letters = [person?.first_name, person?.last_name]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .map((part) => part[0].toUpperCase());
  return letters.length ? letters.join('') : '?';
}

// The initials of a relationship row: the client's (or a pending invite's
// invitee) name; "Client #{id}" and "Unnamed client" rows have none → "?".
export function rowInitials(row) {
  if (hasInviteeName(row)) {
    return initialsOf(row.invitee);
  }
  return row?.client ? initialsOf(row.client) : '?';
}

function hasInviteeName(row) {
  return Boolean(row?.invitee) && clientDisplayName(row.invitee) !== 'Unnamed client';
}

// §2 names on pending invitations (approved): the invitee name WINS over a
// null client; else the v1 rule (clientRowLabel).
export function inviteLabel(request) {
  return hasInviteeName(request) ? clientDisplayName(request.invitee) : clientRowLabel(request);
}

// The parsed activity of an active row, or null when BE hasn't sent it.
export function activityOf(row) {
  const activity = row?.client_activity;
  if (!activity || typeof activity !== 'object') {
    return null;
  }
  const week = activity.week && typeof activity.week === 'object' ? activity.week : null;
  const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  return {
    plan: activity.current_plan ?? null,
    planned: week ? number(week.planned) : 0,
    done: week ? number(week.done) : 0,
    missed: week ? number(week.missed) : 0,
    days: Array.isArray(week?.days) ? week.days : [],
    lastCompletedAt: activity.last_completed_at ?? null,
  };
}

export function anyActivity(rows) {
  return rows.some((row) => activityOf(row) !== null);
}

export function planNameOf(row) {
  const name = activityOf(row)?.plan?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

// ND-2: On track = an active plan AND no missed workout this week.
export function isOnTrack(row) {
  const activity = activityOf(row);
  return Boolean(activity?.plan) && activity.missed === 0;
}

export function missedOf(row) {
  return activityOf(row)?.missed ?? 0;
}

// The weekday label of one `days` entry: the device-locale short weekday of
// its date, else BE's `weekday` text.
export function weekdayLabel(day) {
  if (typeof day?.date === 'string') {
    const [y, m, d] = day.date.slice(0, 10).split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    if (!Number.isNaN(date.getTime()) && y) {
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    }
  }
  return typeof day?.weekday === 'string' ? day.weekday : '';
}

// The training days of the week (status != rest), in order.
export function trainingDays(row) {
  return (activityOf(row)?.days ?? []).filter((day) => day && day.status && day.status !== 'rest');
}

// ND-1 copy. planned 0 → null (the weekly bits are hidden).
export function weekRatio(row) {
  const activity = activityOf(row);
  if (!activity || activity.planned <= 0) {
    return null;
  }
  return { done: activity.done, planned: activity.planned, text: `${activity.done}/${activity.planned}` };
}

export function weekSentence(row) {
  const ratio = weekRatio(row);
  if (!ratio) {
    return null;
  }
  const days = trainingDays(row).map(weekdayLabel).filter(Boolean);
  const base = `${ratio.done} of ${ratio.planned} this week`;
  return days.length ? `${base} · ${days.join(' ')}` : base;
}

// ND-3/ND-4: whole local days since the last completed workout; shown when
// n ≥ 7. null when unknown.
export function daysSinceLastWorkout(row, now = new Date()) {
  const value = activityOf(row)?.lastCompletedAt;
  if (!value) {
    return null;
  }
  const last = new Date(value);
  if (Number.isNaN(last.getTime())) {
    return null;
  }
  const startOf = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((startOf(now) - startOf(last)) / 86400000);
}

export function inactivityLabel(row, now = new Date()) {
  const days = daysSinceLastWorkout(row, now);
  return days !== null && days >= 7 ? `No workout in ${days} days` : null;
}

// T-121 M3 (UX option B): the row's reason, in front of the plan name
// ("Missed 2 · Upper / Lower Split"); the short "Missed n" is web's row copy
// (PM 29 Oct; the Need attention card keeps "Missed n this week").
export function rowReason(row, now = new Date()) {
  const missed = missedOf(row);
  if (missed > 0) {
    return `Missed ${missed}`;
  }
  return inactivityLabel(row, now);
}

// T-121 M3: the right side of a row without a ring this week: "On track"
// (green), else "Active".
export function rowStatusChip(row) {
  return isOnTrack(row) ? { label: 'On track', tone: 'completed' } : { label: 'Active', tone: 'active' };
}

// T-121 M2 (RN-SPEC-v2-phase6 ND-5): round(Σ done ÷ Σ planned × 100) over the
// active clients this week; null when nothing is planned (the tile hides).
export function weekAdherence(rows) {
  let planned = 0;
  let done = 0;
  rows.forEach((row) => {
    const activity = activityOf(row);
    if (activity) {
      planned += activity.planned;
      done += activity.done;
    }
  });
  return planned > 0 ? Math.round((done / planned) * 100) : null;
}

// Approved "Need attention" (screen-map §C8): clients with a missed workout
// this week, or no plan. Only rows that carry the data can qualify.
export function attentionOf(row) {
  const activity = activityOf(row);
  if (!activity) {
    return null;
  }
  if (activity.missed > 0) {
    return { kind: 'missed', text: `Missed ${activity.missed} this week` };
  }
  if (!activity.plan) {
    return { kind: 'noPlan', text: 'No active plan' };
  }
  return null;
}

export function needAttention(rows) {
  return rows.map((row) => ({ row, reason: attentionOf(row) })).filter((entry) => entry.reason);
}

// ND-8 filters. `invited` are the trainer's pending invitations (ND-9 rows).
// Web parity (PM, 27 Oct): Invited = the trainer's pending invitations only.
export const ClientFilter = Object.freeze({ all: 'all', active: 'active', missed: 'missed', invited: 'invited' });

function matches(row, query, label) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const plan = planNameOf(row);
  return label.toLowerCase().includes(needle) || Boolean(plan && plan.toLowerCase().includes(needle));
}

export function filterClients({ clients, invited, filter, query = '' }) {
  const active = clients.filter((row) => matches(row, query, clientRowLabel(row)));
  const pending = invited.filter((row) => matches(row, query, inviteLabel(row)));
  if (filter === ClientFilter.active) {
    // With the data: active relationship and no missed workout this week;
    // without it, the relationship status only (every loaded row is active).
    return { clients: active.filter((row) => missedOf(row) === 0), invited: [] };
  }
  if (filter === ClientFilter.missed) {
    return { clients: active.filter((row) => missedOf(row) >= 1), invited: [] };
  }
  if (filter === ClientFilter.invited) {
    return { clients: [], invited: pending };
  }
  return { clients: active, invited: pending };
}

export function filterCounts({ clients, invited }) {
  return {
    all: clients.length + invited.length,
    active: clients.filter((row) => missedOf(row) === 0).length,
    missed: clients.filter((row) => missedOf(row) >= 1).length,
    invited: invited.length,
  };
}

// The client's unit for volumes (VOLUME RULE, RN-SPEC-v2-phase3): profile
// current_weight_unit, else goal_weight_unit; unknown → kg.
export function clientUnit(profile) {
  const unit = profile?.current_weight_unit || profile?.goal_weight_unit;
  return unit === 'lb' ? 'lb' : 'kg';
}

// A *_kg volume in the client's unit, or null when the field is absent.
export function volumeInUnit(valueKg, unit) {
  if (valueKg === null || valueKg === undefined || Number.isNaN(Number(valueKg))) {
    return null;
  }
  return convertWeight(Number(valueKg), 'kg', unit);
}
