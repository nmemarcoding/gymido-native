import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { ColorPressable } from '../../../features/plans/components/PlanBits';
import { colors, radii, shadows } from '../../theme/tokens';
import Spinner from '../Spinner';

// The web's shared Button, primary variant (RN-SPEC-profile-create §6,
// RN-SPEC-plans §5): pill, 16×12, 14px/600 navy on brand-400, shadow-soft;
// pressed brand-500; 200ms transitions. Loading: disabled at 60% opacity with a
// 16px spinner (2px ring in the text color, transparent top) before the label.
export default function WebButton({ title, onPress, loading = false, disabled = false, fullWidth = false, testID }) {
  const inactive = disabled || loading;
  return (
    <View style={[fullWidth ? styles.full : styles.inline, inactive && styles.inactive]}>
      <ColorPressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        // Like Button: a web click moves focus off a focused input.
        onPress={(event) => {
          Keyboard.dismiss();
          onPress?.(event);
        }}
        colorsFor={(pressed) => ({ backgroundColor: pressed ? colors.brand500 : colors.brand400 })}
        transitionMs={200}
        style={styles.button}
      >
        {loading ? <Spinner size={16} thickness={2} trackColor={colors.navy} arcColor="transparent" /> : null}
        <Text style={styles.label}>{title}</Text>
      </ColorPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    width: '100%',
  },
  inline: {
    flexDirection: 'row',
  },
  inactive: {
    opacity: 0.6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: shadows.plansSoft,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.navy,
  },
});
