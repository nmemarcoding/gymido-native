import { blur, colors, gradients, layout, legacyColorKeys, legacyShadowKeys, muscle, musclePalette, radii, shadows, textScale } from './tokens';

// RN-SPEC-v2-foundation §1–3 (UX tokens-and-components FINAL, 26 Oct 2026).

// WCAG relative luminance and contrast ratio of two opaque hex colours.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('v2 colours (§1)', () => {
  it.each([
    ['ground', '#0A0B0F'],
    ['groundDeep', '#0B0C10'],
    ['surface', '#15171D'],
    ['surfaceSunk', '#111318'],
    ['surfaceRaised', '#1E2129'],
    ['surfaceInput', '#1A1D24'],
    ['glass', 'rgba(30, 33, 41, 0.72)'],
    ['glassToast', 'rgba(30, 33, 41, 0.85)'],
    ['glassSolid', 'rgba(30, 33, 41, 0.96)'],
    // UX native final audit 27 Oct 2026, ruling 2: the status-bar backdrop fallback.
    ['groundFallback', 'rgba(10, 11, 15, 0.96)'],
    // Ruling 2 amendment 2 (27 Oct 2026): the backdrop's translucent fill where blur exists.
    ['groundTranslucent', 'rgba(10, 11, 15, 0.86)'],
    ['hairline', 'rgba(255, 255, 255, 0.07)'],
    ['hairlineStrong', 'rgba(255, 255, 255, 0.10)'],
    ['scrim', 'rgba(10, 11, 15, 0.6)'],
    ['textPrimary', '#F5F6F8'],
    ['textStrong2', '#D4D7DD'],
    ['textSecondary', '#B4B9C3'],
    ['textMuted', '#9BA1AD'],
    ['textFaint', '#8B919C'],
    ['textDisabled', '#6E7480'],
    ['onGold', '#0A0B0F'],
    ['onLight', '#0A0B0F'],
    ['gold', '#FFC21A'],
    ['goldLight', '#FFD45C'],
    ['goldDeep', '#F4A300'],
    ['goldTint', 'rgba(255, 194, 26, 0.14)'],
    ['success', '#4ADE80'],
    ['teal', '#4FD8C4'],
    ['warning', '#F5A524'],
    ['danger', '#D93036'],
    ['dangerText', '#FF7A70'],
    ['dangerDot', '#FF5A4E'],
    ['info', '#8FA8FF'],
  ])('%s = %s', (key, value) => {
    expect(colors[key]).toBe(value);
  });

  it('info and chest share the hue as two tokens (UX)', () => {
    expect(colors.info).toBe(muscle.chest);
  });

  it('muscle colours are the six v2 hues, each ≥ 7:1 on the ground', () => {
    expect(muscle).toEqual({ chest: '#8FA8FF', back: '#FFC21A', legs: '#9DB0CF', arms: '#C79BFF', core: '#FF9A57', cardio: '#4FD8C4' });
    Object.values(muscle).forEach((hue) => expect(contrast(hue, colors.ground)).toBeGreaterThanOrEqual(7));
  });

  it('maps every v1 thumbnail group onto a muscle colour (UX mapping)', () => {
    const hues = Object.values(muscle);
    const { iconLight, iconDark, ...groups } = musclePalette;
    Object.values(groups).forEach((hue) => expect(hues).toContain(hue));
    expect(musclePalette.lats).toBe(muscle.back);
    expect(musclePalette.forearms).toBe(muscle.arms);
    expect(musclePalette.obliques).toBe(muscle.core);
    expect(musclePalette.glutes).toBe(muscle.legs);
  });
});

describe('contrast (§1.2 ratios)', () => {
  it.each([
    ['textPrimary', 'ground', 18],
    ['textSecondary', 'surface', 9],
    ['textMuted', 'surfaceRaised', 6],
    ['textFaint', 'surfaceRaised', 5],
    ['onGold', 'gold', 12],
    ['onDanger', 'danger', 4.7],
    ['gold', 'surface', 11],
  ])('%s on %s ≥ %d:1', (fg, bg, min) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min);
  });

  it('text-disabled stays below 4.5:1 on raised (decoration only, never copy)', () => {
    expect(contrast(colors.textDisabled, colors.surfaceRaised)).toBeLessThan(4.5);
  });
});

