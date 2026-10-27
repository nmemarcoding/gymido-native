// Design tokens, v2 (RN-SPEC-v2-foundation §1–3; UX tokens-and-components,
// FINAL 26 Oct 2026). Dark only. Names are UX's shared vocabulary in
// camelCase (`color-surface-raised` → colors.surfaceRaised).

// §1 Colour: the canonical v2 set.
const V2_COLORS = {
  // §1.1 Ground and surfaces.
  ground: '#0A0B0F',
  groundDeep: '#0B0C10',
  surface: '#15171D',
  surfaceSunk: '#111318',
  surfaceRaised: '#1E2129',
  surfaceInput: '#1A1D24',
  glass: 'rgba(30, 33, 41, 0.72)',
  glassToast: 'rgba(30, 33, 41, 0.85)',
  // Low-end Android: the tab bar draws this instead of the blur (PM, 26 Oct).
  glassSolid: 'rgba(30, 33, 41, 0.96)',
  hairline: 'rgba(255, 255, 255, 0.07)',
  hairlineStrong: 'rgba(255, 255, 255, 0.10)',
  hairlineButton: 'rgba(255, 255, 255, 0.12)',
  fillWell: 'rgba(255, 255, 255, 0.04)',
  fillChip: 'rgba(255, 255, 255, 0.05)',
  fillSkeleton: 'rgba(255, 255, 255, 0.07)',
  fillButton: 'rgba(255, 255, 255, 0.08)',
  switchTrackOff: 'rgba(255, 255, 255, 0.14)',
  scrim: 'rgba(10, 11, 15, 0.6)',
  // §1.2 Text.
  textPrimary: '#F5F6F8',
  textStrong2: '#D4D7DD',
  textSecondary: '#B4B9C3',
  textMuted: '#9BA1AD',
  textFaint: '#8B919C',
  // Fails 4.5:1: disabled text and decoration only, never readable copy.
  textDisabled: '#6E7480',
  onGold: '#0A0B0F',
  onLight: '#0A0B0F',
  onDanger: '#FFFFFF',
  // §1.3 Brand gold. Pressed gold = goldDeep (UX, 26 Oct).
  gold: '#FFC21A',
  goldLight: '#FFD45C',
  goldDeep: '#F4A300',
  goldTint: 'rgba(255, 194, 26, 0.14)',
  goldTintTab: 'rgba(255, 194, 26, 0.16)',
  goldTintWeak: 'rgba(255, 194, 26, 0.08)',
  goldBorder: 'rgba(255, 194, 26, 0.35)',
  goldFocus: 'rgba(255, 194, 26, 0.18)',
  // §1.4 Status. "Active" = teal; success green = completed / done.
  success: '#4ADE80',
  successTint: 'rgba(74, 222, 128, 0.12)',
  successBorder: 'rgba(74, 222, 128, 0.28)',
  teal: '#4FD8C4',
  tealTint: 'rgba(79, 216, 196, 0.14)',
  warning: '#F5A524',
  warningTint: 'rgba(245, 165, 36, 0.14)',
  warningFill: 'rgba(245, 165, 36, 0.08)',
  warningBorder: 'rgba(245, 165, 36, 0.28)',
  danger: '#D93036',
  dangerText: '#FF7A70',
  dangerTextTint: 'rgba(255, 122, 112, 0.12)',
  dangerFocus: 'rgba(255, 122, 112, 0.18)',
  dangerDot: '#FF5A4E',
  dangerDotTint: 'rgba(255, 90, 78, 0.08)',
  dangerDotBorder: 'rgba(255, 90, 78, 0.30)',
  // Info and chest share the hue as two tokens (UX, 26 Oct).
  info: '#8FA8FF',
  infoTint: 'rgba(143, 168, 255, 0.10)',
  infoBorder: 'rgba(143, 168, 255, 0.25)',
};

