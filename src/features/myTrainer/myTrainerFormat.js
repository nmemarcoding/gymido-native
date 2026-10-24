// Text rules of RN-SPEC-my-trainer and Profile's Coaching card.

// display_name, else the email's local part, else "Trainer" (each trimmed).
export function trainerDisplayName(trainer) {
  const name = typeof trainer?.display_name === 'string' ? trainer.display_name.trim() : '';
  if (name) {
    return name;
  }
  const local = typeof trainer?.email === 'string' ? trainer.email.split('@')[0].trim() : '';
  return local || 'Trainer';
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
