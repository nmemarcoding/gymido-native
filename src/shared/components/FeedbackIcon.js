import Svg, { Circle, Path, Rect } from 'react-native-svg';

// v2 feedback icons (RN-SPEC-v2-foundation §5; Components boards): round caps
// and joins, decorative (the text beside them is the label). Every Svg has an
// explicit width/height (Android paints nothing without them).
const SHAPES = {
  check: { strokeWidth: 2.6, draw: () => <Path d="M5 12l5 5L20 7" /> },
  error: {
    strokeWidth: 2.2,
    draw: () => (
      <>
        <Circle cx={12} cy={12} r={9} />
        <Path d="M12 8v5M12 16h.01" />
      </>
    ),
  },
  info: {
    strokeWidth: 2.2,
    draw: () => (
      <>
        <Circle cx={12} cy={12} r={9} />
        <Path d="M12 11v5M12 8h.01" />
      </>
    ),
  },
  warning: {
    strokeWidth: 2,
    draw: () => <Path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />,
  },
  empty: {
    strokeWidth: 2,
    draw: () => (
      <>
        <Rect x={4} y={4} width={16} height={16} rx={4} />
        <Path d="M9 12h6" />
      </>
    ),
  },
  close: { strokeWidth: 2.2, draw: () => <Path d="M6 6l12 12M18 6L6 18" /> },
};

export const FEEDBACK_ICON_NAMES = Object.freeze(Object.keys(SHAPES));

export default function FeedbackIcon({ name, size = 18, color, testID }) {
  const shape = SHAPES[name] ?? SHAPES.info;
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={shape.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {shape.draw()}
    </Svg>
  );
}
