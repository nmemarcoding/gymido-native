import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import { profileInitials } from '../../profile/editProfileForm';

// RN-SPEC-trainer-profile TP1 / TP4.
export const DISPLAY_NAME_MAX_LENGTH = 255;
export const BIO_MAX_LENGTH = 2000;
export const BIO_ROWS = 6;

export const SAVE_ERROR_FALLBACK = 'We could not save your profile. Please try again.';
export const SAVED_TOAST_TITLE = 'Profile saved';
export const SAVED_TOAST_MESSAGE = 'Members can now find you under Find a trainer.';

// ⚠TP-1: always blank; nothing is loaded.
export function initialTrainerProfileValues() {
  return { display_name: '', bio: '' };
}

// TP1.3 step 2 / ⚠TP-2 / ⚠TP-3: both keys always, trimmed, empties included; no validation.
export function buildTrainerProfilePayload(values) {
  return {
    display_name: String(values?.display_name ?? '').trim(),
    bio: String(values?.bio ?? '').trim(),
  };
}

// TP1.3 step 4: 422 → the server message; anything else → the generic copy.
export function trainerProfileSaveError(error) {
  return getStatus(error) === 422 ? getServerMessage(error) : SAVE_ERROR_FALLBACK;
}

// v2 Phase 6 O ruling 6: the hero avatar shows the user's OWN initials from
// the profile already loaded app-wide (first + last name); no name → the
// email's local part; nothing → the member Profile hero's "●".
export function ownInitials(profile, email) {
  const name = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  const source = name || (email ? String(email).split('@')[0] : '');
  return profileInitials(source);
}
