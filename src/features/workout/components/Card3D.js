import { StyleSheet, View } from 'react-native';

import GradientFill from '../../../shared/components/GradientFill';
import { colors, radii, shadows } from '../../../shared/theme/tokens';

// `card-3d` (RN-SPEC-workout §2.1): shadow-lift-2, a 1px inset ring and a
// 1px top highlight across the top edge inside the radius.
export default function Card3D({ style, children, testID }) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
      <View pointerEvents="none" style={styles.highlight}>
        <GradientFill angle={90} colors={[colors.sheenClear, colors.sheenCard, colors.sheenClear]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    boxShadow: `${shadows.lift2}, ${shadows.ringInk}`,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: radii.xxl,
    right: radii.xxl,
    height: 1,
  },
});
