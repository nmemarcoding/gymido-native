import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, font, layout } from '../theme/tokens';
import { CAP_BODY } from './largeText';

// RN-SPEC-v2-foundation §4.8 TextLink: 14/600 gold, min-height 44 (the
// whole 44 is the touch area), optional trailing "→". Underlined while
// pressed (v1, kept: the spec draws no pressed state). `arrow` appends a
// decorative " →" that stays out of the accessible name.
const HIT_SLOP = { left: 8, right: 8 };

export default function TextLink({ label, onPress, arrow = false, testID, accessibilityLabel }) {
  return (
    <Pressable testID={testID} accessibilityRole="link" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} hitSlop={HIT_SLOP} style={styles.link}>
      {({ pressed }) => (
        <Text {...CAP_BODY} textBreakStrategy="simple" style={[styles.text, pressed && styles.pressed]}>
          {arrow ? `${label} →` : label}
        </Text>
      )}
    </Pressable>
  );
}

// The row both apps use on the Today and Plans cards: left-aligned, gap 20.
export const textLinkRow = {
  flexDirection: 'row',
  alignItems: 'center',
  // UX §9: at large text a row of links wraps instead of clipping.
  flexWrap: 'wrap',
  columnGap: 20,
  marginTop: 16,
};

const styles = StyleSheet.create({
  link: {
    minHeight: layout.touchMin,
    flexShrink: 1,
    justifyContent: 'center',
  },
  text: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  pressed: {
    textDecorationLine: 'underline',
  },
});
