import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { breakpoints, colors, font, gradients, motion, radii, spacing } from '../theme/tokens';
import GradientFill from './GradientFill';

// CSS `ease-out`, matching the web card entrance.
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// v2 §4.8: the one card. `color-surface`, 1 px `color-hairline`, radius 24;
// the hero card is `gradient-card` at radius 28. The gradient is drawn by
// GradientFill (SVG) as the first child, so it exists from the first render
// (Android crash rule: never add a gradient on a state change; pick `hero`
// when the card mounts).
export function cardFrameStyle(hero) {
  return hero ? [styles.frame, styles.hero] : styles.frame;
}

export function CardHeroFill() {
  return <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />;
}

// The bare v2 card surface: no padding, no entrance motion. Card3D renders
// this so its call sites keep their own padding and layout.
export function CardSurface({ hero = false, style, testID, children }) {
  return (
    <View testID={testID} style={[cardFrameStyle(hero), style]}>
      {hero ? <CardHeroFill /> : null}
      {children}
    </View>
  );
}

export default function Card({ children, style, title, subtitle, hero = false }) {
  const reducedMotion = useReducedMotion();
  const wide = useWindowDimensions().width >= breakpoints.sm;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.cardEntranceMs,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [motion.cardOffsetY, 0],
  });

  const motionStyle = { opacity: progress, transform: [{ translateY }] };
  const fill = hero ? <CardHeroFill /> : null;

  if (!title) {
    return (
      <Animated.View style={[cardFrameStyle(hero), styles.body, wide && styles.bodyWide, motionStyle, style]}>
        {fill}
        {children}
      </Animated.View>
    );
  }

  // The optional header: title + subtitle over a hairline divider.
  return (
    <Animated.View style={[cardFrameStyle(hero), styles.titled, motionStyle, style]}>
      {fill}
      <View style={[styles.header, wide && styles.headerWide]}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.body, wide && styles.bodyWide]}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radii.xl,
  },
  // The gradient paints the fill; overflow clips it to the 28 radius.
  hero: {
    borderRadius: radii.xxl,
    overflow: 'hidden',
  },
  titled: {
    overflow: 'hidden',
  },
  // Kit card padding 18 (§3); from 640 the sides widen to 24 as in v1.
  body: {
    padding: spacing['4_5'],
    gap: spacing[3],
  },
  bodyWide: {
    paddingHorizontal: spacing[6],
  },
  header: {
    paddingHorizontal: spacing['4_5'],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  headerWide: {
    paddingHorizontal: spacing[6],
  },
  title: {
    ...font(700),
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  subtitle: {
    ...font(400),
    marginTop: spacing[1],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
