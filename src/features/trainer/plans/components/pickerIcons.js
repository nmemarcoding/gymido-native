import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../../../../shared/theme/tokens';

// The picker's inline SVGs (trainer plans spec §A7). Every Svg gets explicit
// width/height props or it paints nothing on Android.

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

export function DumbbellIcon({ color, size = 24 }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M4 13v6M9 10v12M23 10v12M28 13v6M9 16h14" stroke={color} strokeWidth={2.8} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ color = colors.pickerCheckInk, size = 11 }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M3 8l3.5 3.5L13 4.5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Search glass 15×15 (spec §A7.2a): viewBox 20, stroke iconSubtle (gray-400) width 2.
export function SearchIcon({ color = colors.iconSubtle, size = 15 }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx={8} cy={8} r={5} />
      <Path d="M18 18l-5-5" />
    </Svg>
  );
}

// Select chevron 10×6 (spec §A7.2a), stroke textMuted (gray-500).
export function ChevronIcon({ color = colors.textMuted }) {
  return (
    <Svg {...hidden} width={10} height={6} viewBox="0 0 10 6" fill="none">
      <Path d="M1 1l4 4 4-4" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
