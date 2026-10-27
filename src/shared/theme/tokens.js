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
  gray200: '#e5e7eb',
  // Muscle colour for arms/biceps/triceps (design system v1: kept, named by role).
  arms: '#7f22fe',
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
  warning: '#f59e0b',
  successTint: 'rgba(34, 197, 94, 0.10)',
  trainerLockBorder: 'rgba(221, 160, 0, 0.30)',
  rowPressed: 'rgba(239, 241, 244, 0.40)',
  rowPressedStrong: 'rgba(239, 241, 244, 0.50)',
  // Design system v1 (24 Oct 2026) contrast fixes: text on tints/white and
  // fills under white text meet 4.5:1; the base hues stay for dots and borders.
  success700: '#008236',
  warning700: '#bb4d00',
  danger600: '#e7000b',
  danger700: '#c10007',
  danger800: '#991b1b',
  // Overlay scrims (design system v1): navy/50 everywhere; navy/30 only behind
  // the notification panel.
  scrim: 'rgba(17, 24, 39, 0.50)',
  scrimLight: 'rgba(17, 24, 39, 0.30)',
  // P1-02 sweep: the literals that bypassed tokens, named by role, values unchanged.
  // Status palettes (toasts, feedback boxes, notices, badges).
  warningTint: 'rgba(245, 158, 11, 0.10)',
  warningBorder: 'rgba(245, 158, 11, 0.30)',
  warningFill: '#fffbeb',
  warningTextStrong: '#973c00',
  warningBorderSoft: '#fee685',
  infoBorder: 'rgba(14, 165, 233, 0.30)',
  infoFill: '#eff6ff',
  infoText: '#1447e6',
  tealFill: '#e6f7f8',
  tealText: '#007e87',
  emeraldFill: '#ecfdf5',
  emeraldText: '#007a55',
  emeraldBorder: '#a4f4cf',
  dangerBorderSoft: '#ffc9c9',
  neutralFill: '#f1f5f9',
  neutralText: '#314158',
  neutralBorder: '#e2e8f0',
  onDanger: '#ffffff',
  onNavy: '#ffffff',
  // Gold accents.
  brandTintStrong: '#fcefc4',
  brandTextPressed: '#5c4400',
  brandActiveBorder: 'rgba(221, 160, 0, 0.30)',
  brandPressedBorder: 'rgba(221, 160, 0, 0.40)',
  brandEdge: 'rgba(244, 180, 0, 0.40)',
  setNextBorder: 'rgba(244, 180, 0, 0.70)',
  setHighlightOutline: 'rgba(244, 180, 0, 0.60)',
  // Ink on the gold rest disc and gold buttons.
  onGoldEdge: 'rgba(255, 255, 255, 0.30)',
  onGoldWash: 'rgba(17, 24, 39, 0.10)',
  onGoldRing: 'rgba(17, 24, 39, 0.15)',
  onGoldSpinnerTrack: 'rgba(17, 24, 39, 0.4)',
  onGoldTextSoft: 'rgba(17, 24, 39, 0.70)',
  onGoldTextStrong: 'rgba(17, 24, 39, 0.80)',
  illustrationInk: 'rgba(17, 24, 39, 0.70)',
  ringTrack: 'rgba(17, 24, 39, 0.05)',
  // Glass bars, dividers and sheens.
  dividerSoft: 'rgba(229, 231, 235, 0.70)',
  glassEdge: 'rgba(229, 231, 235, 0.80)',
  glassFill: 'rgba(255, 255, 255, 0.80)',
  navGlassFill: 'rgba(255, 255, 255, 0.95)',
  stickyHeaderFill: 'rgba(247, 248, 250, 0.95)',
  sheenClear: 'rgba(255, 255, 255, 0)',
  sheenCard: 'rgba(255, 255, 255, 0.9)',
  sheenSkeleton: 'rgba(255, 255, 255, 0.7)',
  // Native pickers (Select, DateInput) and the exercise picker icons.
  fillSubtle: '#f3f4f6',
  pickerSheet: '#d1d5db',
  pickerToolbarBorder: '#9ca3af',
  pickerDone: '#007aff',
  pickerCheckInk: '#0B1D3A',
  iconSubtle: '#9CA3AF',
  // Client weight chart.
  chartLine: '#009ca6',
  chartGrid: '#e2e8f0',
});

// P1-02: exercise-thumbnail tiles by primary muscle group (spec §A7.3), the
// background hues plus the two icon inks. Values unchanged from ExerciseThumb.
export const musclePalette = Object.freeze({
  legs: '#3A4D6A',
  shoulders: '#009CA6',
  abs: '#FF6A00',
  cardio: '#009CA6',
  quads: '#3B82F6',
  obliques: '#8B5CF6',
  adductors: '#06B6D4',
  trapsNeck: '#F59E0B',
  abductors: '#14B8A6',
  hamstrings: '#D946EF',
  lowerBack: '#F97316',
  lats: '#0EA5E9',
  glutes: '#84CC16',
  upperBack: '#3A4D6A',
  forearms: '#14B8A6',
  iconLight: '#ffffff',
  iconDark: '#000000',
});

export const typography = Object.freeze({
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  heading: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  // Design system v1: bodySm 14/20 is the default; body 14/24 only where the
  // web uses leading-6.
  bodySm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  body: {
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '400',
    color: colors.textSecondary,
  },
});

export const shadows = Object.freeze({
  soft: '0px 8px 24px rgba(11, 29, 58, 0.08)',
  glow: '0px 8px 24px rgba(244, 180, 0, 0.28)',
  lift1: '0px 1px 2px rgba(17, 24, 39, 0.04), 0px 4px 12px -2px rgba(17, 24, 39, 0.06)',
  lift2: '0px 2px 4px rgba(17, 24, 39, 0.05), 0px 12px 28px -6px rgba(17, 24, 39, 0.10)',
  brand: '0px 6px 16px -4px rgba(244, 180, 0, 0.45), 0px 14px 32px -12px rgba(244, 180, 0, 0.30)',
  press: 'inset 0px 2px 6px rgba(17, 24, 39, 0.12)',
  emboss: 'inset 0px 1px 0px rgba(255, 255, 255, 0.9), 0px 1px 2px rgba(17, 24, 39, 0.05)',
  lift3: '0px 4px 8px rgba(17, 24, 39, 0.06), 0px 24px 48px -12px rgba(17, 24, 39, 0.16)',
  // Design system v1 #20: modals use lift-3.
  modal: '0px 4px 8px rgba(17, 24, 39, 0.06), 0px 24px 48px -12px rgba(17, 24, 39, 0.16)',
  insetSoft: 'inset 0px 1px 0px rgba(255, 255, 255, 0.8)',
  // P1-02 sweep: shadows that were written inline, values unchanged.
  ringInk: 'inset 0px 0px 0px 1px rgba(17, 24, 39, 0.05)',
  ringInkOuter: '0px 0px 0px 1px rgba(17, 24, 39, 0.10)',
  sheetUp: '0px -8px 32px rgba(17, 24, 39, 0.12)',
  dialog: '0px 20px 48px -12px rgba(17, 24, 39, 0.25), inset 0px 0px 0px 1px rgba(17, 24, 39, 0.05)',
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
  // Reduced motion slows a spinner that opts in (`reducedMotionLoopMs`) instead of stopping it.
  spinnerReducedLoopMs: 3000,
  fadeMs: 240,
  slideUpMs: 300,
  slideUpOffsetY: 10,
});
