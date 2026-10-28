import { personInitials } from '../trainers/personAvatar';

// Text rules of RN-SPEC-my-trainer and Profile's Coaching card.

function displayNameOf(trainer) {
  return typeof trainer?.display_name === 'string' ? trainer.display_name.trim() : '';
}

// display_name trimmed, else "Trainer". T-64 (27 Oct 2026, PM): the email's
// local part is no longer a fallback (it leaked part of the address); a
// member never sees a trainer's email anywhere.
export function trainerDisplayName(trainer) {
  return displayNameOf(trainer) || 'Trainer';
}

// T-64: a trainer's avatar initials come only from the display name (an
// address typed as one still drops its domain); else the neutral "T".
export function trainerInitials(trainer) {
  return personInitials(displayNameOf(trainer)) || 'T';
}

// Profile P1.3 2a status line.
export function coachingStatus({ relationship, trainer }, requests) {
  if (relationship?.status === 'active') {
    return `Coached by ${trainerDisplayName(trainer)}`;
  }
  const invitations = requests.filter((request) => request.requested_by === 'trainer').length;
  if (invitations === 0) {
    return 'No trainer yet';
  }
  return `No trainer yet · ${invitations} invitation${invitations === 1 ? '' : 's'}`;
}

// RN-SPEC-my-trainer MT1.2 + MT1.3, with Batch B (Invitations first, counted
// heading). Returns which blocks show, in order.
export function deriveHub({ relationship, trainer, requests, isTrainer }) {
  const invitations = requests.filter((request) => request.status === 'pending' && request.requested_by === 'trainer');
  const outgoing = requests.filter((request) => request.requested_by === 'client');
  const hasActiveTrainer = relationship?.status === 'active';
  const trainerName = trainer ? trainerDisplayName(trainer) : `Trainer #${relationship?.trainer_user_id}`;
  const blocks = [
    invitations.length > 0 && 'invitations',
    isTrainer && 'trainerMode',
    hasActiveTrainer && 'activeTrainer',
    !hasActiveTrainer && !isTrainer && 'empty',
    (hasActiveTrainer || isTrainer) && 'links',
    outgoing.length > 0 && 'outgoing',
    !hasActiveTrainer && !isTrainer && 'findTrainer',
    !isTrainer && 'becomeTrainer',
  ].filter(Boolean);
  return { invitations, outgoing, hasActiveTrainer, trainerName, blocks };
}

// MT1.6 accept failure copy.
export function acceptErrorMessage(status, serverMessage) {
  if (status === 409) {
    return serverMessage;
  }
  if (status === 404) {
    return 'That request is no longer available.';
  }
  return 'We could not accept that request. Please try again.';
}

// The status pill: the code's status in sentence case ("pending" → "Pending");
// Active = teal (UX ruling), Pending = warning, anything else neutral.
export function statusPill(status) {
  const key = String(status ?? '').trim().toLowerCase();
  const label = key ? `${key[0].toUpperCase()}${key.slice(1)}` : '';
  const tone = key === 'active' ? 'active' : key === 'pending' ? 'warning' : 'neutral';
  return { label, tone };
}
