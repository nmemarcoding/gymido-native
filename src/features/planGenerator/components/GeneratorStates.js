import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import GradientFill from '../../../shared/components/GradientFill';
import PillButton from '../../../shared/components/PillButton';
import { colors, font, gradients, radii, shadows, spacing, textScale, typography } from '../../../shared/theme/tokens';
import { COPY } from '../generatorCopy';

// RN-SPEC-v2-phase2 §D2 Generator states (UX D "Generator states"). Look only.

// Tablet/web rule (UX D): the cards sit in the content column, max 640.
export const GENERATOR_STATE_MAX_WIDTH = 640;

// The card's top glow: radial 80 % 70 % at 50 % 0 %, fading by 70 %.
const TOP_GLOW = Object.freeze({ cx: 0.5, cy: 0, rx: 0.8, ry: 0.7 });
const GLOW_STOPS = Object.freeze([0, 0.7]);

// UX §9 large text: the card title (title-lg) scales at most 1.6×, wraps by
// word (max 3 lines) and shrinks a single over-long word; the message 2×.
export const TITLE_TEXT = Object.freeze({
  textBreakStrategy: 'simple',
  maxFontSizeMultiplier: textScale.title,
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
});

// G1 (RN-SPEC-PLAN-GENERATOR §G1.1 / §G2 503): the page-level card. The
// action stays the code's SECONDARY "Back to plans" (spec §D2; compact 44,
// §D1 EmptyState actions); the gold is only the icon tile.
export function GeneratorUnavailable({ onBack }) {
  return (
    <View testID="generator-unavailable" accessibilityLiveRegion="polite" style={styles.card}>
      <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
      {/* The board's gold 0.18 wash = glow-gold-ambient (§8.5 ladder). */}
      <GradientFill radial={TOP_GLOW} colors={gradients.accountGlow.colors} stops={GLOW_STOPS} />
      <View testID="generator-unavailable-icon" style={styles.tile}>
        <Svg
          width={32}
          height={32}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.onGold}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* A sparkle: the generator "makes" a plan. */}
          <Path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
        </Svg>
      </View>
      <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.title}>
        {COPY.unavailableTitle}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.message}>
        {COPY.unavailableMessage}
      </Text>
      <View style={styles.action}>
        <PillButton testID="generator-back-to-plans" title={COPY.backToPlans} variant="secondary" size="compact" onPress={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Radius 30 on the board (no token → radius-2xl 28); padding 36 22.
  card: {
    width: '100%',
    maxWidth: GENERATOR_STATE_MAX_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    paddingVertical: 36,
    paddingHorizontal: spacing['5_5'],
  },
  tile: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.goldGlow,
  },
  // 28/32/700 -0.04em on the board = title-lg (token 30/32).
  title: {
    ...typography.titleLg,
    marginTop: spacing[4],
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    ...font(400),
    marginTop: spacing[2],
    color: colors.textSecondary,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing[5],
  },
});
