import { resolveApiBaseUrl } from './env';

describe('resolveApiBaseUrl', () => {
  it('points the Android emulator at the host for local test envs', () => {
    expect(resolveApiBaseUrl('http://localhost:8080', 'localtest-ios', 'android')).toBe('http://10.0.2.2:8080');
    expect(resolveApiBaseUrl('http://127.0.0.1:8080/api', 'localtest-android', 'android')).toBe('http://10.0.2.2:8080/api');
  });

  it('leaves iOS, other envs and other hosts alone', () => {
    expect(resolveApiBaseUrl('http://localhost:8080', 'localtest-ios', 'ios')).toBe('http://localhost:8080');
    expect(resolveApiBaseUrl('http://localhost:8080', 'development', 'android')).toBe('http://localhost:8080');
    expect(resolveApiBaseUrl('http://10.0.2.2:8080', 'localtest-android', 'android')).toBe('http://10.0.2.2:8080');
    expect(resolveApiBaseUrl('https://localhost.example.com', 'localtest-ios', 'android')).toBe('https://localhost.example.com');
    expect(resolveApiBaseUrl(null, 'localtest-ios', 'android')).toBeNull();
  });
});
