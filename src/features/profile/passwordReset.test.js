jest.mock('../../shared/api/client', () => ({
  apiClient: { post: jest.fn() },
}));

import { apiClient } from '../../shared/api/client';
import { AuthStatus, useAuthStore } from '../auth/authStore';
import { sendPasswordResetEmail } from './api/profileApi';
import {
  RESET_COOLDOWN_MS,
  clearResetCooldown,
  hasGymidoPassword,
  markResetEmailSent,
  resetCooldownLeftMs,
  resetCooldownSeconds,
} from './passwordReset';

beforeEach(() => {
  jest.clearAllMocks();
  clearResetCooldown();
});

describe('P1a which accounts (T-32 H1)', () => {
  it('auth0| subs, linked auth0| primaries and no sub yet have a Gymido password', () => {
    expect(hasGymidoPassword('auth0|abc123')).toBe(true);
    expect(hasGymidoPassword(undefined)).toBe(true);
    expect(hasGymidoPassword(null)).toBe(true);
    expect(hasGymidoPassword('')).toBe(true);
  });

  it('any other prefix (e.g. google-oauth2|) has none', () => {
    expect(hasGymidoPassword('google-oauth2|1234567890')).toBe(false);
    expect(hasGymidoPassword('apple|xyz')).toBe(false);
  });
});

describe('P1a wire (T-32 H1)', () => {
  it('POSTs /profile/change-password with body {}', async () => {
    apiClient.post.mockResolvedValue({ data: { message: 'Not shown' } });
    await sendPasswordResetEmail();
    expect(apiClient.post).toHaveBeenCalledWith('/profile/change-password', {});
  });
});

describe('P1a cooldown (T-32 H1)', () => {
  it('is 60 s from the last send, kept in memory, none before a send', () => {
    expect(RESET_COOLDOWN_MS).toBe(60000);
    expect(resetCooldownLeftMs(1000)).toBe(0);
    markResetEmailSent(1000);
    expect(resetCooldownLeftMs(1000)).toBe(60000);
    expect(resetCooldownLeftMs(31000)).toBe(30000);
    expect(resetCooldownLeftMs(61000)).toBe(0);
    expect(resetCooldownLeftMs(90000)).toBe(0);
  });

  it("counts the label with web's min(59, ceil(s)) for the full 60 s, never 0 while left > 0 (FE e7effd0a)", () => {
    expect(resetCooldownSeconds(60000)).toBe(59);
    expect(resetCooldownSeconds(59001)).toBe(59);
    expect(resetCooldownSeconds(59000)).toBe(59);
    expect(resetCooldownSeconds(58001)).toBe(59);
    expect(resetCooldownSeconds(58000)).toBe(58);
    expect(resetCooldownSeconds(2000)).toBe(2);
    expect(resetCooldownSeconds(1001)).toBe(2);
    expect(resetCooldownSeconds(1000)).toBe(1);
    expect(resetCooldownSeconds(1)).toBe(1);
    expect(resetCooldownSeconds(0)).toBe(0);
  });
});

describe('reset cooldown and the session', () => {
  it('is cleared on sign-out, so another account never inherits it', () => {
    useAuthStore.setState({ status: AuthStatus.signedIn });
    markResetEmailSent(1000);
    expect(resetCooldownLeftMs(2000)).toBe(59000);
    useAuthStore.setState({ status: AuthStatus.signedOut });
    expect(resetCooldownLeftMs(2000)).toBe(0);
  });
});
