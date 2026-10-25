import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/tokens';

// Design system v1 TextLink (#19): 14/700 brand-700 text, a 44 pt touch area
// (hitSlop, so the drawn text keeps its spacing), underlined while pressed.
// `arrow` appends a decorative " →" that stays out of the accessible name.
const HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

export default function TextLink({ label, onPress, arrow = false, testID, accessibilityLabel }) {
  return (
    <Pressable testID={testID} accessibilityRole="link" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} hitSlop={HIT_SLOP}>
      {({ pressed }) => (
        <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.text, pressed && styles.pressed]}>
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
  gap: 20,
  marginTop: 16,
};

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
  pressed: {
    textDecorationLine: 'underline',
  },
});
