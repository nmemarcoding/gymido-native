import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// A brand gradient drawn in SVG instead of `experimental_backgroundImage`.
//
// On Android a CSS gradient becomes a `BackgroundImageDrawable`, and a view
// that ACQUIRES one on a state change gets a brand-new drawable that is drawn
// before layout gives it bounds. A zero-sized gradient has a null native
// shader, `registerNativeAllocation` throws a message-less
// IllegalArgumentException on the main thread, and the process dies during
// draw with no dialog (RN-SPEC-app-shell §1.0). That is what crashed the app at
// every rest-zero, when the next set's badge and button flipped to "next".
// SVG never touches that code path.
//
// `width` and `height` are REQUIRED and passed straight to the <Svg>. On
// Android, react-native-svg does not take its size from layout alone — an
// <Svg> sized only by `StyleSheet.absoluteFill` painted nothing at all, which
// left the "Did it" button blank. The rest-timer disc has always passed explicit
// dimensions and has always painted, so this follows it. The corner radius is
// drawn on the Rect itself rather than relying on the parent's overflow clip.
//
// `direction` is the SVG equivalent of the CSS angle, which a CSS string can't
// reach here: 'vertical' is `to bottom` (the web's bg-linear-to-b buttons);
// 'diagonal' is the recorded 135deg deviation for the web's corner keywords
// (RN-SPEC-workout §19.10.1). Direction has nothing to do with the crash; the
// explicit dimensions are what protect it.
const DIRECTIONS = {
  vertical: { x1: '0', y1: '0', x2: '0', y2: '1' },
  diagonal: { x1: '0', y1: '0', x2: '1', y2: '1' },
  // `to right` (the exercise nav fill, RN-SPEC-workout §19.8).
  horizontal: { x1: '0', y1: '0', x2: '1', y2: '0' },
};

export default function GradientFill({ id, width, height, radius = 0, colors, direction = 'diagonal' }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} {...DIRECTIONS[direction]}>
          {colors.map((color, index) => (
            <Stop
              key={`${color}-${index}`}
              offset={colors.length === 1 ? '0' : String(index / (colors.length - 1))}
              stopColor={color}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  );
}
