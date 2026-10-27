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

  // Audit b1 PM decision (RN-SPEC-TRAINER-CLIENTS §C5.2, 27 Oct 2026):
  // kg↔lb convert into the chart's display unit; unknown units keep the old rule.
  it('delta(a, b, unit): kg/lb pairs convert into the display unit (the chart conversion)', () => {
    const lb190 = { weight_value: 190, weight_unit: 'lb' };
    const kg74 = { weight_value: 74, weight_unit: 'kg' };
    expect(formatSigned(weightDelta(lb190, kg74, 'kg'))).toBe('-12.2 kg');
    const toLb = weightDelta(lb190, kg74, 'lb');
    expect(toLb.unit).toBe('lb');
    expect(toLb.value).toBeCloseTo(74 / 0.45359237 - 190, 6);
    expect(formatSigned(weightDelta({ weight_value: 80, weight_unit: 'kg' }, { weight_value: 78.5, weight_unit: 'KG' }, 'kg'))).toBe('-1.5 kg');
    expect(formatSigned(weightDelta({ weight_value: 100, weight_unit: 'lb' }, { weight_value: 110, weight_unit: 'lb' }, 'kg'))).toBe('+4.5 kg');
  });

  it('delta(a, b, unit): null when missing / the same log / non-finite; unknown units → same unit b − a, else null', () => {
    const kg = { weight_value: 80, weight_unit: 'kg' };
    expect(weightDelta(null, kg, 'kg')).toBeNull();
    expect(weightDelta(kg, kg, 'kg')).toBeNull();
    expect(weightDelta(kg, { weight_value: 'x', weight_unit: 'kg' }, 'kg')).toBeNull();
    expect(weightDelta({ weight_value: null, weight_unit: 'kg' }, kg, 'kg')).toBeNull();
    // An unknown unit on a log or the display: the old same-unit rule.
    expect(weightDelta({ weight_value: 12, weight_unit: 'st' }, { weight_value: 11, weight_unit: 'st' }, 'kg')).toEqual({ value: -1, unit: 'st' });
    expect(weightDelta({ weight_value: 12, weight_unit: 'st' }, kg, 'kg')).toBeNull();
    expect(weightDelta({ weight_value: 190, weight_unit: 'lb' }, { weight_value: 74, weight_unit: 'kg' }, 'st')).toBeNull();
    expect(weightDelta({ weight_value: 70, weight_unit: 'kg' }, kg, 'st')).toEqual({ value: 10, unit: 'kg' });
  });

  it('formats sessions, durations and targets', () => {
    expect(formatSessionDetail({ duration_seconds: 0 })).toBe('0 min');
    // VOLUME RULE (v2 phase 3/6): total_volume_kg in the client's unit; the raw total_volume is never shown.
    expect(formatSessionDetail({ duration_seconds: 2700, total_volume: 1200 })).toBe('45 min');
    expect(formatSessionDetail({ duration_seconds: 2700, total_volume_kg: 1200 })).toMatch(/^45 min · 1.?200 kg volume$/);
    expect(formatSessionDetail({ total_volume_kg: 100 }, 'lb')).toBe('220 lb volume');
    expect(formatSessionDetail({ total_volume_kg: null })).toBe('No details recorded');
    expect(formatSessionDetail({})).toBe('No details recorded');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(150)).toBe('3 min');
    expect(formatTarget(8, 12)).toBe('8-12');
    expect(formatTarget(10, 10)).toBe(10);
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
