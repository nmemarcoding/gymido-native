// T-51: the iOS Live Activity rest card follows UX F2 "Lock screen (native)"
// (RN-SPEC-v2-phase3 §4). Swift can't run under jest, so these pin the
// widget source: colours from tokens.js, the string set, the bar direction.
const fs = require('fs');
const path = require('path');
const { colors } = require('../theme/tokens');

const WIDGET = path.join(__dirname, '..', '..', '..', 'modules', 'rest-countdown', 'widget');
const card = fs.readFileSync(path.join(WIDGET, 'RestCountdownCardView.swift'), 'utf8');
const widget = fs.readFileSync(path.join(WIDGET, 'RestCountdownWidget.swift'), 'utf8');

const hex = (h) => h.match(/[0-9a-f]{2}/gi).map((p) => parseInt(p, 16));
const swiftColor = (name) => {
  const m = card.match(new RegExp(`static let ${name} = Color\\(red: (\\d+) / 255, green: (\\d+) / 255, blue: (\\d+) / 255\\)`));
  return m ? m.slice(1, 4).map(Number) : null;
};
// Code only: the strings in comments don't count.
const code = card.replace(/\/\/.*$/gm, '');

describe('Live Activity card colours (tokens.js, F2)', () => {
  it.each([
    ['gold', colors.gold],
    ['onGold', colors.onGold],
    ['textPrimary', colors.textPrimary],
    ['textSecondary', colors.textSecondary],
  ])('%s matches the token', (name, token) => {
    expect(swiftColor(name)).toEqual(hex(token));
  });

  it('the card tint is rgba(18,20,26,0.9), not the old gold field', () => {
    expect(card).toMatch(/static let card = Color\(red: 18 \/ 255, green: 20 \/ 255, blue: 26 \/ 255\)\.opacity\(0\.9\)/);
    expect(widget).toMatch(/\.activityBackgroundTint\(RestCountdownColors\.card\)/);
    expect(card).not.toMatch(/navy/);
  });

  it('digits and bar are gold', () => {
    expect(code).toMatch(/Text\(timerInterval: interval, countsDown: true\)\s*\.font\(\.system\(size: 60, weight: \.bold\)\)[\s\S]*?\.foregroundStyle\(RestCountdownColors\.gold\)/);
    expect(code).toMatch(/\.tint\(RestCountdownColors\.gold\)/);
  });
});

describe('Live Activity card strings and behaviour (F2 code-wins notes)', () => {
  it('shows only "Gymido", "Rest timer" and the G mark as text', () => {
    const visible = code.replace(/\.accessibilityValue\(.*\)/g, '');
    const shown = [...visible.matchAll(/Text\("([^"]*)"\)/g)].map((m) => m[1]);
    expect(shown.sort()).toEqual(['G', 'Gymido', 'Rest timer']);
  });

  it('"remaining" lives only in the VoiceOver value', () => {
    expect(code.match(/remaining/g)).toHaveLength(1);
    expect(code).toMatch(/\.accessibilityValue\(Text\(timerInterval: interval, countsDown: true\) \+ Text\(" remaining"\)\)/);
    expect(code).toMatch(/\.accessibilityElement\(children: \.ignore\)/);
    expect(code).toMatch(/\.accessibilityLabel\("Gymido rest timer"\)/);
  });

  it('the bar counts down (fill = time remaining)', () => {
    expect(code).toMatch(/ProgressView\(timerInterval: interval, countsDown: true/);
  });

  it('no action buttons and no Dynamic Island content', () => {
    expect(code + widget).not.toMatch(/Button\(|Link\(/);
    expect(widget.match(/EmptyView\(\)/g)).toHaveLength(4);
  });
});
