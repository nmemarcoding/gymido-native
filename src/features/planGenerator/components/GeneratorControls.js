import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import GradientFill from '../../../shared/components/GradientFill';
import { colors, font, gradients, layout, radii, spacing, textScale, typography } from '../../../shared/theme/tokens';

// Controls of RN-SPEC-PLAN-GENERATOR §G1.2 and the G2 callouts. v2 look:
// RN-SPEC-v2-foundation §4.4 (Option pill / Choice), §4.6 (Checkbox, card
// radio) and §5 (Callout), as drawn on the "GeneratorControls" board; the
// colours are the PlanGenerator / GeneratorStates boards' on the UX §8.5
// ladder. Pressed = the rest colour + a 4 % overlay (§8.6 STATE RULE).

// UX §9 large text: every label here is body/label text (scales to 2×, never
// truncated: labels wrap and the controls grow from their min heights).
const BODY_TEXT = Object.freeze({ maxFontSizeMultiplier: textScale.body });

// The §8.6 press overlay: a full-bleed View over the rest colour.
function PressOverlay({ pressed, ink = false }) {
  return pressed ? (
    <View testID="press-overlay" pointerEvents="none" style={[StyleSheet.absoluteFill, ink ? styles.overlayInk : styles.overlay]} />
  ) : null;
}

// The Choice's 24 px gold disc with "✓". Its slot is ALWAYS reserved (empty
// when off), so the row never shifts.
function Check({ on }) {
  return (
    <View testID={on ? 'choice-check' : 'choice-check-slot'} style={[styles.check, on && styles.checkOn]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {on ? (
        <Text numberOfLines={1} textBreakStrategy="simple" maxFontSizeMultiplier={textScale.badge} style={styles.checkMark}>
          ✓
        </Text>
      ) : null}
    </View>
  );
}

// Full-width choice row (the card radio): min-height 56, radius 16. Off =
// gradient-card + a 0.08 edge (PlanGenerator board) and an empty 1.5 px
// hairline-bright ring; selected = gold-faint fill + an inset 1.5 px gold
// ring + the gold disc. The fill layer mounts with the row (SVG; never added
// on a state change) and only its colours change.
const CHOICE_ON_FILL = Object.freeze([colors.goldFaint, colors.goldFaint]);
export function Choice({ label, hint, selected, disabled = false, onPress, testID }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      accessibilityState={{ selected, checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected ? styles.choiceOn : styles.choiceOff, disabled && styles.disabled]}
    >
      {({ pressed }) => (
        <>
          <GradientFill angle={gradients.card.angle} colors={selected ? CHOICE_ON_FILL : gradients.card.colors} />
          <PressOverlay pressed={pressed && !selected} />
          <View style={styles.flex}>
            <Text {...BODY_TEXT} style={styles.choiceLabel}>
              {label}
            </Text>
            {hint ? (
              <Text {...BODY_TEXT} style={styles.choiceHint}>
                {hint}
              </Text>
            ) : null}
          </View>
          <Check on={Boolean(selected)} />
        </>
      )}
    </Pressable>
  );
}

export function ChoiceList({ children }) {
  return <View style={styles.choiceList}>{children}</View>;
}

// Option pill (board: 40 tall, padding 0 14; gold when selected, glass when
// not) with a 44 hit area. T-18/T-40: step 6 pills pass their role and hint
// (the section label, plus a block hint).
const PILL_HEIGHT = 40;
const PILL_SLOP = (layout.touchMin - PILL_HEIGHT) / 2;
const PILL_HIT_SLOP = { top: PILL_SLOP, bottom: PILL_SLOP, left: 0, right: 0 };

