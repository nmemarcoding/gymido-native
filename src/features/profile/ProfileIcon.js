import Svg, { Circle, Path, Rect } from 'react-native-svg';

// The Profile boards' row icons (Profile, TabletProfile, ResetPassword): a
// 24 viewBox, no fill, the current colour, round caps and joins. The Svg
// always gets an explicit width/height (Android render rule). Decorative:
// the row's own label carries the name. Unknown names draw an empty box.
const ICONS = {
  person: () => (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  measure: () => <Path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  units: () => <Path d="M3 7h18M3 12h12M3 17h6" />,
  lock: () => (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  plus: () => <Path d="M12 5v14M5 12h14" />,
  speaker: () => (
    <>
      <Path d="M11 5L6 9H2v6h4l5 4V5z" />
      <Path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </>
  ),
  vibrate: () => (
    <>
      <Rect x={7} y={3} width={10} height={18} rx={2} />
      <Path d="M3 9v6M21 9v6" />
    </>
  ),
  coaching: () => (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={4} />
    </>
  ),
  chevron: () => <Path d="M9 6l6 6-6 6" />,
  check: () => <Path d="M5 12.5l4.5 4.5L19 7.5" />,
};

// Stroke widths as drawn: the plus 2.4, the success check 2.6, the rest 2.
const STROKES = { plus: 2.4, check: 2.6 };

export const PROFILE_ICON_NAMES = Object.freeze(Object.keys(ICONS));

export default function ProfileIcon({ name, size = 17, color, testID }) {
  const body = ICONS[name];
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={STROKES[name] ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {body ? body() : null}
    </Svg>
  );
}
