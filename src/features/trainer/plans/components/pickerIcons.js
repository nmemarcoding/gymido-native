import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../../../../shared/theme/tokens';

// The picker's inline SVGs (trainer plans spec §A7). Every Svg gets explicit
// width/height props or it paints nothing on Android. v2 §3 icon rule: round
// caps and joins; the dumbbell is GymIcon's `workout` glyph at its 2.6 stroke,
// the search glass 2.2.

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

export function DumbbellIcon({ color, size = 24 }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M4 13v6M9 10v12M23 10v12M28 13v6M9 16h14" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
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

// Search glass 15×15 (spec §A7.2a): viewBox 20, stroke iconSubtle, width 2.2.
export function SearchIcon({ color = colors.iconSubtle, size = 15 }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
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

// Builder icons (UX phase4 I §1-3, round caps / joins, stroke 2): the
// back chevron, the "+" of Add a day / Add exercise, the overflow dots, the
// drag grip, the trash and swap tiles of the confirms, the info notice.
function StrokeIcon({ size, color, viewBox = '0 0 24 24', strokeWidth = 2, children }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox={viewBox} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export function ChevronLeftIcon({ color = colors.gold, size = 16 }) {
  return (
    <StrokeIcon size={size} color={color} strokeWidth={2.2}>
      <Path d="M15 5l-7 7 7 7" />
    </StrokeIcon>
  );
}

export function PlusIcon({ color = colors.textPrimary, size = 16 }) {
  return (
    <StrokeIcon size={size} color={color} strokeWidth={2.2}>
      <Path d="M12 5v14M5 12h14" />
    </StrokeIcon>
  );
}

export function MoreIcon({ color = colors.textPrimary, size = 20 }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx={5} cy={12} r={1.8} />
      <Circle cx={12} cy={12} r={1.8} />
      <Circle cx={19} cy={12} r={1.8} />
    </Svg>
  );
}

export function GripIcon({ color = colors.textFaint, size = 18 }) {
  return (
    <Svg {...hidden} width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx={9} cy={6} r={1.6} />
      <Circle cx={15} cy={6} r={1.6} />
      <Circle cx={9} cy={12} r={1.6} />
      <Circle cx={15} cy={12} r={1.6} />
      <Circle cx={9} cy={18} r={1.6} />
      <Circle cx={15} cy={18} r={1.6} />
    </Svg>
  );
}

export function TrashIcon({ color = colors.dangerText, size = 24 }) {
  return (
    <StrokeIcon size={size} color={color}>
      <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </StrokeIcon>
  );
}

export function SwapIcon({ color = colors.gold, size = 24 }) {
  return (
    <StrokeIcon size={size} color={color}>
      <Path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
    </StrokeIcon>
  );
}

export function InfoIcon({ color = colors.warning, size = 20 }) {
  return (
    <StrokeIcon size={size} color={color}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 11v5M12 8h.01" />
    </StrokeIcon>
  );
}
