import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, muscle } from '../../../shared/theme/tokens';
import {
  AVATAR_HUES,
  ClientFilter,
  activityOf,
  anyActivity,
  attentionOf,
  avatarHue,
  clientUnit,
  daysSinceLastWorkout,
  filterClients,
  filterCounts,
  inactivityLabel,
  initialsOf,
  inviteLabel,
  isOnTrack,
  needAttention,
  planNameOf,
  rowInitials,
  trainingDays,
  volumeInUnit,
  weekRatio,
  weekSentence,
  weekdayLabel,
} from './clientActivity';
import { sentenceCase, statusTone } from './clientFormat';
import ClientAvatar, { AVATAR_TINT } from './components/ClientAvatar';

// RN-SPEC-v2-phase6 §1 BE data rules + §2 avatars/names.

const DAYS = [
  { date: '2026-10-26', weekday: 'Mon', status: 'done' },
  { date: '2026-10-27', weekday: 'Tue', status: 'today' },
  { date: '2026-10-28', weekday: 'Wed', status: 'rest' },
  { date: '2026-10-29', weekday: 'Thu', status: 'upcoming' },
  { date: '2026-10-30', weekday: 'Fri', status: 'missed' },
  { date: '2026-10-31', weekday: 'Sat', status: 'rest' },
  { date: '2026-11-01', weekday: 'Sun', status: 'rest' },
];

function row(id, activity, client = { first_name: 'Alex', last_name: 'Kim' }) {
  const base = { id, client_user_id: id, status: 'active', client };
  return activity === undefined ? base : { ...base, client_activity: activity };
}

const plan = { enrollment_id: 1, workout_plan_id: 9, name: 'Upper / Lower Split' };

describe('avatar colour rule (v2-phase5 §1)', () => {
  it('user_id mod 6 over the fixed list', () => {
    expect(AVATAR_HUES).toEqual([muscle.chest, muscle.back, colors.teal, muscle.legs, muscle.arms, muscle.core]);
    expect(avatarHue(0)).toBe(muscle.chest);
    expect(avatarHue(7)).toBe(muscle.back);
    expect(avatarHue(12)).toBe(muscle.chest);
    expect(avatarHue(5)).toBe(muscle.core);
    expect(avatarHue('14')).toBe(colors.teal);
  });

  it('initials: first + last letter; no name → "?"; invitee name wins', () => {
    expect(initialsOf({ first_name: 'sara', last_name: 'lopez' })).toBe('SL');
    expect(initialsOf({ first_name: 'Maya' })).toBe('M');
    expect(initialsOf(null)).toBe('?');
    expect(rowInitials(row(3, undefined, null))).toBe('?');
    expect(rowInitials({ client_user_id: 3 })).toBe('?');
    expect(rowInitials({ client_user_id: 3, client: null, invitee: { first_name: 'Tom', last_name: 'Nguyen' } })).toBe('TN');
  });

  it('ClientAvatar: the hue at 16 % behind hue initials, decorative, fixed size', () => {
    let tree;
    act(() => {
      tree = create(<ClientAvatar userId={8} initials="AK" size={44} />);
    });
    const host = (testID) => tree.root.findAll((node) => typeof node.type === 'string' && node.props.testID === testID)[0];
    const circle = host('client-avatar-8');
    expect(circle.props.accessibilityElementsHidden).toBe(true);
    expect(StyleSheet.flatten(circle.props.style)).toEqual(expect.objectContaining({ width: 44, height: 44, borderRadius: 22 }));
    const tint = StyleSheet.flatten(host('client-avatar-tint').props.style);
    expect(tint).toEqual(expect.objectContaining({ opacity: AVATAR_TINT, backgroundColor: colors.teal }));
    expect(AVATAR_TINT).toBe(0.16);
    const text = tree.root.findAll((node) => node.type === 'Text')[0];
    expect(text.props.allowFontScaling).toBe(false);
    expect(StyleSheet.flatten(text.props.style).color).toBe(colors.teal);
  });
});

