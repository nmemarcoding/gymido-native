import { DEFAULT_ERROR_MESSAGE, getApiErrorMessage, getServerMessage, isNetworkError } from './apiError';

describe('getServerMessage', () => {
  it('uses message, then the first error, then the transport text, then the default', () => {
    expect(getServerMessage({ response: { data: { message: 'Validation failed', errors: { a: ['x'] } } } })).toBe(
      'Validation failed'
    );
    expect(getServerMessage({ response: { data: { message: '  ', errors: { name: ['Name taken'] } } } })).toBe('Name taken');
    expect(getServerMessage({ message: 'Network Error' })).toBe('Network Error');
    expect(getServerMessage({ message: 'Request failed with status code 500', response: { data: {} } })).toBe(
      'Request failed with status code 500'
    );
    expect(getServerMessage({})).toBe(DEFAULT_ERROR_MESSAGE);
  });
});

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
