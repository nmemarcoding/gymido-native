import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import RemoteImage from '../../../shared/components/RemoteImage';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';
import { exerciseImageProps } from '../../../shared/images/remoteImageSources';
import { colors, font, layout, spacing, titleTracking } from '../../../shared/theme/tokens';
import PhotoBlend from './PhotoBlend';
import { exerciseName, stageRestLine } from './sessionMath';

// T-146 rev 39 (owner, live 2.3.0): the phone's LIVE stage. The full photo
// (contain, full width, height by its aspect, max 240) with nothing on it,
// over the blurred letterbox copy (no upward extension); under it, OFF the
// photo: "Rest {s}s · {muscle}" + the How to pill on one row, then the name
// (34/700, wraps). On a short screen the photo's max shrinks first (floor
// 160) so Did it stays on screen. No photo: the 80 initials tile.
export const LIVE_PHOTO_MAX = 240;
export const LIVE_PHOTO_FLOOR = 160;
// 16:9 until the image reports its size.
const ASPECT_ESTIMATE = 16 / 9;
// Rev 39 D: header 60 + bar 10 + 6 above the photo; 12 + the text block + 12 +
// the compact card (≈342) below it.
const ABOVE_PHOTO = 76;
const CARD_ESTIMATE = 342;
const TEXT_ESTIMATE = 80;

export function livePhotoMax({ windowHeight, insetsTop, insetsBottom, textHeight }) {
  const room = windowHeight - insetsTop - ABOVE_PHOTO - spacing[3] - textHeight - spacing[3] - CARD_ESTIMATE - insetsBottom;
  return Math.max(LIVE_PHOTO_FLOOR, Math.min(LIVE_PHOTO_MAX, Math.floor(room)));
}

export default function LiveStage({ exercise, howTo = null, notes = null, onLayout, onContentLayout }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const image = useMemo(() => exerciseImageProps(exercise.exercise), [exercise.exercise]);
  const [aspect, setAspect] = useState({ url: null, value: ASPECT_ESTIMATE });
  const [textHeight, setTextHeight] = useState(TEXT_ESTIMATE);
  const name = exerciseName(exercise);
  const line = stageRestLine(exercise);
  const ratio = aspect.url === image.url ? aspect.value : ASPECT_ESTIMATE;
  const max = livePhotoMax({ windowHeight: height, insetsTop: insets.top, insetsBottom: insets.bottom, textHeight });
  const photoHeight = Math.min(max, Math.round(width / ratio));
  const onLoad = (source) => {
    if (source?.width > 0 && source?.height > 0) {
      setAspect({ url: image.url, value: source.width / source.height });
    }
  };
  return (
    <View testID="exercise-stage-frame" style={styles.frame}>
      {image.url ? (
        <>
          <PhotoBlend testID="stage-photo-blend" image={image} top={spacing['1_5']} height={photoHeight} width={width} upward={false} />
          <View testID="exercise-stage" onLayout={onLayout} style={[styles.photo, { height: photoHeight }]}>
            {/* Decorative: the name is printed right under it. */}
            <RemoteImage {...image} resizeMode="contain" style={StyleSheet.absoluteFill} onLoad={onLoad} />
          </View>
        </>
      ) : (
        <View testID="exercise-stage" onLayout={onLayout} style={styles.tile}>
          <ExerciseImage
            testID="stage-image"
            url={null}
            name={name}
            muscleCode={exercise.exercise?.primary_muscle_group?.code}
            size={NO_PHOTO_TILE}
            initialsFontSize={40}
            style={styles.tileImage}
          />
        </View>
      )}
      <View
        testID="exercise-stage-content"
        onLayout={(event) => {
          setTextHeight(event.nativeEvent.layout.height);
          onContentLayout?.(event);
        }}
        style={styles.text}
      >
        <View style={styles.row}>
          <Text {...CAP_BODY} testID="stage-rest-line" style={styles.restLine}>
            {line}
          </Text>
          {howTo}
        </View>
        <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={styles.name}>
          {name}
        </Text>
      </View>
      {notes}
    </View>
  );
}

export const NO_PHOTO_TILE = 80;

const styles = StyleSheet.create({
  frame: {
    paddingTop: spacing['1_5'],
  },
  photo: {
    alignSelf: 'stretch',
  },
  tile: {
    alignItems: 'center',
    paddingTop: spacing[4],
  },
  tileImage: {
    borderRadius: 20,
  },
  text: {
    marginTop: spacing[3],
    paddingHorizontal: layout.gutter,
    gap: spacing[1],
  },
  row: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  restLine: {
    ...font(500),
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  name: {
    ...font(700),
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: titleTracking(34, -0.04),
    color: colors.textPrimary,
  },
});
