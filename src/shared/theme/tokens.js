// Design tokens, v2 (RN-SPEC-v2-foundation §1–3; UX tokens-and-components,
// FINAL 26 Oct 2026). Dark only. Names are UX's shared vocabulary in
// camelCase (`color-surface-raised` → colors.surfaceRaised).

import { Platform } from 'react-native';

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
  // UX native final audit 27 Oct 2026, ruling 11: the toggle knob is white
  // in both states.
  switchKnob: '#FFFFFF',
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
  // v2 kit: overlays
  // §6 bottom sheet grab handle (36 × 5): hairline-bright (UX §8.4 folds 0.2).
  grabHandle: 'rgba(255, 255, 255, 0.18)',
  // v2 kit: feedback (§5 FeedbackBox / ErrorBox: tone fill 0.08 + border 0.25).
  // Success is GREEN everywhere (UX, 26 Oct); teal is only "Active" and trends.
  successFeedbackFill: 'rgba(74, 222, 128, 0.08)',
  successFeedbackBorder: 'rgba(74, 222, 128, 0.25)',
  dangerTextFill: 'rgba(255, 122, 112, 0.08)',
  dangerTextBorder: 'rgba(255, 122, 112, 0.25)',
  // §5 Skeleton shimmer band: clear → faint white → clear over fillSkeleton.
  skeletonShimmer: 'rgba(255, 255, 255, 0.08)',
  skeletonShimmerEdge: 'rgba(255, 255, 255, 0)',
  // v2 kit: input (§4.6): the checkbox's off border and the card radio's
  // off border.
  checkboxBorder: 'rgba(255, 255, 255, 0.28)',
  // v2 kit: card (UX §8.1): the failed-image tile's workout icon.
  failedTileIcon: '#C9D4E6',
  choiceBorder: 'rgba(255, 255, 255, 0.08)',
  // Kit batch (P3 reviewer LOW): role aliases instead of borrowed tokens.
  // A selected glass segment's fill (the P3-3 Body/Activity switch) and a
  // disabled glass chip's border (the P3-2 disabled Did it).
  glassSelectedFill: 'rgba(255, 255, 255, 0.12)',
  glassDisabledBorder: 'rgba(255, 255, 255, 0.08)',
  // UX tokens-and-components §8.3 + §8.4 (26 Oct 2026): the canvas values
  // that had no token. Build exactly these; other canvas values fold into
  // existing tokens per the §8.4 fold map.
  surfaceWell: '#0F1116',
  surfaceCard2: '#17191F',
  // Near-solid glass sheets/panels (blur.glassStrong); glassSolid stays the
  // low-end Android fallback only.
  glassStrong: 'rgba(24, 26, 33, 0.92)',
  scrimStrong: 'rgba(10, 11, 15, 0.72)',
  // Glass chips/buttons over photos (blur.onPhoto) and solid photo badges.
  onPhoto: 'rgba(10, 11, 15, 0.55)',
  onPhotoStrong: 'rgba(10, 11, 15, 0.92)',
  // Dark fills/rings ON gold surfaces.
  inkTint: 'rgba(10, 11, 15, 0.10)',
  // Borders on photos and glass chips, grab handles.
  hairlineBright: 'rgba(255, 255, 255, 0.18)',
  // §8.5 alpha ladder (Phase 2+; the Phase 1 kit re-folds after QA's gate):
  // faint 0.08 · tint 0.14 · line 0.30 · strong 0.60 per accent. Danger
  // fills/borders use #FF5A4E; #FF7A70 is for text only.
  goldFaint: 'rgba(255, 194, 26, 0.08)',
  goldLine: 'rgba(255, 194, 26, 0.30)',
  goldStrong: 'rgba(255, 194, 26, 0.60)',
  tealFaint: 'rgba(79, 216, 196, 0.08)',
  tealLine: 'rgba(79, 216, 196, 0.30)',
  tealStrong: 'rgba(79, 216, 196, 0.60)',
  tealText: '#7FE6D6',
  dangerFaint: 'rgba(255, 90, 78, 0.08)',
  dangerTint: 'rgba(255, 90, 78, 0.14)',
  dangerLine: 'rgba(255, 90, 78, 0.30)',
  dangerStrong: 'rgba(255, 90, 78, 0.60)',
  // Body copy on red cards.
  dangerTextSoft: '#FFB4AD',
  successFaint: 'rgba(74, 222, 128, 0.08)',
  successLine: 'rgba(74, 222, 128, 0.30)',
  successStrong: 'rgba(74, 222, 128, 0.60)',
  warningFaint: 'rgba(245, 165, 36, 0.08)',
  warningLine: 'rgba(245, 165, 36, 0.30)',
  warningStrong: 'rgba(245, 165, 36, 0.60)',
  infoFaint: 'rgba(143, 168, 255, 0.08)',
  infoLine: 'rgba(143, 168, 255, 0.30)',
  // White: ring/progress tracks.
  track: 'rgba(255, 255, 255, 0.08)',
  // Skeleton blocks and their shimmer highlight.
  skeleton: '#262932',
  skeletonShine: '#2B2F39',
  // UX §8.6 (FE's web sweep, applies to native).
  // Raised chips/pills on raised surfaces (same value as the skeleton shine).
  surfaceHigh: '#2B2F39',
  dangerHover: '#E0393F',
  // Secondary TEXT on gold fills.
  onGoldMuted: 'rgba(10, 11, 15, 0.72)',
  // Sticky bars on the ground (blur.groundBar).
  groundBar: 'rgba(10, 11, 15, 0.88)',
  // UX native final audit 27 Oct 2026, ruling 2: the status-bar backdrop's
  // low-end Android fallback (no blur there).
  groundFallback: 'rgba(10, 11, 15, 0.96)',
  // Ruling 2 amendment 2 (27 Oct 2026): where blur exists (iOS, Android 31+)
  // the backdrop is this translucent ground over blur.statusBar.
  groundTranslucent: 'rgba(10, 11, 15, 0.86)',
  // The ink ladder (dark on gold): 0.08 / 0.10 tint (inkTint) / 0.30 / 0.60.
  inkFaint: 'rgba(10, 11, 15, 0.08)',
  // MT1.6 (27 Oct 2026): the ink 0.12 chip / Decline fill on the gold card.
  inkChip: 'rgba(10, 11, 15, 0.12)',
  inkLine: 'rgba(10, 11, 15, 0.30)',
  inkStrong: 'rgba(10, 11, 15, 0.60)',
  // §8.6 STATE RULE: hover/pressed = the rest colour + a 4 % overlay (white
  // on dark surfaces, ink on gold); never a new alpha step.
  pressOverlay: 'rgba(255, 255, 255, 0.04)',
  pressOverlayInk: 'rgba(10, 11, 15, 0.04)',
  // v2 kit: kit 2 (UX §8.7 U1–U13, 26 Oct)
  // U8: the white 0.06 fills (the remove "×" disc, icon tiles, the
  // Become-a-trainer button) → color-fill-glass 0.08, the glass secondary
  // button's fill (same value as fillButton, under the ruled name).
  fillGlass: 'rgba(255, 255, 255, 0.08)',
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
  // v1 navy is the ink on GOLD everywhere it is text or an icon (button labels,
  // the rest disc, check marks): color-on-gold. Its two background uses are
  // remapped at their call sites (UX Phase 1 review: a light label on gold
  // failed contrast).
  navy: V2_COLORS.onGold,
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

