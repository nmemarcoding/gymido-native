import { colors, legacyColorKeys, legacyShadowKeys, muscle, musclePalette, radii, shadows } from './tokens';

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
    expect(radii).toEqual({ sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, full: 999 });
  });

  it('has two shadows: the gold glow (with its 60 px size) and float', () => {
    expect(shadows.goldGlow).toBe('0px 10px 30px -8px rgba(255, 194, 26, 0.55)');
    expect(shadows.goldGlowLarge).toBe('0px 14px 36px -10px rgba(255, 194, 26, 0.6)');
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
    expect(colors.navy).toBe(colors.textPrimary);
    expect(colors.errorText).toBe(colors.dangerText);
    expect(colors.background).toBe(colors.ground);
  });

  it('are listed, so Phase 4 can delete them', () => {
    expect(legacyColorKeys.length).toBeGreaterThan(0);
    expect(legacyShadowKeys).toEqual(expect.arrayContaining(['soft', 'lift1', 'glow', 'modal']));
  });
});
