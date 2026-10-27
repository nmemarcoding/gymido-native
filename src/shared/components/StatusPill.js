import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, font, radii, spacing } from '../theme/tokens';
import { CAP_PILL } from './largeText';

// RN-SPEC-v2-foundation §4.3: a tinted pill, an icon or 6 px dot ALWAYS
// first so colour is never the only cue (the neutral "Rest day" tone carries
// no icon, as drawn). Callers adopt it in Phase 4.
const PATHS = {
  check: 'M5 12l5 5L20 7',
  alert: 'M12 7v6M12 17h.01',
  cross: 'M7 7l10 10M17 7L7 17',
  minus: 'M6 12h12',
};

const TONES = {
  // "Active" (UX, 26 Oct: teal).
  active: { fill: colors.tealTint, ink: colors.teal, mark: 'check' },
  // "Completed" / done.
  completed: { fill: colors.successTint, ink: colors.success, mark: 'check' },
  // "Missed".
  warning: { fill: colors.warningTint, ink: colors.warning, mark: 'alert' },
  // "Today's workout".
  gold: { fill: colors.goldTint, ink: colors.gold, mark: 'dot' },
  // "Failed".
  danger: { fill: colors.dangerTextTint, ink: colors.dangerText, mark: 'cross' },
  // "Inactive".
  inactive: { fill: colors.fillButton, ink: colors.textStrong2, mark: 'minus' },
  // "Rest day" / neutral.
  neutral: { fill: colors.fillSkeleton, ink: colors.textSecondary, mark: null },
};

// Other names for the same tones (the colour name or the board's label).
const ALIASES = {
  teal: 'active',
  success: 'completed',
  missed: 'warning',
  today: 'gold',
  failed: 'danger',
  rest: 'neutral',
};

export const STATUS_PILL_TONES = Object.freeze([...Object.keys(TONES), ...Object.keys(ALIASES)]);

export function resolveTone(tone) {
  const key = ALIASES[tone] ?? tone;
  return TONES[key] ? key : 'neutral';
}

function Mark({ mark, color, size }) {
  if (mark === 'dot') {
    return <View testID="status-pill-dot" style={[styles.dot, { backgroundColor: color }]} />;
  }
  return (
    <Svg testID={`status-pill-${mark}`} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={PATHS[mark]} stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// `compact` = the 24 px table size. The marks are decorative: the label is
// what is read.
export default function StatusPill({ label, tone = 'neutral', compact = false, testID, style }) {
  const look = TONES[resolveTone(tone)];
  return (
    <View testID={testID} style={[styles.pill, compact && styles.compact, { backgroundColor: look.fill }, style]}>
      {look.mark ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Mark mark={look.mark} color={look.ink} size={compact ? 10 : 12} />
        </View>
      ) : null}
      {/* UX §9: status text caps at 1.6× and wraps rather than truncating. */}
      <Text {...CAP_PILL} style={[styles.label, compact && styles.labelCompact, { color: look.ink }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing['1_5'],
    // min, not fixed: large text grows the pill instead of clipping it.
    minHeight: 28,
    maxWidth: '100%',
    paddingHorizontal: spacing[3],
    // Shows only once the label grows at large text (1×: 18 + 8 < 28).
    paddingVertical: spacing[1],
    borderRadius: radii.full,
  },
  compact: {
    minHeight: 24,
    paddingHorizontal: spacing['2_5'],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // 13/600.
  label: {
    ...font(600),
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  labelCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
});