// UX §8.5 glow ladder (radial, decorative): ambient 0.18, orb 0.26 per
// accent. Each board keeps its own geometry; the colours come from here.
const glow = (rgb, alpha) => Object.freeze([`rgba(${rgb}, ${alpha})`, `rgba(${rgb}, 0)`]);
const GLOW = Object.freeze({
  goldAmbient: glow('255, 194, 26', 0.18),
  goldOrb: glow('255, 194, 26', 0.26),
  tealAmbient: glow('79, 216, 196', 0.18),
  tealOrb: glow('79, 216, 196', 0.26),
  dangerAmbient: glow('255, 90, 78', 0.18),
  dangerOrb: glow('255, 90, 78', 0.26),
});

// §1.1/§1.3 Gradients as GradientFill props (SVG, fixed size, present from
// the first render: never added on a state change, the Android crash rule).
// gold is for avatars, initials tiles and the logo only (buttons are flat).
export const gradients = Object.freeze({
  card: Object.freeze({ angle: 160, colors: Object.freeze(['#1E2129', '#14161C']) }),
  // T-121 L11: a sideways chip row's right-edge fade into the page ground (#0A0B0F).
  edgeFade: Object.freeze({ angle: 90, colors: Object.freeze(['rgba(10, 11, 15, 0)', 'rgba(10, 11, 15, 1)']) }),
  gold: Object.freeze({ angle: 145, colors: Object.freeze(['#FFD45C', '#FFC21A', '#F29E00']), stops: Object.freeze([0, 0.45, 1]) }),
  goldAmbient: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.42, rx: 0.8, ry: 0.45 }),
    colors: Object.freeze(['rgba(255, 194, 26, 0.20)', 'rgba(255, 194, 26, 0)']),
    stops: Object.freeze([0, 0.68]),
  }),
  // The Session loading board's own glow (radial 80 % 45 % at 50 % 45 %).
  sessionGlow: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.45, rx: 0.8, ry: 0.45 }),
    colors: Object.freeze(['rgba(255, 194, 26, 0.18)', 'rgba(255, 194, 26, 0)']),
    stops: Object.freeze([0, 0.65]),
  }),
  // v2 kit: card
  // §4.8 the exercise hero image's 90 px bottom fade under the name
  // (color-ground at 0 → 0.9).
  imageFade: Object.freeze({ angle: 180, colors: Object.freeze(['rgba(10, 11, 15, 0)', 'rgba(10, 11, 15, 0.9)']) }),
  // UX §8.6: every photo/hero fade is this one (gradient-photo-fade); inside
  // cards the same fade on the card surface (gradient-surface-fade).
  photoFade: Object.freeze({ angle: 180, colors: Object.freeze(['rgba(10, 11, 15, 0)', 'rgba(10, 11, 15, 0.9)']) }),
  surfaceFade: Object.freeze({ angle: 180, colors: Object.freeze(['rgba(21, 23, 29, 0)', 'rgba(21, 23, 29, 0.9)']) }),
  // UX §8.6: the gold-tinted dark day card (PlanDayCard "Today").
  goldCard: Object.freeze({ angle: 160, colors: Object.freeze(['#2A2512', '#16150F']) }),
  // v2 kit: auth screens (Phase 2 A; UX A boards' own radial geometry; the
  // §8.5 ladder colours: welcome/card corner/hero = gold orb, account = gold
  // ambient, sign-in failed = danger ambient, Today error = danger orb).
  welcomeGlow: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.3, rx: 0.9, ry: 0.55 }),
    colors: GLOW.goldOrb,
    stops: Object.freeze([0, 0.65]),
  }),
  signInFailedGlow: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.2, rx: 0.9, ry: 0.45 }),
    colors: GLOW.dangerAmbient,
    stops: Object.freeze([0, 0.65]),
  }),
  signInFailedGlowTablet: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.3, rx: 0.7, ry: 0.45 }),
    colors: GLOW.dangerAmbient,
    stops: Object.freeze([0, 0.7]),
  }),
  accountGlow: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.2, rx: 0.9, ry: 0.45 }),
    colors: GLOW.goldAmbient,
    stops: Object.freeze([0, 0.65]),
  }),
  accountGlowTablet: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.3, rx: 0.7, ry: 0.45 }),
    colors: GLOW.goldAmbient,
    stops: Object.freeze([0, 0.7]),
  }),
  // The tablet auth cards' gold corner glow (a circle, gold 0.28 → 0).
  cardCornerGlow: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5 }),
    colors: GLOW.goldOrb,
    stops: Object.freeze([0, 1]),
  }),
  // v2 kit: Phase 2 Group B (Create profile, Today states)
  // Create profile phone CTA bar: transparent → ground at 35 % (UX B ND2).
  ctaBarFade: Object.freeze({
    angle: 180,
    colors: Object.freeze(['rgba(10, 11, 15, 0)', '#0A0B0F']),
    stops: Object.freeze([0, 0.35]),
  }),
  // Today-empty hero glow: a 260 circle of gold at 0.28 → 0 (UX B §Today, empty).
  heroGlow: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5 }),
    colors: GLOW.goldOrb,
    stops: Object.freeze([0, 1]),
  }),
  // Today error: the danger-tinted card gradient (160deg) and its red glow.
  dangerCard: Object.freeze({ angle: 160, colors: Object.freeze(['#2A1A1C', '#16121A']) }),
  dangerGlow: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5 }),
    colors: GLOW.dangerOrb,
    stops: Object.freeze([0, 1]),
  }),
  // UX §8.3: the decorative teal orb on teal-accent cards (a circle) and the
  // teal page wash (70 % 34 % at 90 % −6 %), §8.5 ladder alphas. aria-hidden,
  // no motion.
  tealOrb: Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5 }),
    colors: GLOW.tealOrb,
    stops: Object.freeze([0, 0.7]),
  }),
  tealAmbient: Object.freeze({
    radial: Object.freeze({ cx: 0.9, cy: -0.06, rx: 0.7, ry: 0.34 }),
    colors: GLOW.tealAmbient,
    stops: Object.freeze([0, 0.7]),
  }),
  // v2 kit: kit 2 (UX §8.7, 26 Oct)
  // U7 gradient-gold-select: the selected generator choice card, as drawn
  // (with a 2 px inset colors.gold ring on the card).
  goldSelect: Object.freeze({ angle: 150, colors: Object.freeze(['rgba(255, 194, 26, 0.22)', 'rgba(255, 194, 26, 0.06)']) }),
  // U3 the canonical gradient-gold (140°, 2 stops): the own-user avatar only.
  // The G tile stays SOLID gold (§7.1). `gold` above stays for its current
  // callers until the Phase 1 re-fold.
  goldAvatar: Object.freeze({ angle: 140, colors: Object.freeze(['#FFD45C', '#F4A300']) }),
});