describe('radius and elevation (§3)', () => {
  it('has one value per use', () => {
    expect(radii).toEqual({ sm: 12, md: 16, lg: 20, lgPlus: 22, xl: 24, xxl: 28, xxxl: 32, xxxxl: 36, tile: 38, full: 999 });
  });

  it('has two shadows: the ONE gold glow (T-86, every size) and float', () => {
    // DECLARED (T-86): was 0px 10px 30px -8px … 0.55 plus goldGlowLarge 0px 14px 36px -10px … 0.6.
    expect(shadows.goldGlow).toBe('0px 10px 24px -12px rgba(255, 194, 26, 0.4)');
    expect(shadows.goldGlowLarge).toBeUndefined();
    expect(shadows.float).toBe('0px 16px 40px rgba(0, 0, 0, 0.5)');
  });

  it('retires v1 lift/press/emboss shadows (no shadow) and maps the rest onto the two', () => {
    ['soft', 'lift1', 'lift2', 'lift3', 'press', 'emboss', 'insetSoft'].forEach((key) => expect(shadows[key]).toBeUndefined());
    expect(shadows.glow).toBe(shadows.goldGlow);
    expect(shadows.modal).toBe(shadows.float);
  });
});

describe('v1 aliases (deleted in Phase 4)', () => {
  it('never override a v2 name', () => {
    expect(colors.danger).toBe('#D93036');
    expect(colors.surface).toBe('#15171D');
    expect(legacyColorKeys).not.toContain('danger');
    expect(legacyColorKeys).not.toContain('surface');
  });

  it('keep the gold, text and danger roles on their v2 values', () => {
    expect(colors.brand400).toBe(colors.gold);
    expect(colors.brand700).toBe(colors.gold);
    // v1 navy = the ink on gold (UX Phase 1 review).
    expect(colors.navy).toBe(colors.onGold);
    expect(colors.errorText).toBe(colors.dangerText);
    expect(colors.background).toBe(colors.ground);
  });

  it('are listed, so Phase 4 can delete them', () => {
    expect(legacyColorKeys.length).toBeGreaterThan(0);
    expect(legacyShadowKeys).toEqual(expect.arrayContaining(['soft', 'lift1', 'glow', 'modal']));
  });
});

