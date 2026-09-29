import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// GymIcon set (RN-SPEC-app-shell §10): viewBox 0 0 32 32, no fill, stroke =
// current color, round caps; round joins on every icon except `workout`.
const ICONS = {
  workout: {
    strokeWidth: 3,
    joins: false,
    body: <Path d="M4 13v6M9 10v12M23 10v12M28 13v6M9 16h14" />,
  },
  exercises: {
    strokeWidth: 2.8,
    body: (
      <>
        <Circle cx={9} cy={22} r={3} />
        <Circle cx={19} cy={8} r={3} />
        <Path d="M11 20l7-9M12 22h9l4 4M21 11l5 3" />
      </>
    ),
  },
  library: {
    strokeWidth: 3,
    body: (
      <>
        <Rect x={9} y={5} width={14} height={22} rx={3} />
        <Path d="M13 11h6M13 16h6M13 21h6" />
      </>
    ),
  },
  progress: {
    strokeWidth: 3,
    body: <Path d="M7 25V15M16 25V9M25 25V5M7 15l9-6 9-4" />,
  },
  trainer: {
    strokeWidth: 3,
    body: (
      <>
        <Circle cx={12} cy={9} r={4} />
        <Path d="M4.5 26a7.5 7.5 0 0 1 15 0" />
        <Circle cx={24} cy={19} r={4} />
        <Path d="M24 15v-4h-4" />
      </>
    ),
  },
  settings: {
    strokeWidth: 3,
    body: (
      <>
        <Path d="M16 4l3 2 4-.5 1.5 3.6 3.2 2.4-1.4 3.8 1.4 3.8-3.2 2.4-1.5 3.6-4-.5-3 2-3-2-4 .5-1.5-3.6-3.2-2.4 1.4-3.8-1.4-3.8 3.2-2.4L9 5.5l4 .5 3-2z" />
        <Circle cx={16} cy={16} r={4} />
      </>
    ),
  },
  dashboard: {
    strokeWidth: 3,
    body: (
      <>
        {[
          [5, 5],
          [18, 5],
          [5, 18],
          [18, 18],
        ].map(([x, y]) => (
          <Rect key={`${x}-${y}`} x={x} y={y} width={9} height={9} rx={2} />
        ))}
      </>
    ),
  },
  users: {
    strokeWidth: 2.8,
    body: (
      <>
        <Circle cx={12} cy={11} r={4} />
        <Path d="M5 26c0-4 3.5-7 7-7s7 3 7 7" />
        <Path d="M21 8a4 4 0 0 1 0 8M22 19c3 .7 5 3.4 5 7" />
      </>
    ),
  },
  plans: {
    strokeWidth: 3,
    body: (
      <>
        <Rect x={7} y={6} width={18} height={22} rx={3} />
        <Path d="M12 4h8v4h-8z" />
        <Path d="M12 15h8M12 21h8" />
      </>
    ),
  },
  profile: {
    strokeWidth: 2.8,
    body: (
      <>
        <Circle cx={16} cy={16} r={12} />
        <Circle cx={16} cy={13} r={4} />
        <Path d="M8.5 25a8 8 0 0 1 15 0" />
      </>
    ),
  },
};

export default function GymIcon({ name, size = 28, color }) {
  const icon = ICONS[name];
  if (!icon) {
    // Unknown name: an empty box of the same size.
    return <View style={{ width: size, height: size }} />;
  }
  return (
    <View testID={`gym-icon-${name}`} style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        stroke={color}
        strokeWidth={icon.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin={icon.joins === false ? undefined : 'round'}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {icon.body}
      </Svg>
    </View>
  );
}
