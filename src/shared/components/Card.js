import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { breakpoints, colors, motion, radii, shadows } from '../theme/tokens';

// CSS `ease-out`, matching the web card entrance.
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

export default function Card({ children, style, title, subtitle }) {
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

  if (!title) {
    return <Animated.View style={[styles.card, styles.body, wide && styles.bodyWide, motionStyle, style]}>{children}</Animated.View>;
  }

  // The web Card's optional header: title + subtitle over a border/70 divider.
  return (
    <Animated.View style={[styles.card, styles.titled, motionStyle, style]}>
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
  // Design system v1 P8: the web surface card. The 1px border stays but is
  // transparent, so the box measures the same as web's.
  card: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderWidth: 1,
    borderRadius: radii.surfaceCard,
    boxShadow: shadows.soft,
  },
  titled: {
    overflow: 'hidden',
  },
  body: {
    padding: 20,
    gap: 12,
  },
  bodyWide: {
    paddingHorizontal: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.70)',
  },
  headerWide: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