describe('invite labels (§2 names on pending invitations)', () => {
  it('the invitee name wins over a null client; else the v1 rule', () => {
    expect(inviteLabel({ client_user_id: 214, client: null, invitee: { first_name: 'Tom', last_name: 'Nguyen' } })).toBe('Tom Nguyen');
    expect(inviteLabel({ client_user_id: 214, client: null })).toBe('Unnamed client');
    expect(inviteLabel({ client_user_id: 214 })).toBe('Client #214');
    expect(inviteLabel({ client_user_id: 214, invitee: { first_name: ' ', last_name: '' } })).toBe('Client #214');
  });
});

describe('client_activity is feature-detected', () => {
  it('absent → null and nothing derived', () => {
    const plain = row(1);
    expect(activityOf(plain)).toBeNull();
    expect(anyActivity([plain])).toBe(false);
    expect(weekRatio(plain)).toBeNull();
    expect(weekSentence(plain)).toBeNull();
    expect(planNameOf(plain)).toBeNull();
    expect(isOnTrack(plain)).toBe(false);
    expect(attentionOf(plain)).toBeNull();
    expect(inactivityLabel(plain)).toBeNull();
  });

  it('ND-1: "{done}/{planned}", "{done} of {planned} this week · days" (status != rest); planned 0 hides', () => {
    const r = row(1, { current_plan: plan, week: { planned: 4, done: 3, missed: 0, days: DAYS }, last_completed_at: null });
    expect(anyActivity([row(2), r])).toBe(true);
    expect(weekRatio(r)).toEqual({ done: 3, planned: 4, text: '3/4' });
    expect(trainingDays(r).map((day) => day.status)).toEqual(['done', 'today', 'upcoming', 'missed']);
    expect(weekSentence(r)).toBe('3 of 4 this week · Mon Tue Thu Fri');
    const none = row(1, { current_plan: null, week: { planned: 0, done: 0, missed: 0, days: [] }, last_completed_at: null });
    expect(weekRatio(none)).toBeNull();
    expect(weekSentence(none)).toBeNull();
  });

  it('weekday label: device-locale short weekday of the date, else BE text', () => {
    expect(weekdayLabel({ date: '2026-10-26' })).toBe('Mon');
    expect(weekdayLabel({ weekday: 'Tue' })).toBe('Tue');
    expect(weekdayLabel({})).toBe('');
  });

  it('ND-2 On track = plan && missed 0; ND-6 plan name', () => {
    expect(isOnTrack(row(1, { current_plan: plan, week: { planned: 3, done: 1, missed: 0, days: [] } }))).toBe(true);
    expect(isOnTrack(row(1, { current_plan: plan, week: { planned: 3, done: 1, missed: 1, days: [] } }))).toBe(false);
    expect(isOnTrack(row(1, { current_plan: null, week: { planned: 0, done: 0, missed: 0, days: [] } }))).toBe(false);
    expect(planNameOf(row(1, { current_plan: plan }))).toBe('Upper / Lower Split');
  });

  it('ND-3/4: whole local days since last_completed_at; shown at ≥ 7', () => {
    const now = new Date(2026, 9, 29, 9, 0);
    const nine = row(1, { current_plan: plan, week: { planned: 3, done: 0, missed: 0, days: [] }, last_completed_at: new Date(2026, 9, 20, 23, 0).toISOString() });
    expect(daysSinceLastWorkout(nine, now)).toBe(9);
    expect(inactivityLabel(nine, now)).toBe('No workout in 9 days');
    const six = row(1, { current_plan: plan, last_completed_at: new Date(2026, 9, 23, 8, 0).toISOString() });
    expect(inactivityLabel(six, now)).toBeNull();
    expect(daysSinceLastWorkout(row(1, { last_completed_at: 'nope' }), now)).toBeNull();
  });

  it('Need attention: missed this week first, else no plan', () => {
    const missed = row(1, { current_plan: plan, week: { planned: 3, done: 1, missed: 2, days: [] } });
    const noPlan = row(2, { current_plan: null, week: { planned: 0, done: 0, missed: 0, days: [] } });
    const fine = row(3, { current_plan: plan, week: { planned: 3, done: 3, missed: 0, days: [] } });
    expect(attentionOf(missed)).toEqual({ kind: 'missed', text: 'Missed 2 this week' });
    expect(attentionOf(noPlan)).toEqual({ kind: 'noPlan', text: 'No active plan' });
    expect(needAttention([missed, noPlan, fine, row(4)]).map((entry) => entry.row.id)).toEqual([1, 2]);
  });
});