// Every TextInput's caret and selection are gold, never the platform blue
// (UX Phase 1 review). Spread onto each TextInput.
export const textInputColors = Object.freeze({
  selectionColor: colors.gold,
  cursorColor: colors.gold,
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

// UX §8.4: text and icons on a 16 % muscle-tint pill (the lighter variant).
export const muscleText = Object.freeze({
  chest: '#A9BCFF',
  back: '#FFD45C',
  legs: '#B9C8E0',
  arms: '#DDB8FF',
  core: '#FFB07A',
  cardio: '#7FE6D6',
});

// UX §8.4 glow-muscle: the orb behind the exercise-detail hero, the muscle
// colour at 0.30 → transparent at 70 % (a circle).
export function muscleGlow(hex) {
  const value = parseInt(hex.slice(1), 16);
  const rgb = `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
  return Object.freeze({
    radial: Object.freeze({ cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5 }),
    colors: Object.freeze([`rgba(${rgb}, 0.30)`, `rgba(${rgb}, 0)`]),
    stops: Object.freeze([0, 0.7]),
  });
}

// Blur radii (px): §3 blur-glass, and UX §8.4 glass-strong / on-photo.
// v2 kit: kit 2 (UX §8.7): U12 scrim backdrops blur 4 on phones and 6 on
// tablets; U4 the dark loading disc (colors.scrimStrong) blurs 16. Ruling 2
// amendment 2 (27 Oct 2026): the status-bar backdrop (and the session band)
// blurs 20 under colors.groundTranslucent.
export const blur = Object.freeze({ glass: 24, glassStrong: 24, onPhoto: 12, groundBar: 24, scrim: 4, scrimTablet: 6, scrimStrong: 16, statusBar: 20 });

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

// UX native final audit 27 Oct 2026, ruling 5 as amended by (k)/(f2) ruling
// f2: big titles keep letter-spacing ≥ −0.04em ON ANDROID ONLY. Tighter
// tracking (−0.045 / −0.05 / −0.055em as drawn) converted to px goes past
// Geist's glyph advance on Android and the letters collide ("Findatrainer");
// iOS renders the drawn values correctly and keeps them. titleTracking is the
// one em → px conversion for titles: on Android it clamps at the floor (a
// drawn −0.055em becomes −0.04em), on iOS it returns the board value. It
// reads Platform.OS when called (module load for the StyleSheets).
export const TITLE_TRACKING_MIN_EM = -0.04;
export function titleTracking(fontSize, trackingEm = 0) {
  const em = Platform.OS === 'android' ? Math.max(trackingEm, TITLE_TRACKING_MIN_EM) : trackingEm;
  return Math.round(em * fontSize * 100) / 100;
}

// One scale step: size / line height in px, tracking in em (→ px for RN).
function step(fontSize, lineHeight, weight, trackingEm = 0) {
  return Object.freeze({ ...font(weight), fontSize, lineHeight, letterSpacing: titleTracking(fontSize, trackingEm) });
}

// §2 scale. Every changing number also sets fontVariant ['tabular-nums'].
// UX §9 large text: the most each text role scales (maxFontSizeMultiplier),
// and the text scale above which layouts reflow (tab bar → icons only).
export const textScale = Object.freeze({
  display: 1.3,
  title: 1.6,
  body: 2.0,
  tabLabel: 1.2,
  badge: 1.2,
  pill: 1.6,
  timer: 1.2,
  iconsOnlyAbove: 1.3,
  reflowAbove: 1.3,
  // v2 kit: kit 2 (UX §8.7 U13): a field's unit suffix (kg, cm …).
  suffix: 1.6,
});

export const typography = Object.freeze({
  // Ruling 5 (f2): the board's −0.06 / −0.05 / −0.045 / −0.05em; Android
  // holds them at the −0.04em floor (step → titleTracking).
  displayTimer: step(92, 92, 700, -0.06),
  displayXl: step(56, 58, 700, -0.05),
  displayLg: step(52, 52, 700, -0.045),
  displayMd: step(44, 44, 700, -0.05),
  titleXl: step(36, 40, 700, -0.04),
  titleLg: step(30, 32, 700, -0.04),
  titleMd: step(24, 28, 700, -0.03),
  titleSm: step(22, 28, 700, -0.03),
  // FINAL-AUDIT "Rulings for FE batch 1": the phone bottom-sheet title.
  titleSheet: step(26, 30, 700, -0.03),
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

// §3 Elevation: two shadows only. goldGlow under the ONE gold primary of a
// screen; float for glass chrome, toasts, sheets and dialogs.
// T-86 (owner-approved, softer): ONE gold glow token, CSS
// `0 10px 24px -12px rgba(255,194,26,0.40)`, at every size (the 60 px
// goldGlowLarge is retired). Never on chips, tiles, badges or cards, and
// never on a button inside a dialog or sheet (PillButton's NoGlow scope).
const V2_SHADOWS = {
  goldGlow: '0px 10px 24px -12px rgba(255, 194, 26, 0.4)',
  float: '0px 16px 40px rgba(0, 0, 0, 0.5)',
  // v2 kit: kit 2 (UX §5 / §8.6 / §8.6a 2 / §8.7 U11). shadow-gold-glow is
  // goldGlow above (T-86: the -lg step is the same token). sheet: centred
  // dialogs (tablet cards); sheetUp: every bottom sheet.
  sheet: '0px 30px 80px rgba(0, 0, 0, 0.6)',
  sheetUp: '0px -10px 50px rgba(0, 0, 0, 0.6)',
};

// v1 shadows as aliases: the gold glows map to goldGlow, overlay shadows to
// float, and every other lift/press/emboss/ring is retired (`undefined`
// draws no shadow). Deleted in Phase 4 with the colour aliases.
const LEGACY_SHADOWS = {
  glow: V2_SHADOWS.goldGlow,
  brand: V2_SHADOWS.goldGlow,
  modal: V2_SHADOWS.float,
  dialog: V2_SHADOWS.float,
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
// lgPlus / xxxl / xxxxl / tile: the board radii with no UX ladder token
// (phase2-open-items §3): 22 tablet chips and the 64 tile, 32 phone cards,
// 36 tablet cards, 38 the 120 session tile.
export const radii = Object.freeze({
  sm: 12,
  md: 16,
  lg: 20,
  lgPlus: 22,
  xl: 24,
  xxl: 28,
  xxxl: 32,
  xxxxl: 36,
  tile: 38,
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
  // §7.1 the phone's floating tab bar: 66 tall, 20 above the bottom safe
  // area. The one source for the shell and the toast (86 clears it).
  tabBarHeight: 66,
  tabBarBottomGap: 20,
  // v2 kit: kit 2 (UX §8.7 U13): the gap between typed text and a field's
  // unit suffix (right padding = inset + measured suffix width + this).
  suffixGap: 16,
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
  // Under reduced motion a spinner slows to this pace; it never stops (v2 §5).
  spinnerReducedLoopMs: 3000,
  fadeMs: 240,
  slideUpMs: 300,
  slideUpOffsetY: 10,
});
