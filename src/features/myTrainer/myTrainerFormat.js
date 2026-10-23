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
