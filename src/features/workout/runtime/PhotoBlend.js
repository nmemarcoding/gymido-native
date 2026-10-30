import { Animated, StyleSheet, View } from 'react-native';

import GradientFill from '../../../shared/components/GradientFill';
import RemoteImage from '../../../shared/components/RemoteImage';
import { colors } from '../../../shared/theme/tokens';

// T-146 rev 31 (rest) + rev 39 (set screen): the blend lives OUTSIDE the
// photo: a cover copy 48 larger each side (−24 left), 56 above and below,
// blurred, at brightness .7, whose outer 22 % top and bottom fade into the
// ground (an svg gradient over the copy: over the solid ground it reads the
// same as a mask, no MaskedView dependency). `upward` false (rev 38 rest 3,
// rev 39 set screen): it starts at the photo's top edge. Drawn behind the
// sharp photo, never over it.
export const BLEND_SIDE = 24;
export const BLEND_OUT = 56;
const BLEND_BLUR = 20;
const FADE_TOP = Object.freeze([colors.ground, colors.groundClear]);
const FADE_BOTTOM = Object.freeze([colors.groundClear, colors.ground]);

export default function PhotoBlend({ image, top, height, width, opacity = 1, upward = true, testID = 'photo-blend' }) {
  const above = upward ? BLEND_OUT : 0;
  return (
    <Animated.View
      pointerEvents="none"
      testID={testID}
      style={[styles.blend, { top: top - above, width: width + 2 * BLEND_SIDE, height: height + above + BLEND_OUT, opacity }]}
    >
      <RemoteImage {...image} resizeMode="cover" blurRadius={BLEND_BLUR} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <View style={[styles.edge, styles.top]}>
        <GradientFill angle={180} colors={FADE_TOP} />
      </View>
      <View style={[styles.edge, styles.bottom]}>
        <GradientFill angle={180} colors={FADE_BOTTOM} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blend: {
    position: 'absolute',
    left: -BLEND_SIDE,
    overflow: 'hidden',
  },
  // brightness .7
  dim: {
    backgroundColor: colors.restBlendDim,
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '22%',
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
});