// v1 names kept as ALIASES of v2 values while screens move to the v2 names
// (Phases 2–4); each takes its dominant v1 role. A screen that uses an alias
// in another role is fixed when it is restyled. Phase 4 deletes this block
// (tokens.test.js lists what is left).
const LEGACY_COLORS = {
  background: V2_COLORS.ground,
  border: V2_COLORS.hairline,
  brand400: V2_COLORS.gold,
  brand500: V2_COLORS.goldDeep,
  brand600: V2_COLORS.gold,
  brand300: V2_COLORS.goldLight,
  brand50: V2_COLORS.goldTint,
  brand700: V2_COLORS.gold,
  dangerBorder: V2_COLORS.dangerDotBorder,
  errorFill: V2_COLORS.dangerDotTint,
  errorText: V2_COLORS.dangerText,
  surfaceMuted: V2_COLORS.fillChip,
  // v1 navy: dark text and active fills on white; on dark the same roles are
  // the light ink (white "on" chips, titles).
  navy: V2_COLORS.textPrimary,
  onNavy: V2_COLORS.onLight,
  gray200: V2_COLORS.hairlineStrong,
  arms: '#C79BFF',
  pickerBubble: V2_COLORS.fillSkeleton,
  focusRing: V2_COLORS.goldFocus,
  focusRingError: V2_COLORS.dangerFocus,
  pickerRowPressedBorder: V2_COLORS.goldBorder,
  pickerCancelPressedBorder: V2_COLORS.goldBorder,
  successFill: V2_COLORS.successTint,
  successText: V2_COLORS.success,
  trainerLockBorder: V2_COLORS.goldBorder,
  rowPressed: V2_COLORS.fillChip,
  rowPressedStrong: V2_COLORS.fillSkeleton,
  success700: V2_COLORS.success,
  warning700: V2_COLORS.warning,
  danger700: V2_COLORS.dangerText,
  danger800: V2_COLORS.dangerText,
  scrimLight: V2_COLORS.scrim,
  warningTextStrong: V2_COLORS.warning,
  warningBorderSoft: V2_COLORS.warningBorder,
  infoFill: V2_COLORS.infoTint,
  infoText: V2_COLORS.info,
  tealFill: V2_COLORS.tealTint,
  tealText: V2_COLORS.teal,
  emeraldFill: V2_COLORS.successTint,
  emeraldText: V2_COLORS.success,
  emeraldBorder: V2_COLORS.successBorder,
  dangerBorderSoft: V2_COLORS.dangerDotBorder,
  neutralFill: V2_COLORS.fillChip,
  neutralText: V2_COLORS.textStrong2,
  neutralBorder: V2_COLORS.hairlineStrong,
  brandTintStrong: V2_COLORS.goldTint,
  brandTextPressed: V2_COLORS.goldDeep,
  brandActiveBorder: V2_COLORS.goldBorder,
  brandPressedBorder: V2_COLORS.goldBorder,
  brandEdge: V2_COLORS.goldBorder,
  setNextBorder: V2_COLORS.gold,
  setHighlightOutline: V2_COLORS.gold,
  // Ink on gold: v1's navy washes become color-on-gold washes.
  onGoldEdge: 'rgba(255, 255, 255, 0.30)',
  onGoldWash: 'rgba(10, 11, 15, 0.10)',
  onGoldRing: 'rgba(10, 11, 15, 0.15)',
  onGoldSpinnerTrack: 'rgba(10, 11, 15, 0.4)',
  onGoldTextSoft: 'rgba(10, 11, 15, 0.70)',
  onGoldTextStrong: 'rgba(10, 11, 15, 0.80)',
  illustrationInk: V2_COLORS.textMuted,
  ringTrack: V2_COLORS.fillSkeleton,
  dividerSoft: V2_COLORS.hairline,
  glassEdge: V2_COLORS.hairlineStrong,
  glassFill: V2_COLORS.glass,
  navGlassFill: V2_COLORS.glass,
  stickyHeaderFill: 'rgba(10, 11, 15, 0.85)',
  // v1's 3D-card sheens are retired; kept faint so the old layers stay quiet.
  sheenClear: 'rgba(255, 255, 255, 0)',
  sheenCard: 'rgba(255, 255, 255, 0.06)',
  sheenSkeleton: 'rgba(255, 255, 255, 0.08)',
  fillSubtle: V2_COLORS.fillChip,
  pickerSheet: V2_COLORS.surfaceRaised,
  pickerToolbarBorder: V2_COLORS.hairlineStrong,
  pickerDone: V2_COLORS.gold,
  pickerCheckInk: V2_COLORS.textPrimary,
  iconSubtle: V2_COLORS.textFaint,
  chartLine: V2_COLORS.teal,
  chartGrid: V2_COLORS.hairline,
};

