// DEV-ONLY stub for UX shots (lead, PM option B, 27 Oct 2026). NEVER ships:
// it is on only when BOTH `__DEV__` (a Metro / dev build) AND
// EXPO_PUBLIC_GYMIDO_MOCK_GENERATOR is 'off' or 'note'. A release build has
// __DEV__ false, so GENERATOR_MOCK is null and every response passes through.
//   'off'  → the G1 screen's GET /plan-generator/profile answers
//            { available: false } (the clock-tile "turned off" state). The
//            entry rows keep the real answer so they still lead to G1.
//   'note' → POST /plan-generator/preview gains one plan note (the 0.08
//            info notice) after any real ones.
// Hooked only in api/generatorApi.js.

export const DEV_MOCK_NOTE = Object.freeze({
  code: 'DEV_MOCK_NOTE',
  text: 'We kept every session under an hour to fit your schedule.',
});

const MODES = new Set(['off', 'note']);

export function readGeneratorMock(isDev, value) {
  if (!isDev) {
    return null;
  }
  return MODES.has(value) ? value : null;
}

// Read once. `process.env.EXPO_PUBLIC_…` must stay a direct member access so
// Expo inlines it at bundle time.
// eslint-disable-next-line no-undef
export const GENERATOR_MOCK = readGeneratorMock(typeof __DEV__ !== 'undefined' && __DEV__, process.env.EXPO_PUBLIC_GYMIDO_MOCK_GENERATOR);

// `kind`: 'screenProfile' (G1's profile load) | 'profile' | 'preview'.
export function applyGeneratorMock(mode, kind, response) {
  if (mode === 'off' && kind === 'screenProfile') {
    return { available: false };
  }
  if (mode === 'note' && kind === 'preview') {
    return { ...response, notes: [...(response?.notes ?? []), DEV_MOCK_NOTE] };
  }
  return response;
}