export function OptionPill({
  label,
  selected,
  disabled = false,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityHint,
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={PILL_HIT_SLOP}
      style={[styles.pill, selected ? styles.pillOn : styles.pillRest, disabled && styles.disabled]}
    >
      {({ pressed }) => (
        <>
          {/* §8.6: pressed gold = gold + ink 4 %; pressed glass = + white 4 %. */}
          <PressOverlay pressed={pressed} ink={selected} />
          {/* Design system v1 #15 (kept in v2): a leading ✓ when selected. Its
              space is always reserved (transparent when off), so the pill never
              changes width. */}
          <View style={styles.pillContent}>
            <Text
              {...BODY_TEXT}
              style={[styles.pillCheck, !selected && styles.pillCheckOff]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              ✓
            </Text>
            <Text {...BODY_TEXT} style={[styles.pillText, selected ? styles.pillTextOn : styles.pillTextOff]}>
              {label}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

export function PillRow({ children, style }) {
  return <View style={[styles.pillRow, style]}>{children}</View>;
}

// §4.6 Checkbox: 24 × 24, radius 8. Off: a 1.5 px border; on: gold fill + a
// dark ✓. The caller's row (min-height 44) is the hit target.
export function Checkbox({ checked }) {
  return (
    <View
      style={[styles.checkbox, checked ? styles.checkboxOn : styles.checkboxOff]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {checked ? (
        <Svg testID="checkbox-mark" width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12l5 5L20 7" stroke={colors.onGold} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

// §5 Callout: the tone is the fill and border; the text is text-strong-2.
// UX §8.5 ladder: fill = {tone}-faint 0.08 (folds 0.10), edge = {tone}-line
// 0.30 (folds 0.22–0.28).
const CALLOUT_TONES = {
  info: { borderColor: colors.infoLine, backgroundColor: colors.infoFaint },
  warning: { borderColor: colors.warningLine, backgroundColor: colors.warningFaint },
  // G6 refusal's "what to change" (GeneratorStates board): teal 0.10 fill →
  // teal-faint, 0.25 edge → teal-line.
  teal: { borderColor: colors.tealLine, backgroundColor: colors.tealFaint },
};
// The teal callout's text: the pale teal drawn → teal-text (§8.5).
const CALLOUT_TEXT = { teal: { color: colors.tealText } };

// `role` is passed through (T-18: the GO_EASY_AREAS note is role="note").
export function Callout({ tone = 'info', children, testID, style, role }) {
  const look = CALLOUT_TONES[tone] ?? CALLOUT_TONES.info;
  return (
    <View testID={testID} role={role} style={[styles.callout, look, style]}>
      <Text {...BODY_TEXT} style={[styles.calloutText, CALLOUT_TEXT[tone]]}>
        {children}
      </Text>
    </View>
  );
}

// Batch B #2: a decorative sparkle.
export function SparkleIcon({ size = 13, color = colors.gold }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M12 2l1.9 5.6c.3.9 1 1.6 1.9 1.9L21.4 11.4c.4.1.4.7 0 .8l-5.6 1.9c-.9.3-1.6 1-1.9 1.9L12 21.6c-.1.4-.7.4-.8 0l-1.9-5.6c-.3-.9-1-1.6-1.9-1.9L1.8 12.2c-.4-.1-.4-.7 0-.8l5.6-1.9c.9-.3 1.6-1 1.9-1.9L11.2 2c.1-.4.7-.4.8 0z"
        fill={color}
      />
    </Svg>
  );
}

// Batch B #2 why-line: icon + "Why this:" + the server text, read as one
// sentence. v2: 13/18 text-secondary, "Why this:" 600 in gold.
export function WhyLine({ text, style }) {
  return (
    <View accessible accessibilityLabel={`Why this: ${text}`} style={[styles.whyRow, style]}>
      <View style={styles.whyIcon}>
        <SparkleIcon />
      </View>
      <Text {...BODY_TEXT} style={styles.whyText}>
        <Text style={styles.whyLabel}>Why this: </Text>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  choiceList: {
    gap: spacing[3],
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    borderRadius: radii.md,
    // Always 1 px so the card keeps its size when it turns on.
    borderWidth: 1,
    paddingHorizontal: spacing['3_5'],
    paddingVertical: spacing['2_5'],
    minHeight: 56,
    // Clips the fill layer and the press overlay to the radius.
    overflow: 'hidden',
  },
  choiceOff: {
    borderColor: colors.choiceBorder,
    backgroundColor: colors.surface,
  },
  overlay: {
    backgroundColor: colors.pressOverlay,
  },
  overlayInk: {
    backgroundColor: colors.pressOverlayInk,
  },
  choiceOn: {
    borderColor: colors.gold,
    backgroundColor: colors.goldFaint,
    // The 1 px gold border + 0.5 px inset = the 1.5 px gold ring.
    boxShadow: `inset 0px 0px 0px 0.5px ${colors.gold}`,
  },
  disabled: {
    opacity: 0.5,
  },
  choiceLabel: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  choiceHint: {
    ...font(400),
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  // The off ring (1.5 px hairline-bright, as drawn); on, the gold fills it.
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.hairlineBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  checkMark: {
    ...font(700),
    fontSize: 13,
    lineHeight: 16,
    color: colors.onGold,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  pill: {
    minHeight: PILL_HEIGHT,
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing['3_5'],
    // §9: a wrapped label grows the pill from its 40 minimum.
    paddingVertical: spacing[2],
    // Clips the press overlay to the pill.
    overflow: 'hidden',
  },
  pillOn: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  pillRest: {
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillButton,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
  },
  pillCheck: {
    ...font(700),
    fontSize: 12,
    lineHeight: 20,
    color: colors.onGold,
  },
  pillCheckOff: {
    opacity: 0,
  },
  pillText: {
    ...font(600),
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  pillTextOn: {
    color: colors.onGold,
  },
  pillTextOff: {
    color: colors.textPrimary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOff: {
    borderColor: colors.checkboxBorder,
  },
  checkboxOn: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  callout: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing['3_5'],
    paddingVertical: spacing[3],
  },
  calloutText: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textStrong2,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['1_5'],
  },
  whyIcon: {
    paddingTop: 2,
  },
  whyText: {
    ...typography.label,
    ...font(400),
    flex: 1,
    color: colors.textSecondary,
  },
  whyLabel: {
    ...font(600),
    color: colors.gold,
  },
});
