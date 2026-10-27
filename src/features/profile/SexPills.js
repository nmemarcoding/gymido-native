import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldFrame } from '../../shared/components/FormField';
import { CAP_BODY } from '../../shared/components/largeText';
import { colors, font, layout, radii, spacing, typography } from '../../shared/theme/tokens';

// Create profile Sex (RN-SPEC-profile-create §3.2, dated change 27 Oct 2026,
// owner D2) drawn as the S4 pills: single-select, a radiogroup of radio pills,
// each ≥ 44 tall, radius full, 1 px border, 14/700. Selected = gold border
// (brand-400), gold tint (brand-50), text-primary, a decorative leading "✓ ";
// unselected = hairline (`border`), surface, text-secondary. Tapping the
// selected pill again clears it (= "Not set", sent as null). The server's
// `sex` error shows under the group (⚠P4 narrowed 27 Oct 2026).
// `focusRef` lands on the checked pill: focus goes to the checked radio.
export default function SexPills({ label, labelStyle, options, value, onChange, disabled = false, error, testID, focusRef }) {
  return (
    <View testID={testID ? `${testID}-field` : undefined}>
      <FieldFrame label={label} error={error} labelStyle={labelStyle}>
        <View
          testID={testID}
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          accessibilityState={{ disabled, invalid: Boolean(error) }}
          style={styles.group}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value || 'none'}
                ref={active ? focusRef : undefined}
                testID={testID ? `${testID}-${option.value || 'none'}` : undefined}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityHint={error || undefined}
                accessibilityState={{ checked: active, selected: active, disabled }}
                disabled={disabled}
                onPress={() => onChange(active ? '' : option.value)}
                style={[styles.pill, active ? styles.pillOn : styles.pillOff, disabled && styles.pillDisabled]}
              >
                {active ? (
                  <Text {...CAP_BODY} accessibilityElementsHidden importantForAccessibility="no" style={[styles.text, styles.textOn]}>
                    ✓{' '}
                  </Text>
                ) : null}
                <Text {...CAP_BODY} style={[styles.text, styles.label, active ? styles.textOn : styles.textOff]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FieldFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  // §9: the pills wrap onto more rows at large text.
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  // minHeight, never height: the scaled label grows the pill.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.touchMin,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    borderWidth: 1,
  },
  pillOn: {
    borderColor: colors.gold,
    backgroundColor: colors.goldTint,
  },
  pillOff: {
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  // The kit's disabled look (FormField boxDisabled 0.5).
  pillDisabled: {
    opacity: 0.5,
  },
  text: {
    ...font(700),
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  textOn: {
    color: colors.textPrimary,
  },
  textOff: {
    color: colors.textSecondary,
  },
});
