import { getApiErrorMessage, isNetworkError } from './apiError';

describe('getApiErrorMessage', () => {
  it('prefers the API message', () => {
    const error = { response: { data: { message: 'User not found', errors: { password: ['Too short'] } } } };
    expect(getApiErrorMessage(error, 'Fallback', 'password')).toBe('User not found');
  });

  it('falls back to the first error for the field', () => {
    const error = { response: { data: { errors: { password: ['Password must be at least 8 characters'] } } } };
    expect(getApiErrorMessage(error, 'Fallback', 'password')).toBe('Password must be at least 8 characters');
  });

  it('uses the fallback when there is nothing usable', () => {
    expect(getApiErrorMessage({ response: { data: { message: '' } } }, 'Fallback', 'password')).toBe('Fallback');
    expect(getApiErrorMessage(new Error('boom'), 'Fallback')).toBe('Fallback');
  });
});

describe('isNetworkError', () => {
  it('is true only for Axios errors without a response', () => {
    expect(isNetworkError({ isAxiosError: true })).toBe(true);
    expect(isNetworkError({ isAxiosError: true, response: { status: 500 } })).toBe(false);
    expect(isNetworkError(new Error('boom'))).toBe(false);
  });
});
