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

describe('getWebApiErrorMessage (web parity, RN-SPEC-plans §4.7)', () => {
  const { getWebApiErrorMessage } = require('./apiError');
  const withResponse = (data, message = 'Request failed with status code 422') =>
    Object.assign(new Error(message), { isAxiosError: true, response: { status: 422, data } });

  test('⚠3: a 422 reads "Validation failed", not the field error', () => {
    const error = withResponse({
      success: false,
      message: 'Validation failed',
      errors: { items: ['schedule item count must match the saved plan day count'] },
    });
    expect(getWebApiErrorMessage(error)).toBe('Validation failed');
  });

  test('falls back to the first error of the first field', () => {
    expect(getWebApiErrorMessage(withResponse({ errors: { body: ['The request body must be valid JSON'] } }))).toBe(
      'The request body must be valid JSON'
    );
  });

  test('then the transport message', () => {
    expect(getWebApiErrorMessage(Object.assign(new Error('Network Error'), { isAxiosError: true }))).toBe(
      'Network Error'
    );
  });

  test('then the generic fallback', () => {
    expect(getWebApiErrorMessage({})).toBe('Something went wrong. Please try again.');
  });
});
