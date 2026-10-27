import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, layout, radii, spacing } from '../theme/tokens';
import { CAP_BODY } from './largeText';

// RN-SPEC-v2-foundation §4.7 segmented switch (Personal / Trainer, cm /
// ft-in): a surface track with a hairline, padding 4, radius full; segments
// 40 tall (34 when `compact`, the height-unit switch). Selected = the light
// fill + on-light 600; unselected = transparent + text-secondary 500. Each
// segment keeps a 44 hit area (hitSlop).
//
// `segments`: [{ value, label, testID? }]. `segmentWidth` is each segment's
// MINIMUM width (the mode switch draws 120): at the largest Dynamic Type the
// segment grows and its label may wrap, but is never cut off (review). Segment roles stay with the
// caller (`segmentRole`, default "button" + selected).
// `selectedTone` "gold" (27 Oct 2026, the tablet set editor's unit): the
// selected segment is the flat gold + on-gold 600 instead of the light fill.
export default function SegmentedSwitch({
  segments,
  value,
  onChange,
  compact = false,
  segmentWidth,
  accessibilityLabel,
  segmentRole = 'button',
  selectedTone = 'light',
  testID,
  style,
}) {
  const height = compact ? 34 : 40;
  const slop = Math.max(0, (layout.touchMin - height) / 2);
  const gold = selectedTone === 'gold';
  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={[styles.track, style]}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={String(segment.value)}
            testID={segment.testID}
            accessibilityRole={segmentRole}
            accessibilityState={{ selected: active }}
            hitSlop={{ top: slop, bottom: slop, left: 0, right: 0 }}
            onPress={() => onChange(segment.value)}
            style={({ pressed }) => [
              styles.segment,
              { minHeight: height },
              segmentWidth ? { minWidth: segmentWidth } : styles.segmentFlex,
              active ? (gold ? styles.segmentOnGold : styles.segmentOn) : pressed && styles.segmentPressed,
            ]}
          >
            <Text {...CAP_BODY} style={[compact ? styles.labelCompact : styles.label, styles.labelCentered, active ? (gold ? styles.labelOnGold : styles.labelOn) : styles.labelOff]}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  labelCentered: {
    textAlign: 'center',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[1],
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radii.full,
  },
  segmentFlex: {
    flexGrow: 1,
  },
  // The light fill (text-primary).
  segmentOn: {
    backgroundColor: colors.textPrimary,
  },
  segmentOnGold: {
    backgroundColor: colors.gold,
  },
  segmentPressed: {
    backgroundColor: colors.fillButton,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
  },
  labelCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  labelOn: {
    ...font(600),
    color: colors.onLight,
  },
  labelOnGold: {
    ...font(600),
    color: colors.onGold,
  },
  labelOff: {
    ...font(500),
    color: colors.textSecondary,
  },
});
