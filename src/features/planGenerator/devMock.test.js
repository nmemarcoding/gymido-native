jest.mock('../../shared/api/client', () => ({
  apiClient: { get: jest.fn(), put: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../../shared/api/client';
import { DEV_MOCK_NOTE, applyGeneratorMock, readGeneratorMock } from './devMock';

// Lead (PM option B): a DEV-ONLY stub for UX shots of two generator states.
// Guard: __DEV__ && EXPO_PUBLIC_GYMIDO_MOCK_GENERATOR in {'off', 'note'}.
describe('readGeneratorMock (the guard)', () => {
  it('OFF in production (__DEV__ false) even when the env var is set', () => {
    expect(readGeneratorMock(false, 'off')).toBeNull();
    expect(readGeneratorMock(false, 'note')).toBeNull();
  });

  it('OFF when the env var is unset, empty or unknown', () => {
    expect(readGeneratorMock(true, undefined)).toBeNull();
    expect(readGeneratorMock(true, '')).toBeNull();
    expect(readGeneratorMock(true, 'on')).toBeNull();
  });

  it("ON in dev for 'off' and 'note' only", () => {
    expect(readGeneratorMock(true, 'off')).toBe('off');
    expect(readGeneratorMock(true, 'note')).toBe('note');
  });

  it('the module reads it once at load: in Jest (no env var) it is OFF', () => {
    expect(jest.requireActual('./devMock').GENERATOR_MOCK).toBeNull();
  });
});

describe('applyGeneratorMock (the stubbed shapes)', () => {
  const REAL_PROFILE = { available: true, profile: { goal: 'x' }, options: { goals: [] } };
  const REAL_PREVIEW = { plan_name: 'Upper / Lower', notes: [{ code: 'GO_EASY_AREAS', text: 'Going easy on knees.' }], days: [] };

  it("'off': the G1 screen's profile is unavailable (the clock-tile state)", () => {
    expect(applyGeneratorMock('off', 'screenProfile', REAL_PROFILE)).toEqual({ available: false });
  });

  it("'off': the entry gates' profile is the real one (so the entry rows still lead to G1)", () => {
    expect(applyGeneratorMock('off', 'profile', REAL_PROFILE)).toBe(REAL_PROFILE);
  });

  it("'note': the preview carries a plan note (after any real ones); the profile is untouched", () => {
    expect(applyGeneratorMock('note', 'preview', REAL_PREVIEW)).toEqual({ ...REAL_PREVIEW, notes: [...REAL_PREVIEW.notes, DEV_MOCK_NOTE] });
    expect(applyGeneratorMock('note', 'preview', { plan_name: 'P' }).notes).toEqual([DEV_MOCK_NOTE]);
    expect(applyGeneratorMock('note', 'screenProfile', REAL_PROFILE)).toBe(REAL_PROFILE);
    expect(DEV_MOCK_NOTE).toEqual({ code: expect.any(String), text: expect.any(String) });
  });

  it('no mock: every response passes through untouched', () => {
    expect(applyGeneratorMock(null, 'screenProfile', REAL_PROFILE)).toBe(REAL_PROFILE);
    expect(applyGeneratorMock(null, 'preview', REAL_PREVIEW)).toBe(REAL_PREVIEW);
  });
});

describe('the API layer with the guard false (Jest: no env var)', () => {
  const ok = (data) => Promise.resolve({ data: { data } });

  it('the G1 screen profile call is the same real GET and returns the real body', async () => {
    const { getGeneratorProfile, previewGeneratedPlan } = require('./api/generatorApi');
    apiClient.get.mockReturnValueOnce(ok({ available: true }));
    await expect(getGeneratorProfile({ screen: true })).resolves.toEqual({ available: true });
    expect(apiClient.get).toHaveBeenLastCalledWith('/plan-generator/profile');
    apiClient.post.mockReturnValueOnce(ok({ notes: [] }));
    await expect(previewGeneratedPlan()).resolves.toEqual({ notes: [] });
  });
});

describe('the API layer with the stub on (dev build)', () => {
  const ok = (data) => Promise.resolve({ data: { data } });
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('./devMock');
  });

  function apiWith(mode) {
    jest.resetModules();
    jest.doMock('./devMock', () => ({ ...jest.requireActual('./devMock'), GENERATOR_MOCK: mode }));
    jest.doMock('../../shared/api/client', () => ({ apiClient }));
    return require('./api/generatorApi');
  }

  it("'off': the G1 screen gets { available: false } without a network call; the entry gate stays real", async () => {
    const api = apiWith('off');
    apiClient.get.mockClear();
    await expect(api.getGeneratorProfile({ screen: true })).resolves.toEqual({ available: false });
    expect(apiClient.get).not.toHaveBeenCalled();
    apiClient.get.mockReturnValueOnce(ok({ available: true }));
    await expect(api.getGeneratorProfile()).resolves.toEqual({ available: true });
  });

  it("'note': the preview response gains the plan note", async () => {
    const api = apiWith('note');
    apiClient.post.mockReturnValueOnce(ok({ plan_name: 'P', notes: [] }));
    const preview = await api.previewGeneratedPlan();
    expect(preview.notes).toEqual([DEV_MOCK_NOTE]);
  });
});
