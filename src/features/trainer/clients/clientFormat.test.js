import { formatDateWithOffset } from '../../../shared/time/format';
import {
  clientDisplayName,
  clientRowLabel,
  formatDuration,
  formatSessionDetail,
  formatSex,
  formatSigned,
  formatTarget,
  formatWeight,
  isAwaitingMyResponse,
  weightDelta,
} from './clientFormat';

describe('client labels (§C1.1)', () => {
  it('builds display names and tells absent from null', () => {
    expect(clientDisplayName({ first_name: ' Asad ', last_name: '' })).toBe('Asad');
    expect(clientDisplayName({})).toBe('Unnamed client');
    expect(clientRowLabel({ client_user_id: 7 })).toBe('Client #7');
    expect(clientRowLabel({ client_user_id: 7, client: null })).toBe('Unnamed client');
    expect(clientRowLabel({ client_user_id: 7, client: { first_name: 'Reza', last_name: 'K' } })).toBe('Reza K');
  });

  it('finds requests awaiting the trainer', () => {
    expect(isAwaitingMyResponse({ status: 'pending', requested_by: 'client' }, 'trainer')).toBe(true);
    expect(isAwaitingMyResponse({ status: 'pending', requested_by: 'trainer' }, 'trainer')).toBe(false);
    expect(isAwaitingMyResponse({ status: 'active', requested_by: 'client' }, 'trainer')).toBe(false);
  });
});

describe('number formats', () => {
  it('formats weights with at most 1 decimal and grouping', () => {
    expect(formatWeight(1234.56, 'lb')).toBe('1,234.6 lb');
    expect(formatWeight(80, '')).toBe('80');
    expect(formatWeight(null, 'kg')).toBe('—');
    expect(formatWeight('x', 'kg')).toBe('—');
  });

  it('signs deltas only above 0 and needs matching units', () => {
    const a = { weight_value: 80, weight_unit: 'kg' };
    const b = { weight_value: 78.5, weight_unit: 'KG' };
    expect(formatSigned(weightDelta(a, b))).toBe('-1.5 KG');
    expect(formatSigned(weightDelta(b, a))).toBe('+1.5 kg');
    expect(formatSigned(weightDelta(a, a))).toBe('—');
    expect(weightDelta(a, { weight_value: 170, weight_unit: 'lb' })).toBeNull();
  });

  it('formats sessions, durations and targets', () => {
    expect(formatSessionDetail({ duration_seconds: 0 })).toBe('0 min');
    expect(formatSessionDetail({ duration_seconds: 2700, total_volume: 1200 })).toMatch(/^45 min · 1.?200 volume$/);
    expect(formatSessionDetail({})).toBe('No details recorded');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(150)).toBe('3 min');
    expect(formatTarget(8, 12)).toBe('8-12');
    expect(formatTarget(0, null)).toBe(0);
    expect(formatTarget(null, 10)).toBe(10);
    expect(formatSex('prefer_not_to_say')).toBe('Prefer not to say');
    expect(formatSex('x')).toBe('—');
  });

  it('formats offset dates by hand', () => {
    expect(formatDateWithOffset('2026-09-21', 1)).toBe('Sep 22');
    expect(formatDateWithOffset('nope', 1)).toBe('—');
  });
});

describe('formatHeight (dated change 22 Oct)', () => {
  const { formatHeight } = require('./clientFormat');
  it('formats ft_in as feet and rounded inches', () => {
    expect(formatHeight(89, 'ft_in')).toBe('7′ 5″');
    expect(formatHeight(72, 'ft_in')).toBe('6′ 0″');
    expect(formatHeight(71.6, 'ft_in')).toBe('6′ 0″');
    expect(formatHeight(180, 'cm')).toBe('180 cm');
    expect(formatHeight(null, 'cm')).toBe('—');
  });
});
