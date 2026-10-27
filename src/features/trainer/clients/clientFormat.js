// Labels and number formats of RN-SPEC-TRAINER-CLIENTS, exact.
import { convertWeight } from '../../../shared/format/weight';

// §C1.1
export function clientDisplayName(client) {
  const parts = [client?.first_name, client?.last_name].map((part) => String(part ?? '').trim()).filter(Boolean);
  return parts.length ? parts.join(' ') : 'Unnamed client';
}

// An absent `client` key and an explicit null are different cases.
export function clientRowLabel(relationship) {
  if (relationship.client === undefined) {
    return `Client #${relationship.client_user_id}`;
  }
  if (relationship.client === null) {
    return 'Unnamed client';
  }
  return clientDisplayName(relationship.client);
}

// §C3.3 T-32 M1: the web's email-shaped gate, verbatim. Callers pass the
// trimmed input.
const EMAIL_SHAPED = /^[^@\s]+@[^@\s]*\.[^@\s]+$/;

export function isEmailShaped(text) {
  return EMAIL_SHAPED.test(text);
}

export function isAwaitingMyResponse(relationship, side) {
  return relationship.status === 'pending' && relationship.requested_by === (side === 'trainer' ? 'client' : 'trainer');
}

const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

// §C4.4 formatWeight: en-US, at most 1 decimal, grouping, + unit, trimmed.
export function formatWeight(value, unit) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${oneDecimal.format(Number(value))} ${unit ?? ''}`.trim();
}

// §C4.4 Height (dated change 22 Oct; ⚠C-6 retired): ft_in values are total
// inches → "7′ 5″" (inches rounded first); other units use formatWeight.
export function formatHeight(value, unit) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  if (unit === 'ft_in') {
    const inches = Math.round(Number(value));
    return `${Math.floor(inches / 12)}′ ${inches % 12}″`;
  }
  return formatWeight(value, unit);
}

// §C5.2 signed(): "+" only above 0.
export function formatSigned(change) {
  if (!change) {
    return '—';
  }
  const prefix = change.value > 0 ? '+' : '';
  return `${prefix}${oneDecimal.format(change.value)} ${change.unit ?? ''}`.trim();
}

const normUnit = (unit) => String(unit ?? '').trim().toLowerCase();
const sameUnit = (a, b) => normUnit(a) === normUnit(b);
const convertible = (unit) => unit === 'kg' || unit === 'lb';
const finite = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

// §C5.2 delta(a, b, unit). Audit b1 PM decision (27 Oct 2026): when both
// logs' units AND the display `unit` (the chart's, §C5.3) are kg or lb, each
// is converted into `unit` as the chart does (convertWeight) and the change
// is in `unit`; otherwise (an unknown unit) the old rule: same unit → b − a
// in b's unit, different → null. Null too if either is missing, the same
// log, or not a finite number.
export function weightDelta(a, b, unit) {
  if (!a || !b || a === b || !finite(a.weight_value) || !finite(b.weight_value)) {
    return null;
  }
  const from = normUnit(a.weight_unit);
  const to = normUnit(b.weight_unit);
  const display = normUnit(unit);
  if (convertible(from) && convertible(to) && convertible(display)) {
    return {
      value: convertWeight(b.weight_value, to, display) - convertWeight(a.weight_value, from, display),
      unit: display,
    };
  }
  if (!sameUnit(a.weight_unit, b.weight_unit)) {
    return null;
  }
  return { value: Number(b.weight_value) - Number(a.weight_value), unit: b.weight_unit };
}

const SEX_LABELS = { male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say' };

export function formatSex(sex) {
  return SEX_LABELS[sex] ?? '—';
}

// Device-locale grouping for volumes.
export function formatVolume(value) {
  return Math.round(Number(value) || 0).toLocaleString();
}

// §C4.4 recent workout detail line. VOLUME RULE (RN-SPEC-v2-phase3, PM 27
// Oct; v2-phase6 ND-10): only `total_volume_kg`, in the CLIENT's unit
// (`unit`, kg by default), hidden when absent; never the raw total_volume.
export function formatSessionDetail(session, unit = 'kg') {
  const minutes =
    session.duration_seconds !== null && session.duration_seconds !== undefined
      ? `${Math.round(session.duration_seconds / 60)} min`
      : null;
  const kg = session.total_volume_kg;
  const hasVolume = kg !== null && kg !== undefined && kg !== '' && !Number.isNaN(Number(kg));
  const volume = hasVolume ? `${formatVolume(convertWeight(kg, 'kg', unit))} ${unit} volume` : null;
  return [minutes, volume].filter(Boolean).join(' · ') || 'No details recorded';
}

// §C5.1 duration.
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return null;
  }
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)} min`;
}

// §C5.1 set target: both truthy → "min-max", else min ?? max (a 0 min shows "0").
// Equal ends show one number (dated change 23 Oct): "10 target".
export function formatTarget(min, max) {
  if (min && max && min !== max) {
    return `${min}-${max}`;
  }
  return min ?? max ?? null;
}

// The trainer pages' local formatters (RN-SPEC-time §5): device locale and
// time zone; empty/invalid → null so the caller can hide or fall back.
export function formatTrainerDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

export function formatTrainerDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function plural(count, one, many) {
  return count === 1 ? one : many;
}

// UX §10: status pills are sentence case ("completed" → "Completed"); the
// text is still the server's status.
export function sentenceCase(text) {
  const value = String(text ?? '').trim();
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

// A v2 StatusPill tone for a trainer status (X-4): active = teal "Active",
// completed / approved = green, pending = gold, missed = amber, the rest
// (replaced / ended / cancelled / rejected …) neutral.
const STATUS_TONES = { active: 'active', completed: 'completed', approved: 'completed', pending: 'gold', missed: 'warning' };

export function statusTone(status) {
  return STATUS_TONES[String(status ?? '').trim().toLowerCase()] ?? 'neutral';
}
