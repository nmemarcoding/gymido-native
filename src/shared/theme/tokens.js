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
  // Added for the Plans spec (RN-SPEC-plans §2.1).
  surfaceMuted: '#eff1f4',
  navy: '#111827',
  textMuted: '#6b7280',
  brand50: '#fef8e7',
  brand300: '#f7ce4f',
  brand700: '#7e5e00',
  success: '#22c55e',
  successTint: 'rgba(34,197,94,0.10)',
  successBorder: 'rgba(34,197,94,0.30)',
  successFill: '#f0fdf4',
  successText: '#008236',
  brandBorder: 'rgba(221,160,0,0.30)',
  pressedTint: 'rgba(239,241,244,0.40)',
  spinnerTrackNavy: 'rgba(17,24,39,0.40)',
  tabBar: 'rgba(255,255,255,0.95)',
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
  // RN-SPEC-plans §2.2, CSS strings verbatim.
  plansSoft: '0 8px 24px rgba(11,29,58,0.08)',
  plansCard: '0 8px 24px rgba(11,29,58,0.08)',
  plansGlow: '0 8px 24px rgba(244,180,0,0.28)',
  lift1: '0px 1px 2px rgba(17,24,39,0.04), 0px 4px 12px -2px rgba(17,24,39,0.06)',
  // Web `press-3d` :active (index.css --shadow-press).
  press: 'inset 0 2px 6px rgba(17, 24, 39, 0.12)',
});

// RN-SPEC-plans §2.3 (theme-overridden Tailwind radii).
export const radii = Object.freeze({
  full: 9999,
  xl: 16,
  xxl: 20,
  xxxl: 28,
  surfaceCard: 23.2,
});

// RN-SPEC-plans §2.4 type scale. System font; letterSpacing in px.
export const textStyles = Object.freeze({
  eyebrow: { fontSize: 11.2, fontWeight: '700', lineHeight: 16.8, letterSpacing: 2.016, textTransform: 'uppercase' },
  statLabel: { fontSize: 10.4, fontWeight: '700', lineHeight: 15.6, letterSpacing: 1.56, textTransform: 'uppercase' },
  sectionHeading: { fontSize: 14, fontWeight: '700', lineHeight: 20, letterSpacing: 0.35, textTransform: 'uppercase' },
  categorySubheading: { fontSize: 12, fontWeight: '700', lineHeight: 16, letterSpacing: 1.92, textTransform: 'uppercase' },
  title2xl: { fontSize: 24, fontWeight: '900', lineHeight: 30 },
  titleXl: { fontSize: 20, fontWeight: '900', lineHeight: 25 },
  titleLg: { fontSize: 18, fontWeight: '900', lineHeight: 22.5 },
  dayTitle: { fontSize: 16, fontWeight: '700', lineHeight: 24 },
  exerciseName: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 24 },
  meta: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  pill: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  badge: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  weekdayChip: { fontSize: 11.52, fontWeight: '700', lineHeight: 17.28 },
  statValue: { fontSize: 18, fontWeight: '900', lineHeight: 28, fontVariant: ['tabular-nums'] },
  ctaLarge: { fontSize: 16, fontWeight: '900', lineHeight: 24, letterSpacing: 0.4 },
  ctaSmall: { fontSize: 14, fontWeight: '900', lineHeight: 20 },
});

// RN-SPEC-plans §2.6.
export const plansMotion = Object.freeze({
  toastMs: 300,
  toastOffsetY: 10,
  chevronMs: 200,
  colorMs: 150,
  spinnerLoopMs: 1000,
});

export const motion = Object.freeze({
  cardEntranceMs: 240,
  cardOffsetY: 8,
  spinnerLoopMs: 1000,
});
