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

// §1.1/§1.3 Gradients as GradientFill props (SVG, fixed size, present from
// the first render: never added on a state change, the Android crash rule).
// gold is for avatars, initials tiles and the logo only (buttons are flat).
export const gradients = Object.freeze({
  card: Object.freeze({ angle: 160, colors: Object.freeze(['#1E2129', '#14161C']) }),
  gold: Object.freeze({ angle: 145, colors: Object.freeze(['#FFD45C', '#FFC21A', '#F29E00']), stops: Object.freeze([0, 0.45, 1]) }),
  goldAmbient: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.42, rx: 0.8, ry: 0.45 }),
    colors: Object.freeze(['rgba(255, 194, 26, 0.20)', 'rgba(255, 194, 26, 0)']),
    stops: Object.freeze([0, 0.68]),
  }),
  // v2 kit: card
  // §4.8 the exercise hero image's 90 px bottom fade under the name
  // (color-ground at 0 → 0.9).
  imageFade: Object.freeze({ angle: 180, colors: Object.freeze(['rgba(10, 11, 15, 0)', 'rgba(10, 11, 15, 0.9)']) }),
});

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

// §2 Type: Geist 400 / 500 / 600 / 700, bundled (assets/fonts). Each weight
// is its own family; the file name is the family on both platforms.
export const FONT_FAMILY = Object.freeze({
  400: 'Geist-Regular',
  500: 'Geist-Medium',
  600: 'Geist-SemiBold',
  700: 'Geist-Bold',
});

// The style for a Geist weight: fontFamily ONLY. Pairing a custom family with
// fontWeight makes Android fake a bolder face, so callers never set both.
// There is no 900 in v2: heavier weights fall back to Bold.
export function font(weight = 400) {
  const w = Number(weight);
  if (w >= 700) {
    return { fontFamily: FONT_FAMILY[700] };
  }
  return { fontFamily: FONT_FAMILY[w] ?? FONT_FAMILY[400] };
}

// One scale step: size / line height in px, tracking in em (→ px for RN).
function step(fontSize, lineHeight, weight, trackingEm = 0) {
  return Object.freeze({ ...font(weight), fontSize, lineHeight, letterSpacing: Math.round(trackingEm * fontSize * 100) / 100 });
}

// §2 scale. Every changing number also sets fontVariant ['tabular-nums'].
export const typography = Object.freeze({
  displayTimer: step(92, 92, 700, -0.06),
  displayXl: step(56, 58, 700, -0.05),
  displayLg: step(52, 52, 700, -0.045),
  displayMd: step(44, 44, 700, -0.05),
  titleXl: step(36, 40, 700, -0.04),
  titleLg: step(30, 32, 700, -0.04),
  titleMd: step(24, 28, 700, -0.03),
  titleSm: step(22, 28, 700, -0.03),
  titleXs: step(18, 24, 700, -0.02),
  // Input text is 16 (it keeps iOS from zooming the field).
  bodyLg: step(16, 24, 400),
  body: step(15, 22, 400),
  labelLg: step(16, 20, 600),
  bodySm: step(14, 20, 400),
  label: step(13, 18, 500),
  caption: step(12, 16, 400),
  micro: step(11, 14, 500),
  // The three native primitives (board "Typography (native)"): Eyebrow =
  // caption 12/600 gold, sentence case (never tracked caps); Heading =
  // title-md; Body = body in text-secondary.
  eyebrow: Object.freeze({ ...font(600), fontSize: 12, lineHeight: 16, color: colors.gold }),
  heading: Object.freeze({ ...step(24, 28, 700, -0.03), color: colors.textPrimary }),
  bodyText: Object.freeze({ ...step(15, 22, 400), color: colors.textSecondary }),
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

// §3 Spacing: 2 px base, drawn on 4 (`space-2_5` → spacing['2_5']).
export const spacing = Object.freeze({
  '0_5': 2,
  1: 4,
  '1_5': 6,
  2: 8,
  '2_5': 10,
  3: 12,
  '3_5': 14,
  4: 16,
  '4_5': 18,
  5: 20,
  '5_5': 22,
  6: 24,
  7: 28,
  8: 32,
});

// §3 Layout: the phone gutter, the 44 touch minimum (smaller controls add
// hitSlop), the tablet icon rail and the content cap.
export const layout = Object.freeze({
  gutter: 16,
  touchMin: 44,
  railWidth: 88,
  contentMax: 1120,
});

// Window-width breakpoints from the web (sm, md, lg) and v2's three sizes:
// phone < md (768) · tablet md–1279 · web ≥ xl (1280). Native also uses the
// device class: tablets keep the rail in both orientations (§3, [O2]).
export const breakpoints = Object.freeze({
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
});

// §3 Motion (v1 values kept): durations and the two cubic-bézier curves as
// [x1, y1, x2, y2] for Easing.bezier.
export const motion = Object.freeze({
  durationFast: 150,
  durationBase: 200,
  durationSlow: 300,
  easeSpring: Object.freeze([0.22, 1, 0.36, 1]),
  // Dialogs pop in (carried over from v1's RuntimeOverlays POP).
  easePop: Object.freeze([0.34, 1.56, 0.64, 1]),
  cardEntranceMs: 240,
  cardOffsetY: 8,
  spinnerLoopMs: 1000,
  // Reduced motion slows a spinner that opts in (`reducedMotionLoopMs`) instead of stopping it.
  spinnerReducedLoopMs: 3000,
  fadeMs: 240,
  slideUpMs: 300,
  slideUpOffsetY: 10,
});
