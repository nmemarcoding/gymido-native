// Design tokens from the Login & Sign Up spec §8. Light theme only, system font.

export const colors = Object.freeze({
  background: '#f7f8fa',
  surface: '#ffffff',
  border: '#e5e7eb',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  brand400: '#f4b400',
  brand500: '#dda000',
  brand600: '#a07700',
  dangerBorder: 'rgba(239, 68, 68, 0.3)',
  errorFill: '#fef2f2',
  errorText: '#c10007',
});

export const typography = Object.freeze({
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.brand600,
  },
  heading: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: colors.textSecondary,
  },
});

export const shadows = Object.freeze({
  soft: '0px 8px 24px rgba(11, 29, 58, 0.08)',
  glow: '0px 8px 24px rgba(244, 180, 0, 0.28)',
});

export const motion = Object.freeze({
  cardEntranceMs: 240,
  cardOffsetY: 8,
  spinnerLoopMs: 1000,
});
