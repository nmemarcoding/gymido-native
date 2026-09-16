import { isDeadSession, isDecline, isNoCredentials, isTransientCredentialsError } from './authErrors';

describe('authErrors', () => {
  it('treats a cancelled browser and declined consent as declines', () => {
    expect(isDecline({ type: 'USER_CANCELLED' })).toBe(true);
    expect(isDecline({ type: 'ACCESS_DENIED' })).toBe(true);
    expect(isDecline({ type: 'NETWORK_ERROR' })).toBe(false);
  });

  it('detects missing stored credentials', () => {
    expect(isNoCredentials({ type: 'NO_CREDENTIALS' })).toBe(true);
    expect(isDeadSession({ type: 'NO_CREDENTIALS' })).toBe(false);
  });

  it('treats a missing refresh token or expired session as dead', () => {
    expect(isDeadSession({ type: 'NO_REFRESH_TOKEN' })).toBe(true);
    expect(isDeadSession({ type: 'SESSION_EXPIRED' })).toBe(true);
  });

  it('treats NO_NETWORK as transient', () => {
    expect(isTransientCredentialsError({ type: 'NO_NETWORK' })).toBe(true);
    expect(isDeadSession({ type: 'NO_NETWORK' })).toBe(false);
  });

  it('treats RENEW_FAILED with an OAuth rejection as dead, even if the text mentions the network', () => {
    const error = { type: 'RENEW_FAILED', message: 'Network request returned invalid_grant' };
    expect(isDeadSession(error)).toBe(true);
    expect(isTransientCredentialsError(error)).toBe(false);
  });

  it('treats RENEW_FAILED caused by the network as transient', () => {
    const error = { type: 'RENEW_FAILED', message: 'The Internet connection appears to be offline.' };
    expect(isTransientCredentialsError(error)).toBe(true);
    expect(isDeadSession(error)).toBe(false);
  });

  it('treats RENEW_FAILED without details as dead', () => {
    expect(isDeadSession({ type: 'RENEW_FAILED', message: 'Failed to renew credentials' })).toBe(true);
  });

  it('reads OAuth codes from the error json', () => {
    const error = { type: 'RENEW_FAILED', message: 'connection closed', json: { error: 'login_required' } };
    expect(isDeadSession(error)).toBe(true);
  });
});
