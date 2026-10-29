import Svg, { Path, Rect } from 'react-native-svg';

// The live-session glyphs as drawn on the F1 boards (Workout, Workout
// browsing, Leave / Discard workout). Every Svg has an explicit size (Android
// paints nothing without one) and is hidden from screen readers: the control
// that holds it carries the name.
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

export function PlayIcon({ size = 14, color }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </Svg>
  );
}

export function CheckIcon({ size = 14, color, strokeWidth = 3 }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12l5 5L20 7" />
    </Svg>
  );
}

export function TrashIcon({ size = 26, color }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Svg>
  );
}

export function LeaveIcon({ size = 26, color }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <Path d="M15 16l4-4-4-4M19 12H9" />
    </Svg>
  );
}

export function LockIcon({ size = 16, color }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

// T-105 "Finish early?" tile: a finish flag.
export function FlagIcon({ size = 26, color }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </Svg>
  );
}
