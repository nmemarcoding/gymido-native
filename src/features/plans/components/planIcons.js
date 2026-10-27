import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// The H boards' small stroke icons (24 viewBox, round caps and joins, no
// fill), none of which is in the kit (GymIcon / FeedbackIcon). Decorative:
// the text beside each one is the label. Every Svg has an explicit size
// (Android render rule).
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  play: 'M8 5.5v13l11-6.5-11-6.5Z',
  check: 'M5 12l5 5L20 7',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  back: 'M15 6l-6 6 6 6',
  // My plans tile: a list.
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  // Generator tile: a spark.
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  // T-60 phone Plans: the next-workout dumbbell and the My plans pen.
  dumbbell: 'M3 10v4M6.5 7.5v9M17.5 7.5v9M21 10v4M6.5 12h11',
  pen: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
};

export const PLAN_ICON_NAMES = Object.freeze(Object.keys(PATHS));

export default function PlanIcon({ name, size = 18, color, strokeWidth = 2.2, filled = false, testID }) {
  const d = PATHS[name];
  return (
    <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      {d ? (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
          <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}
