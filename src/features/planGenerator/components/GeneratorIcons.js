import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../../../shared/theme/tokens';

// v2 Phase 4 J: the generator's line icons (24 viewBox, round caps, no fill;
// the kit stroke 2.2). Every Svg has an explicit size (Android render rule)
// and is decorative: the control around it carries the name.
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

function Line({ size, color, strokeWidth = 2.2, children, testID }) {
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...hidden}
    >
      {children}
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 20, color = colors.textPrimary }) {
  return (
    <Line size={size} color={color} testID="icon-chevron-left">
      <Path d="M15 6l-6 6 6 6" />
    </Line>
  );
}

export function CloseIcon({ size = 18, color = colors.textPrimary }) {
  return (
    <Line size={size} color={color} testID="icon-close">
      <Path d="M6 6l12 12M18 6L6 18" />
    </Line>
  );
}

export function ArrowRightIcon({ size = 18, color = colors.onGold }) {
  return (
    <Line size={size} color={color} testID="icon-arrow-right">
      <Path d="M5 12h14M13 6l6 6-6 6" />
    </Line>
  );
}

export function SearchIcon({ size = 18, color = colors.textFaint }) {
  return (
    <Line size={size} color={color} testID="icon-search">
      <Circle cx="11" cy="11" r="7" />
      <Path d="M20 20l-3.5-3.5" />
    </Line>
  );
}

export function CheckIcon({ size = 14, color = colors.onGold }) {
  return (
    <Line size={size} color={color} strokeWidth={3} testID="icon-check">
      <Path d="M5 12l5 5L20 7" />
    </Line>
  );
}

// The goal icon tiles on step 1 (board: sample icons, decorative).
function MuscleGoal({ size, color }) {
  return (
    <Line size={size} color={color}>
      <Path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </Line>
  );
}

function StrengthGoal({ size, color }) {
  return (
    <Line size={size} color={color}>
      <Path d="M4 20h16M7 20V10l5-6 5 6v10M10 20v-5h4v5" />
    </Line>
  );
}

function FitnessGoal({ size, color }) {
  return (
    <Line size={size} color={color}>
      <Path d="M3 12h4l2-5 4 10 2-5h6" />
    </Line>
  );
}

const GOAL_ICONS = Object.freeze({
  BUILD_MUSCLE: MuscleGoal,
  GET_STRONGER: StrengthGoal,
  GENERAL_FITNESS: FitnessGoal,
});

// An unknown goal code falls back to the general icon.
export function GoalIcon({ code, size = 24, color = colors.textStrong2 }) {
  const Icon = GOAL_ICONS[code] ?? FitnessGoal;
  return <Icon size={size} color={color} />;
}
