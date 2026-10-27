import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, font, layout, radii, spacing, typography } from '../../../shared/theme/tokens';

// Controls of RN-SPEC-PLAN-GENERATOR §G1.2 and the G2 callouts. v2 look:
// RN-SPEC-v2-foundation §4.4 (Option pill / Choice), §4.6 (Checkbox, card
// radio) and §5 (Callout), as drawn on the "GeneratorControls" board.

// The Choice's 24 px gold disc with "✓". Its slot is ALWAYS reserved (empty
// when off), so the row never shifts.
function Check({ on }) {
  return (
    <View testID={on ? 'choice-check' : 'choice-check-slot'} style={[styles.check, on && styles.checkOn]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {on ? <Text numberOfLines={1} textBreakStrategy="simple" style={styles.checkMark}>✓</Text> : null}
    </View>
  );
}

// Full-width choice row (the card radio): min-height 56, radius 16; selected
// = gold-tint-weak fill + an inset 1.5 px gold ring + the gold disc.
export function Choice({ label, hint, selected, disabled = false, onPress, testID }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      accessibilityState={{ selected, checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected ? styles.choiceOn : [styles.choiceOff, pressed && styles.choicePressed],
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.flex}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {hint ? <Text style={styles.choiceHint}>{hint}</Text> : null}
      </View>
      <Check on={Boolean(selected)} />
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
      style={({ pressed }) => [
        styles.pill,
        selected ? (pressed ? styles.pillOnPressed : styles.pillOn) : [styles.pillRest, pressed && styles.pillRestPressed],
        disabled && styles.disabled,
      ]}
    >
      {/* Design system v1 #15 (kept in v2): a leading ✓ when selected. Its
          space is always reserved (transparent when off), so the pill never
          changes width. */}
      <View style={styles.pillContent}>
        <Text
          style={[styles.pillCheck, !selected && styles.pillCheckOff]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          ✓
        </Text>
        <Text style={[styles.pillText, selected ? styles.pillTextOn : styles.pillTextOff]}>{label}</Text>
      </View>
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
const CALLOUT_TONES = {
  info: { borderColor: colors.infoBorder, backgroundColor: colors.infoTint },
  warning: { borderColor: colors.warningBorder, backgroundColor: colors.warningFill },
  // G6 refusal's "what to change" (UX D): teal 0.10 fill + 0.25 edge drawn;
  // nearest token tealTint (0.14) for both.
  teal: { borderColor: colors.tealTint, backgroundColor: colors.tealTint },
};
// The teal callout's text (a pale teal drawn, no token → textStrong2).
const CALLOUT_TEXT = { teal: { color: colors.textStrong2 } };

// `role` is passed through (T-18: the GO_EASY_AREAS note is role="note").
export function Callout({ tone = 'info', children, testID, style, role }) {
  const look = CALLOUT_TONES[tone] ?? CALLOUT_TONES.info;
  return (
    <View testID={testID} role={role} style={[styles.callout, look, style]}>
      <Text style={[styles.calloutText, CALLOUT_TEXT[tone]]}>{children}</Text>
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
      <Text style={styles.whyText}>
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
  },
  choiceOff: {
    borderColor: colors.choiceBorder,
    backgroundColor: colors.surface,
  },
  choicePressed: {
    backgroundColor: colors.surfaceRaised,
  },
  choiceOn: {
    borderColor: colors.gold,
    backgroundColor: colors.goldTintWeak,
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
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
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
  },
  pillOn: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  pillOnPressed: {
    borderColor: colors.goldDeep,
    backgroundColor: colors.goldDeep,
  },
  pillRest: {
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillButton,
  },
  pillRestPressed: {
    backgroundColor: colors.hairlineButton,
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
