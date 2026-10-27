import { getServerMessage, getStatus } from '../../shared/api/apiError';
import { formatLocalDateForInput } from '../../shared/time/format';
import { slugify } from '../trainer/plans/planFormat';
import { keepUnitsTogether } from '../../shared/format/counts';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

// §M2 (D1): members never see a slug. slugify(name) (or "plan"), "-", then
// 6 uniformly random a–z letters, new on every submit.
export function memberSlug(name, random = Math.random) {
  const base = slugify(name) || 'plan';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += LETTERS[Math.floor(random() * LETTERS.length)];
  }
  return `${base}-${suffix}`;
}


export const ON_HOLD_TAIL = 'They’re kept safe and come back when coaching ends. Your trainer manages your training for now.';

// §M3.4 / §M5: a 403 reads "{server message} They’re kept safe …".
export function onHoldMessage(error) {
  return `${getServerMessage(error)} ${ON_HOLD_TAIL}`;
}

// §M3.4: `enrollment.workout_plan_id == planId` — loose, as the web compares
// a number with the route's string id.
export function isCurrentPlan(current, planId) {
  const enrollment = current?.enrollment;
  if (!enrollment) {
    return false;
  }
  // eslint-disable-next-line eqeqeq
  return enrollment.workout_plan_id == planId;
}

// §M3.4: "Start this plan" is disabled for an inactive plan or one with no days.
export function canStartPlan(plan, days) {
  return plan?.is_active !== false && (days?.length ?? 0) > 0;
}

// §M3.4 banner area: the single hint shown (null = none), in spec order.
export function getStartHint({ isCurrent, plan, days }) {
  if (isCurrent) {
    return 'current';
  }
  if (plan?.is_active === false) {
    return 'inactive';
  }
  if ((days?.length ?? 0) === 0) {
    return 'noDays';
  }
  return null;
}

// §M3.4 steps 2–5. Resolves to one outcome:
//   { type: 'success', message } → replace with Workout carrying `message`
//   { type: 'inline', message }  → the "Could not start this plan" box
//   { type: 'toast', message }   → error toast "Could not start this plan"
// ⚠M-1: with no known enrollment (the lookup failed) the cancel is skipped.
// `cancelled: true` is added once the old enrollment is known to be gone (the
// cancel succeeded, or 404: already cancelled), so a failed enrol after it
// doesn't make every retry cancel a plan that no longer exists.
export async function runStartPlan({ planId, planName, enrollment, api, today = formatLocalDateForInput() }) {
  let cancelled = false;
  if (enrollment) {
    try {
      await api.cancelEnrollment(enrollment.id);
      cancelled = true;
    } catch (error) {
      const status = getStatus(error);
      if (status === 404) {
        cancelled = true;
      } else if (status === 409) {
        // A trainer lock: the server message, inline.
        return { type: 'inline', message: getServerMessage(error) };
      } else {
        return startFailure(error);
      }
    }
  }
  const extra = cancelled ? { cancelled: true } : {};
  try {
    await api.startPlan(planId, today);
  } catch (error) {
    return { ...startFailure(error), ...extra };
  }
  return { type: 'success', message: `${keepUnitsTogether(planName)} activated.`, ...extra };
}

function startFailure(error) {
  if (getStatus(error) === 403) {
    return { type: 'inline', message: onHoldMessage(error) };
  }
  return { type: 'toast', message: getServerMessage(error) };
}

// §M5 step 4: the copy card's error line.
export function copyErrorMessage(error) {
  const status = getStatus(error);
  if (status === 403) {
    return onHoldMessage(error);
  }
  if (status === 404) {
    return 'This plan can’t be copied.';
  }
  // The shared chain: message → first `errors` field → transport text → default.
  return getServerMessage(error);
}

// §M1: a failed list load is "on hold" on status 403 (never by message
// text), else the error state; both carry the server message.
export function myPlansLoadFailure(error) {
  return {
    status: getStatus(error) === 403 ? 'onHold' : 'error',
    message: getServerMessage(error),
  };
}
