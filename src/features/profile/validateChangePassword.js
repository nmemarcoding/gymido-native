export const PASSWORD_MIN_LENGTH = 8;

// Runs on submit only, in this order. Returns an error message or null.
export function validateChangePassword(password, confirmPassword) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return 'Password must be at least 8 characters.';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
}
