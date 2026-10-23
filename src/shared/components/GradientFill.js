import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// RN-SPEC-workout §19.10 standard remedy: every gradient is drawn with
// react-native-svg, never a CSS background, so Android never creates a
// gradient drawable that can be drawn at 0×0. It fills its parent (give the
// parent the radius and `overflow: hidden`), measures itself so the Svg
// always gets explicit width/height (Android paints nothing without them),
// and draws nothing until it has a size.
//
// `angle` uses CSS degrees: 180 = "to bottom", 90 = "to right", 135 = the
// ruled replacement for every corner keyword (§19.10.1).
// react-native-svg drops the alpha of an rgba() stopColor and paints the stop
// opaque, so the alpha goes to stopOpacity instead.
export function splitStopColor(color) {
  const match = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(color);
  if (!match) {
    return { stopColor: color, stopOpacity: 1 };
  }
  const [, r, g, b, a] = match;
  return { stopColor: `rgb(${r}, ${g}, ${b})`, stopOpacity: Number(a) };
}

export default function GradientFill({ colors, stops, angle = 180, style }) {
  const id = useId().replace(/:/g, '');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const offsets = stops ?? colors.map((_, index) => index / Math.max(1, colors.length - 1));

  // CSS gradient line: through the centre, at `angle`, long enough that its
  // ends meet the corners' perpendiculars.
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const cx = width / 2;
  const cy = height / 2;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        if (next.width !== width || next.height !== height) {
          setSize({ width: next.width, height: next.height });
        }
      }}
    >
      {width > 0 && height > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient
              id={id}
              gradientUnits="userSpaceOnUse"
              x1={cx - (dx * length) / 2}
              y1={cy - (dy * length) / 2}
              x2={cx + (dx * length) / 2}
              y2={cy + (dy * length) / 2}
            >
              {colors.map((color, index) => (
                <Stop key={`${color}-${index}`} offset={offsets[index]} {...splitStopColor(color)} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}
