import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radii } from '../../../shared/theme/tokens';

// Controls of RN-SPEC-PLAN-GENERATOR §G1.2 and the G2 callouts.

function Check() {
  return (
    <View style={styles.check} accessibilityElementsHidden importantForAccessibility="no">
      <Text numberOfLines={1} textBreakStrategy="simple" style={styles.checkMark}>✓</Text>
    </View>
  );
}

// Full-width choice row.
export function Choice({ label, hint, selected, disabled = false, onPress, testID }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      accessibilityState={{ selected, checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected, disabled && styles.disabled]}
    >
      <View style={styles.flex}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {hint ? <Text style={styles.choiceHint}>{hint}</Text> : null}
      </View>
      {selected ? <Check /> : null}
    </Pressable>
  );
}

export function ChoiceList({ children }) {
  return <View style={styles.choiceList}>{children}</View>;
}

// Batch A (A3): 44 tall on touch (padding-vertical 12).
export function OptionPill({ label, selected, disabled = false, onPress, testID, accessibilityLabel }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pill, selected ? styles.selected : styles.pillRest, disabled && styles.disabled]}
    >
      {/* Design system v1 #15: a leading ✓ when selected. Its space is always
          reserved (transparent when off), so the pill never changes width. */}
      <View style={styles.pillContent}>
        <Text
          style={[styles.pillCheck, !selected && styles.pillCheckOff]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          ✓
        </Text>
        <Text style={[styles.pillText, { color: selected ? colors.textPrimary : colors.textSecondary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function PillRow({ children, style }) {
  return <View style={[styles.pillRow, style]}>{children}</View>;
}

export function Checkbox({ checked }) {
  return (
    <View
      style={[styles.checkbox, checked && styles.checkboxOn]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {checked ? <Text numberOfLines={1} textBreakStrategy="simple" style={styles.checkboxMark}>✓</Text> : null}
    </View>
  );
}

const CALLOUT_TONES = {
  info: { borderColor: 'rgba(14, 165, 233, 0.30)', backgroundColor: '#eff6ff', color: '#1447e6' },
  warning: { borderColor: 'rgba(245, 158, 11, 0.30)', backgroundColor: '#fffbeb', color: '#bb4d00' },
};

export function Callout({ tone = 'info', children, testID, style }) {
  const look = CALLOUT_TONES[tone];
  return (
    <View testID={testID} style={[styles.callout, { borderColor: look.borderColor, backgroundColor: look.backgroundColor }, style]}>
      <Text style={[styles.calloutText, { color: look.color }]}>{children}</Text>
    </View>
  );
}

// Batch B #2: a decorative sparkle.
export function SparkleIcon({ size = 14, color = colors.brand700 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M12 2l1.9 5.6c.3.9 1 1.6 1.9 1.9L21.4 11.4c.4.1.4.7 0 .8l-5.6 1.9c-.9.3-1.6 1-1.9 1.9L12 21.6c-.1.4-.7.4-.8 0l-1.9-5.6c-.3-.9-1-1.6-1.9-1.9L1.8 12.2c-.4-.1-.4-.7 0-.8l5.6-1.9c.9-.3 1.6-1 1.9-1.9L11.2 2c.1-.4.7-.4.8 0z"
        fill={color}
      />
    </Svg>
  );
}

// Batch B #2 why-line: icon + "Why this:" + the server text, read as one sentence.
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
    gap: 12,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 44,
  },
  selected: {
    borderColor: colors.brand400,
    backgroundColor: colors.brand50,
  },
  disabled: {
    opacity: 0.6,
  },
  choiceLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  choiceHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: colors.navy,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillCheck: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.navy,
  },
  pillCheckOff: {
    opacity: 0,
  },
  pillRest: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: colors.brand400,
    backgroundColor: colors.brand400,
  },
  checkboxMark: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: colors.navy,
  },
  callout: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  calloutText: {
    fontSize: 14,
    lineHeight: 24,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  whyIcon: {
    paddingTop: 3,
  },
  whyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  whyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand700,
  },
});
