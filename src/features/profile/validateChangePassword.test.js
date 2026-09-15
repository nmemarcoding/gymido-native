import { validateChangePassword } from './validateChangePassword';

describe('validateChangePassword', () => {
  it('checks length before the confirmation match', () => {
    expect(validateChangePassword('short', 'different')).toBe('Password must be at least 8 characters.');
  });

  it('rejects mismatched passwords', () => {
    expect(validateChangePassword('longenough', 'longenougH')).toBe('Passwords do not match.');
  });

  it('accepts a matching password of exactly 8 characters', () => {
    expect(validateChangePassword('12345678', '12345678')).toBeNull();
  });
});
