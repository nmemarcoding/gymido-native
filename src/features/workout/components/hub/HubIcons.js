import Svg, { Path, Rect } from 'react-native-svg';

// T-76 Workout hub glyphs as drawn on the boards. Every Svg has an explicit
// size (Android paints nothing without one) and is hidden from screen
// readers: the control that holds it carries the name.
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

export { CheckIcon, PlayIcon } from '../../runtime/SessionIcons';

export function ChevronRightIcon({ size = 18, color }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function MoonIcon({ size = 22, color }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Svg>
  );
}

export function CalendarIcon({ size = 22, color }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={5} width={18} height={16} rx={3} />
      <Path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  );
}