export const colors = Object.freeze({ ...LEGACY_COLORS, ...V2_COLORS });
export const legacyColorKeys = Object.freeze(Object.keys(LEGACY_COLORS));

// §1.5 Muscle colours, always shown with a text label. Tiles: the colour at
// 16 % as the fill and the colour as the text.
export const muscle = Object.freeze({
  chest: '#8FA8FF',
  back: '#FFC21A',
  legs: '#9DB0CF',
  arms: '#C79BFF',
  core: '#FF9A57',
  cardio: '#4FD8C4',
});

// The API's muscle groups onto the six colours (UX, 26 Oct 2026); anything
// else is neutral. v1's per-group thumbnail hues map through this until
// ExerciseImage replaces ExerciseThumb (Phase 2).
export const musclePalette = Object.freeze({
  legs: muscle.legs,
  shoulders: muscle.arms,
  abs: muscle.core,
  cardio: muscle.cardio,
  quads: muscle.legs,
  obliques: muscle.core,
  adductors: muscle.legs,
  trapsNeck: muscle.back,
  abductors: muscle.legs,
  hamstrings: muscle.legs,
  lowerBack: muscle.back,
  lats: muscle.back,
  glutes: muscle.legs,
  upperBack: muscle.back,
  forearms: muscle.arms,
  iconLight: V2_COLORS.textPrimary,
  iconDark: V2_COLORS.ground,
});

export const typography = Object.freeze({
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.gold,
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

// §3 Elevation: two shadows only. goldGlow under the ONE gold primary
// (goldGlowLarge under a 60 px button); float for glass chrome, toasts,
// sheets and dialogs.
const V2_SHADOWS = {
  goldGlow: '0px 10px 30px -8px rgba(255, 194, 26, 0.55)',
  goldGlowLarge: '0px 14px 36px -10px rgba(255, 194, 26, 0.6)',
  float: '0px 16px 40px rgba(0, 0, 0, 0.5)',
};

// v1 shadows as aliases: the gold glows map to goldGlow, overlay shadows to
// float, and every other lift/press/emboss/ring is retired (`undefined`
// draws no shadow). Deleted in Phase 4 with the colour aliases.
const LEGACY_SHADOWS = {
  glow: V2_SHADOWS.goldGlow,
  brand: V2_SHADOWS.goldGlow,
  modal: V2_SHADOWS.float,
  dialog: V2_SHADOWS.float,
  sheetUp: V2_SHADOWS.float,
  soft: undefined,
  lift1: undefined,
  lift2: undefined,
  lift3: undefined,
  press: undefined,
  emboss: undefined,
  insetSoft: undefined,
  ringInk: undefined,
  ringInkOuter: undefined,
};

export const shadows = Object.freeze({ ...LEGACY_SHADOWS, ...V2_SHADOWS });
export const legacyShadowKeys = Object.freeze(Object.keys(LEGACY_SHADOWS));

// §3 Radius: one value per use (the canvas's 14 / 18 fold into 16 / 20).
// xxl = UX's radius-2xl. Checkbox 8 is local to the checkbox.
export const radii = Object.freeze({
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  full: 999,
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
