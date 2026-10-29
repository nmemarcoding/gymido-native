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

  // DECLARED (T-101, PM OK 29 Oct with UX's ruling): was "no action buttons and no Dynamic Island content" (the
  // widget had exactly 4 EmptyView()). The island now shows the rest countdown (region checks below); still no
  // Button / Link.
  it('no action buttons or links anywhere', () => {
    expect(code + widgetCode).not.toMatch(/Button\(|Link\(/);
  });
});

// T-101 (UX ruling T101-dynamic-island, amends F2): the Dynamic Island regions.
const widgetCode = widget.replace(/\/\/.*$/gm, '');
const region = (start, end) => widgetCode.slice(widgetCode.indexOf(start), end ? widgetCode.indexOf(end) : undefined);

describe('Live Activity Dynamic Island (T-101)', () => {
  it('compactLeading: the G mark, 20pt, radius 6, "G" 12', () => {
    expect(region('compactLeading:', 'compactTrailing:')).toMatch(/RestCountdownAppMark\(size: 20, radius: 6, fontSize: 12\)/);
  });

  it('compactTrailing: the OS countdown, 15/600 gold, monospaced digits, a fixed width (m:ss / h:mm:ss)', () => {
    const trailing = region('compactTrailing:', 'minimal:');
    expect(trailing).toMatch(/Text\(timerInterval: interval, countsDown: true\)/);
    expect(trailing).toMatch(/\.font\(\.system\(size: 15, weight: \.semibold\)\)/);
    expect(trailing).toMatch(/\.monospacedDigit\(\)/);
    expect(trailing).toMatch(/\.foregroundStyle\(RestCountdownColors\.gold\)/);
    expect(trailing).toMatch(/\.frame\(width: RestIsland\.compactWidth\(interval\)\)/);
    expect(widgetCode).toMatch(/>= 3600 \? 64 : 42/);
    // DECLARED (T-101 review L1, PM OK 29 Oct): was not.toMatch(/remaining/); "remaining" now lives ONLY in the
    // VoiceOver value (no visible word, as ruled).
    expect(trailing.replace(/\.accessibilityValue\(.*\)/g, '')).not.toMatch(/remaining/);
    expect(trailing).toMatch(/\.accessibilityValue\(Text\(timerInterval: interval, countsDown: true\) \+ Text\(" remaining"\)\)/);
  });

  it('minimal: a gold circular ring of the remaining time, no digits', () => {
    const minimal = region('minimal:', '.keylineTint');
    expect(minimal).toMatch(/ProgressView\(timerInterval: interval, countsDown: true/);
    expect(minimal).toMatch(/\.progressViewStyle\(\.circular\)/);
    expect(minimal).toMatch(/\.tint\(RestCountdownColors\.gold\)/);
    // DECLARED (T-101 review L1, PM OK 29 Oct): was not.toMatch(/Text\(timerInterval/); the time is now in the VoiceOver
    // value only, never drawn (no digits).
    expect(minimal.replace(/\.accessibilityValue\(.*\)/g, '')).not.toMatch(/Text\(timerInterval/);
    expect(minimal).toMatch(/\.accessibilityValue\(Text\(timerInterval: interval, countsDown: true\) \+ Text\(" remaining"\)\)/);
  });

  it('expanded: G mark + "Rest timer" (secondary) · the 34/700 gold countdown · the bar (6, remaining, no glow); center empty', () => {
    const expanded = region('DynamicIslandExpandedRegion(.leading)', 'compactLeading:');
    expect(expanded).toMatch(/RestCountdownAppMark\(\)[\s\S]*?Text\("Rest timer"\)[\s\S]*?RestCountdownColors\.textSecondary/);
    expect(expanded).toMatch(/DynamicIslandExpandedRegion\(\.trailing\)[\s\S]*?Text\(timerInterval: interval, countsDown: true\)\s*\.font\(\.system\(size: 34, weight: \.bold\)\)[\s\S]*?\.foregroundStyle\(RestCountdownColors\.gold\)/);
    expect(expanded).toMatch(/DynamicIslandExpandedRegion\(\.bottom\)[\s\S]*?RestIslandBar\(interval: interval\)/);
    expect(widgetCode).not.toMatch(/DynamicIslandExpandedRegion\(\.center\)/);
    const bar = region('struct RestIslandBar');
    expect(bar).toMatch(/ProgressView\(timerInterval: interval, countsDown: true/);
    expect(bar).toMatch(/frame\(height: 6\)/);
    expect(bar).not.toMatch(/shadow/);
  });

  it('keylineTint gold; VoiceOver "Gymido rest timer" + the time + " remaining" (as the lock card)', () => {
    expect(widgetCode).toMatch(/\.keylineTint\(RestCountdownColors\.gold\)/);
    expect(widgetCode).toMatch(/\.accessibilityLabel\("Gymido rest timer"\)\s*\.accessibilityValue\(Text\(timerInterval: interval, countsDown: true\) \+ Text\(" remaining"\)\)/);
    // The island adds no deep link: a tap opens the app as the lock card does.
    expect(widgetCode).not.toMatch(/widgetURL/);
  });
});

describe('T-101 review L1: compact + minimal speak the time', () => {
  it('compactTrailing and minimal carry the lock card\'s accessibilityValue (time + " remaining")', () => {
    const value = /\.accessibilityLabel\("Gymido rest timer"\)\s*\.accessibilityValue\(Text\(timerInterval: interval, countsDown: true\) \+ Text\(" remaining"\)\)/;
    expect(region('compactTrailing:', 'minimal:')).toMatch(value);
    expect(region('minimal:', '.keylineTint')).toMatch(value);
  });
});