describe('type (§2)', () => {
  const { FONT_FAMILY, font, typography } = require('./tokens');

  it('maps each Geist weight to its bundled family, fontFamily only', () => {
    expect(FONT_FAMILY).toEqual({ 400: 'Geist-Regular', 500: 'Geist-Medium', 600: 'Geist-SemiBold', 700: 'Geist-Bold' });
    expect(font(600)).toEqual({ fontFamily: 'Geist-SemiBold' });
    expect(font('500')).toEqual({ fontFamily: 'Geist-Medium' });
    expect(font()).toEqual({ fontFamily: 'Geist-Regular' });
  });

  it('has no 900: heavier weights fall back to Bold; unknown light ones to Regular', () => {
    expect(font(900)).toEqual({ fontFamily: 'Geist-Bold' });
    expect(font(800)).toEqual({ fontFamily: 'Geist-Bold' });
    expect(font(300)).toEqual({ fontFamily: 'Geist-Regular' });
  });

  it('never sets fontWeight next to the family (Android would fake bold)', () => {
    Object.values(typography).forEach((style) => expect(style.fontWeight).toBeUndefined());
  });

  // DECLARED (UX native final audit 27 Oct 2026, (k)/(f2) ruling f2: the
  // −0.04em floor is Android-only): this table runs on the Jest default
  // platform (iOS), so displayTimer −3.68 → −5.52 and displayXl −2.24 → −2.8
  // (back to the board's −0.06 / −0.05em). The Android values are pinned in
  // "ruling 5 (f2): …per platform" below.
  it.each([
    ['displayTimer', 92, 92, 'Geist-Bold', -5.52],
    ['displayXl', 56, 58, 'Geist-Bold', -2.8],
    ['titleXl', 36, 40, 'Geist-Bold', -1.44],
    // FINAL-AUDIT batch 1: the phone sheet title 26/30 700 (tracking −0.03em).
    ['titleSheet', 26, 30, 'Geist-Bold', -0.78],
    ['titleMd', 24, 28, 'Geist-Bold', -0.72],
    ['titleXs', 18, 24, 'Geist-Bold', -0.36],
    ['bodyLg', 16, 24, 'Geist-Regular', 0],
    ['body', 15, 22, 'Geist-Regular', 0],
    ['labelLg', 16, 20, 'Geist-SemiBold', 0],
    ['label', 13, 18, 'Geist-Medium', 0],
    ['caption', 12, 16, 'Geist-Regular', 0],
    ['micro', 11, 14, 'Geist-Medium', 0],
  ])('%s = %d/%d %s, tracking %d px', (key, size, line, family, tracking) => {
    expect(typography[key]).toEqual({ fontFamily: family, fontSize: size, lineHeight: line, letterSpacing: tracking });
  });

  // UX native final audit 27 Oct 2026, ruling 5 as amended by (f2): the
  // −0.04em floor is ANDROID-ONLY (that's where Geist collapses); iOS keeps
  // the board values. The token table is built at module load, so each
  // platform gets its own copy of the module.
  // DECLARED: "every display / title step tracks at −0.04em or looser" (all
  // platforms) → the same check on the Android table only.
  function tokensOn(os) {
    let mod;
    jest.isolateModules(() => {
      require('react-native').Platform.OS = os;
      mod = require('./tokens');
    });
    return mod;
  }
  const DISPLAY_STEPS = [
    // key, size, board em, Android px (−0.04em floor), iOS px (board)
    ['displayTimer', 92, -0.06, -3.68, -5.52],
    ['displayXl', 56, -0.05, -2.24, -2.8],
    ['displayLg', 52, -0.045, -2.08, -2.34],
    ['displayMd', 44, -0.05, -1.76, -2.2],
  ];

  it.each(DISPLAY_STEPS)('ruling 5 (f2): %s %d px tracks per platform', (key, size, _em, android, ios) => {
    expect(tokensOn('android').typography[key]).toMatchObject({ fontSize: size, letterSpacing: android });
    expect(tokensOn('ios').typography[key]).toMatchObject({ fontSize: size, letterSpacing: ios });
  });

  it('ruling 5 (f2): on Android every display / title step tracks at −0.04em or looser', () => {
    const steps = Object.entries(tokensOn('android').typography).filter(([key]) => /^(display|title)/.test(key));
    expect(steps.length).toBeGreaterThan(8);
    steps.forEach(([key, style]) => {
      expect([key, style.letterSpacing >= -0.04 * style.fontSize - 1e-9]).toEqual([key, true]);
    });
  });

  // DECLARED: "titleTracking converts em to px and clamps at −0.04em"
  // (48/−0.055 → −1.92, 60/−0.06 → −2.4 on every platform) → split per
  // platform: Android clamps (−1.92 / −2.4), iOS returns the board (−2.64 / −3.6).
  describe('ruling 5 (f2): titleTracking', () => {
    const { Platform } = require('react-native');
    const realOS = Platform.OS;
    afterEach(() => {
      Platform.OS = realOS;
    });

    it('Android: converts em to px and clamps at −0.04em', () => {
      Platform.OS = 'android';
      const { TITLE_TRACKING_MIN_EM, titleTracking } = require('./tokens');
      expect(TITLE_TRACKING_MIN_EM).toBe(-0.04);
      expect(titleTracking(48, -0.055)).toBe(-1.92);
      expect(titleTracking(60, -0.06)).toBe(-2.4);
      expect(titleTracking(84, -0.06)).toBe(-3.36);
      expect(titleTracking(24, -0.03)).toBe(-0.72);
      expect(titleTracking(16)).toBe(0);
    });

    it('iOS: converts em to px unclamped (the board value)', () => {
      Platform.OS = 'ios';
      const { titleTracking } = require('./tokens');
      expect(titleTracking(48, -0.055)).toBe(-2.64);
      expect(titleTracking(60, -0.06)).toBe(-3.6);
      expect(titleTracking(84, -0.06)).toBe(-5.04);
      expect(titleTracking(24, -0.03)).toBe(-0.72);
      expect(titleTracking(16)).toBe(0);
    });
  });

  it('keeps every size at the 11 px minimum', () => {
    Object.values(typography).forEach((style) => expect(style.fontSize).toBeGreaterThanOrEqual(11));
  });
});

