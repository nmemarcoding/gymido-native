import Svg, { Circle, Path } from 'react-native-svg';

// Small stroke icons of the Phase 6 trainer boards (24 viewBox, round caps).
// Decorative: the text beside them (or the control's label) is what is read.
// Every Svg has an explicit width/height (Android render rule).
function Glyph({ size, color, strokeWidth = 2.2, children, testID }) {
  return (
    <Svg
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function SearchGlyph({ size = 18, color }) {
  return (
    <Glyph size={size} color={color} testID="icon-search">
      <Circle cx={11} cy={11} r={7} />
      <Path d="M20 20l-4-4" />
    </Glyph>
  );
}

export function PlusGlyph({ size = 20, color }) {
  return (
    <Glyph size={size} color={color} strokeWidth={2.4} testID="icon-plus">
      <Path d="M12 5v14M5 12h14" />
    </Glyph>
  );
}

// The amber "missed" / inactivity cue (never colour alone: icon + text).
export function AlertGlyph({ size = 12, color }) {
  return (
    <Glyph size={size} color={color} strokeWidth={2.6} testID="icon-alert">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7.5v5M12 16.5h.01" />
    </Glyph>
  );
}

export function CheckGlyph({ size = 12, color }) {
  return (
    <Glyph size={size} color={color} strokeWidth={2.8} testID="icon-check">
      <Path d="M5 12l5 5L20 7" />
    </Glyph>
  );
}

export function ChevronGlyph({ size = 16, color }) {
  return (
    <Glyph size={size} color={color} testID="icon-chevron">
      <Path d="M9 6l6 6-6 6" />
    </Glyph>
  );
}

export function PersonGlyph({ size = 16, color }) {
  return (
    <Glyph size={size} color={color} testID="icon-person">
      <Circle cx={12} cy={9} r={3.5} />
      <Path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </Glyph>
  );
}
