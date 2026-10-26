import { AuthStatus, useAuthStore } from '../auth/authStore';

// RN-SPEC-profile P1a (25 Oct 2026, T-32 H1): the reset email's cooldown and
// which accounts have a Gymido password.

export const RESET_COOLDOWN_MS = 60 * 1000;

// In memory for the app session only (not storage): an app restart forgets it
// and the server answers a repeat inside its own 60 s with a silent 200.
let lastSentAt = null;

export function markResetEmailSent(now = Date.now()) {
  lastSentAt = now;
}

// Milliseconds left in the cooldown, 0 when there is none.
export function resetCooldownLeftMs(now = Date.now()) {
  if (lastSentAt === null) {
    return 0;
  }
  return Math.max(0, lastSentAt + RESET_COOLDOWN_MS - now);
}

// The "Send again in {n}s" number: 59 down to 1 (never 0) for the full 60 s,
// then 0 = the cooldown is over (FE e7effd0a).
export function resetCooldownSeconds(leftMs) {
  return leftMs <= 0 ? 0 : Math.max(1, Math.ceil(leftMs / 1000) - 1);
}

export function clearResetCooldown() {
  lastSentAt = null;
}

// The web loses it with the page on logout; native clears it on any sign-out
// or sign-in, so another account never inherits it.
useAuthStore.subscribe((state, previous) => {
  if ((previous.status === AuthStatus.signedIn) !== (state.status === AuthStatus.signedIn)) {
    clearResetCooldown();
  }
});

// `auth0|` (linked accounts keep it as their primary) or no sub yet → a
// password account; any other prefix (e.g. `google-oauth2|`) has none.
export function hasGymidoPassword(sub) {
  return !sub || sub.startsWith('auth0|');
}
