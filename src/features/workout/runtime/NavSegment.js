import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import GradientFill from '../../../shared/components/GradientFill';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors } from '../../../shared/theme/tokens';

// RN-SPEC-workout §19.8, web values from gymido-frontend (WorkoutExerciseNav).
export const SEGMENT_HEIGHT = 6;
export const SEGMENT_VIEWED_HEIGHT = 10;
// box-shadow rings on the web: outside the bar, no layout space.
export const RING_VIEWED = { width: 2, color: 'rgba(244,180,0,0.5)' };
export const RING_ACTIVE = { width: 1, color: colors.brand300 };
export const TRACK_SHADOW = 'inset 0 2px 6px rgba(17,24,39,0.12)';
export const FILL_COLORS = [colors.brand300, colors.brand500];
export const FILL_DURATION_MS = 300;

// §19.8: "Swipe up anywhere on the bar (dy < −45 px and |dy| > |dx|) → opens
// the sheet." It never changes the exercise.
export function isSwipeUpToSheet({ dx, dy }) {
  return dy < -45 && Math.abs(dy) > Math.abs(dx);
}

export function NavSegmentBar({ id, ratio, isViewed, isActive }) {
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const scale = useRef(new Animated.Value(ratio)).current;

  // 300 ms ease-out on the web; none under reduced motion.
  useEffect(() => {
    if (reducedMotion) {
      scale.setValue(ratio);
      return undefined;
    }
    const animation = Animated.timing(scale, {
      toValue: ratio,
      duration: FILL_DURATION_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [ratio, reducedMotion, scale]);

  const height = isViewed ? SEGMENT_VIEWED_HEIGHT : SEGMENT_HEIGHT;
  const ring = isViewed ? RING_VIEWED : isActive ? RING_ACTIVE : null;

  return (
    <View
      testID={`nav-segment-bar-${id}`}
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {ring ? (
        <View
          testID={`nav-segment-ring-${id}`}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              top: -ring.width,
              right: -ring.width,
              bottom: -ring.width,
              left: -ring.width,
              borderWidth: ring.width,
              borderColor: ring.color,
            },
          ]}
        />
      ) : null}
      <View testID={`nav-segment-track-${id}`} style={[styles.track, { borderRadius: height / 2 }]}>
        {/* The fill spans the whole bar and is scaled from the left, so a
            partial fill shows the whole gradient compressed. SVG needs an
            explicit size (GradientFill), so it waits for layout. */}
        {width > 0 ? (
          <Animated.View
            testID={`nav-segment-fill-${id}`}
            style={[styles.fill, { transform: [{ scaleX: scale }] }]}
          >
            <GradientFill
              id={`nav-fill-${id}`}
              width={width}
              height={height}
              radius={height / 2}
              colors={FILL_COLORS}
              direction="horizontal"
            />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderRadius: 999,
  },
  track: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    boxShadow: TRACK_SHADOW,
  },
  fill: {
    ...StyleSheet.absoluteFill,
    transformOrigin: 'left',
  },
});