describe('ND-8 filters and search', () => {
  const alex = row(1, { current_plan: plan, week: { planned: 4, done: 3, missed: 0, days: [] } });
  const sara = row(2, { current_plan: { name: 'Full Body Basics' }, week: { planned: 3, done: 0, missed: 2, days: [] } }, { first_name: 'Sara', last_name: 'Lopez' });
  const invite = { id: 9, client_user_id: 30, client: null, invitee: { first_name: 'Jordan', last_name: 'Park' } };

  it('All = clients + invited; Active = missed 0; Missed = ≥ 1; counts from the loaded list', () => {
    expect(filterClients({ clients: [alex, sara], invited: [invite], filter: ClientFilter.all })).toEqual({ clients: [alex, sara], invited: [invite] });
    expect(filterClients({ clients: [alex, sara], invited: [invite], filter: ClientFilter.active })).toEqual({ clients: [alex], invited: [] });
    expect(filterClients({ clients: [alex, sara], invited: [invite], filter: ClientFilter.missed })).toEqual({ clients: [sara], invited: [] });
    // Web parity (PM, 27 Oct; TRAINER-CLIENTS audit b2 chips "All · Active · Missed · Invited"):
    // Invited = the trainer's pending invitations only.
    expect(filterClients({ clients: [alex, sara], invited: [invite], filter: ClientFilter.invited })).toEqual({ clients: [], invited: [invite] });
    expect(filterCounts({ clients: [alex, sara], invited: [invite] })).toEqual({ all: 3, active: 1, missed: 1, invited: 1 });
  });

  it('without the data, Active = the relationship status (every loaded row)', () => {
    const plain = [row(1), row(2)];
    expect(filterClients({ clients: plain, invited: [], filter: ClientFilter.active }).clients).toHaveLength(2);
  });

  it('search matches the name or the plan name, case-insensitive; invitees by their label', () => {
    expect(filterClients({ clients: [alex, sara], invited: [invite], filter: 'all', query: 'lopez' }).clients).toEqual([sara]);
    expect(filterClients({ clients: [alex, sara], invited: [invite], filter: 'all', query: 'upper' }).clients).toEqual([alex]);
    expect(filterClients({ clients: [alex, sara], invited: [invite], filter: 'all', query: 'jordan' })).toEqual({ clients: [], invited: [invite] });
    expect(filterClients({ clients: [alex], invited: [], filter: 'all', query: '  ' }).clients).toEqual([alex]);
  });
});

describe('VOLUME RULE helpers and pill helpers', () => {
  it('client unit: current, else goal, unknown → kg; *_kg in that unit; absent → null', () => {
    expect(clientUnit({ current_weight_unit: 'lb' })).toBe('lb');
    expect(clientUnit({ goal_weight_unit: 'lb' })).toBe('lb');
    expect(clientUnit({ current_weight_unit: 'stone' })).toBe('kg');
    expect(clientUnit(null)).toBe('kg');
    expect(volumeInUnit(100, 'kg')).toBe(100);
    expect(Math.round(volumeInUnit(100, 'lb'))).toBe(220);
    expect(volumeInUnit(undefined, 'kg')).toBeNull();
    expect(volumeInUnit(null, 'kg')).toBeNull();
  });

  it('sentence case + X-4 status tones', () => {
    expect(sentenceCase('completed')).toBe('Completed');
    expect(sentenceCase('')).toBe('');
    expect(statusTone('active')).toBe('active');
    expect(statusTone('completed')).toBe('completed');
    expect(statusTone('pending')).toBe('gold');
    expect(statusTone('replaced')).toBe('neutral');
    expect(statusTone('ended')).toBe('neutral');
    expect(statusTone('cancelled')).toBe('neutral');
  });
});