describe('spacing, layout, breakpoints, motion (§3)', () => {
  const { breakpoints, layout, motion, spacing } = require('./tokens');

  it('spaces on a 2 px base, drawn on 4', () => {
    expect(spacing).toEqual({ '0_5': 2, 1: 4, '1_5': 6, 2: 8, '2_5': 10, 3: 12, '3_5': 14, 4: 16, '4_5': 18, 5: 20, '5_5': 22, 6: 24, 7: 28, 8: 32 });
  });

  it('has the gutter, the 44 touch minimum, the 88 rail and the 1120 cap', () => {
    expect(layout).toEqual({ gutter: 16, touchMin: 44, railWidth: 88, contentMax: 1120, tabBarHeight: 66, tabBarBottomGap: 20, suffixGap: 16 });
  });

  it('splits phone < 768, tablet 768–1279, web ≥ 1280', () => {
    expect(breakpoints.md).toBe(768);
    expect(breakpoints.xl).toBe(1280);
  });

  it('keeps the v1 durations and curves', () => {
    expect([motion.durationFast, motion.durationBase, motion.durationSlow]).toEqual([150, 200, 300]);
    expect(motion.easeSpring).toEqual([0.22, 1, 0.36, 1]);
    expect(motion.easePop).toEqual([0.34, 1.56, 0.64, 1]);
    expect(motion.spinnerLoopMs).toBe(1000);
    expect(motion.spinnerReducedLoopMs).toBe(3000);
  });
});

describe('kit 2 tokens (UX §8.7 U1–U13, §8.6 shadow-sheet)', () => {
  it('U8 fill-glass 0.08 (= the glass secondary button fill)', () => {
    expect(colors.fillGlass).toBe('rgba(255, 255, 255, 0.08)');
    expect(colors.fillGlass).toBe(colors.fillButton);
  });

  it('U7 gradient-gold-select: 150°, gold 0.22 → 0.06', () => {
    expect(gradients.goldSelect).toEqual({ angle: 150, colors: ['rgba(255, 194, 26, 0.22)', 'rgba(255, 194, 26, 0.06)'] });
  });

  it('U3 canonical gradient-gold for the own avatar: 140°, #FFD45C → #F4A300 (2 stops); gradients.gold is unchanged', () => {
    expect(gradients.goldAvatar).toEqual({ angle: 140, colors: ['#FFD45C', '#F4A300'] });
    expect(gradients.gold.angle).toBe(145);
  });

  it('U11 shadow-gold-glow (T-86: one token, -lg retired); sheet and sheetUp', () => {
    expect(shadows.goldGlow).toBe('0px 10px 24px -12px rgba(255, 194, 26, 0.4)');
    expect(Object.keys(shadows).filter((key) => /gold/i.test(key))).toEqual(['goldGlow']);
    expect(shadows.sheet).toBe('0px 30px 80px rgba(0, 0, 0, 0.6)');
    expect(shadows.sheetUp).toBe('0px -10px 50px rgba(0, 0, 0, 0.6)');
    // sheetUp is a v2 token now, no longer a v1 alias of float.
    expect(legacyShadowKeys).not.toContain('sheetUp');
  });

  it('U12 scrim blur 4 phone / 6 tablet; U4 the dark disc blur 16; the earlier radii unchanged', () => {
    // DECLARED (final batch, 27 Oct 2026, ruling 2 amendment 2): + statusBar 20, the status-bar / session band blur.
    expect(blur).toEqual({ glass: 24, glassStrong: 24, onPhoto: 12, groundBar: 24, scrim: 4, scrimTablet: 6, scrimStrong: 16, statusBar: 20 });
  });

  it('U13 the unit suffix caps at 1.6 and keeps a 16 gap', () => {
    expect(textScale.suffix).toBe(1.6);
    expect(layout.suffixGap).toBe(16);
  });

  it('U4 / U9 / U5 reuse existing tokens', () => {
    expect(colors.scrimStrong).toBe('rgba(10, 11, 15, 0.72)');
    expect(colors.textFaint).toBe('#8B919C');
    expect(colors.infoFaint).toBe('rgba(143, 168, 255, 0.08)');
    expect(colors.infoLine).toBe('rgba(143, 168, 255, 0.30)');
  });
});
