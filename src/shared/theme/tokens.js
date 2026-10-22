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
  // Trainer plans spec §A2 and RN-SPEC-plans §2.1.
  surfaceMuted: '#eff1f4',
  textMuted: '#6b7280',
  navy: '#111827',
  brand50: '#fef8e7',
  brand700: '#7e5e00',
  danger: '#ef4444',
  dangerPressed: '#e7000b',
  gray200: '#e5e7eb',
  violet600: '#7f22fe',
  modalScrim: 'rgba(0, 0, 0, 0.70)',
  pickerScrim: 'rgba(17, 24, 39, 0.55)',
  pickerBubble: 'rgba(17, 24, 39, 0.15)',
  focusRing: 'rgba(244, 180, 0, 0.35)',
  focusRingError: 'rgba(239, 68, 68, 0.35)',
  pickerRowPressedBorder: 'rgba(244, 180, 0, 0.60)',
  pickerCancelPressedBorder: 'rgba(244, 180, 0, 0.50)',
  successBorder: 'rgba(34, 197, 94, 0.30)',
  successFill: '#f0fdf4',
  successText: '#008236',
  brand300: '#f7ce4f',
  success: '#22c55e',
  successTint: 'rgba(34, 197, 94, 0.10)',
  trainerLockBorder: 'rgba(221, 160, 0, 0.30)',
  rowPressed: 'rgba(239, 241, 244, 0.40)',
  rowPressedStrong: 'rgba(239, 241, 244, 0.50)',
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
  lift1: '0px 1px 2px rgba(17, 24, 39, 0.04), 0px 4px 12px -2px rgba(17, 24, 39, 0.06)',
  modal: '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
  insetSoft: 'inset 0px 1px 0px rgba(255, 255, 255, 0.8)',
  // ⚠ A blue glow on a gold button, a leftover on the web. Reproduced on purpose.
  pickerAddSelected: '0px 4px 16px rgba(96, 165, 250, 0.35)',
});

export const radii = Object.freeze({
  xl: 16,
  xxl: 20,
  xxxl: 28,
  surfaceCard: 23.2,
  full: 9999,
});

// Window-width breakpoints from the web (sm, md, lg).
export const breakpoints = Object.freeze({
  sm: 640,
  md: 768,
  lg: 1024,
});

export const motion = Object.freeze({
  cardEntranceMs: 240,
  cardOffsetY: 8,
  spinnerLoopMs: 1000,
  fadeMs: 240,
  slideUpMs: 300,
  slideUpOffsetY: 10,
});
