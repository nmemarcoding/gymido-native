import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import RemoteImage from '../../../shared/components/RemoteImage';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';
import { exerciseImageProps } from '../../../shared/images/remoteImageSources';
import { colors, font, layout, spacing, titleTracking } from '../../../shared/theme/tokens';
import { FIT, fitSizes, FULL } from './phoneFit';
import PhotoBlend from './PhotoBlend';
import { exerciseName, stageRestLine } from './sessionMath';

// T-162 (LIVE-WORKOUT-SPEC §3.1–§3.2 + §12 P5 / P5-SC): the phone's stage. The photo (contain, the column width W =
// min(the screen, 430), height = min(W ÷ aspect, 300, the fit's cap)) with nothing on it, over the blurred letterbox copy;
// under it, OFF the photo: "Rest {s}s · {muscle}" + the How to pill on one row (36; S5 32; scaled 28), then the name (34;
// S6 28 when it runs to 2+ lines; scaled 28/32, 24/28 past one line). No notes on phones (P1 pending). No photo: the
// initials tile (80; scaled 64). No thumb at normal text (owner). Without a fit (large text, §5.4) the stage draws FULL.
export const COLUMN_MAX = 430;
export const NO_PHOTO_TILE = 80;
export const NO_PHOTO_TILE_SCALED = 64;

// §3.1 / §5.1: the photo box has its height BEFORE the image loads: the cached aspect for that URL, else the cap.
const aspectCache = new Map();

// `onMeasure` reports what the fit needs: `photoNatural` (the photo at its aspect, null until known) and `nameLines` (the
// name's lines at 34 on the full width, measured off screen).
export default function LiveStage({ exercise, howTo = null, onLayout, onContentLayout, fit = null, onMeasure }) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const width = Math.min(windowWidth - insets.left - insets.right, COLUMN_MAX);
  const sizes = fit ?? fitSizes(FULL);
  const image = useMemo(() => exerciseImageProps(exercise.exercise), [exercise.exercise]);
  const [loaded, setLoaded] = useState(null);
  const aspect = (loaded?.url === image.url ? loaded.value : null) ?? aspectCache.get(image.url) ?? null;
  const name = exerciseName(exercise);
  const line = stageRestLine(exercise);
  const natural = image.url && aspect ? Math.min(FIT.photoMax, Math.round(width / aspect)) : null;
  const photoHeight = natural == null ? sizes.photo : Math.min(sizes.photo, natural);
  const [nameLines, setNameLines] = useState({ name: null, at34: 1, at28: 1 });
  const lines = nameLines.name === name ? nameLines : { at34: 1, at28: 1 };
  const nameStyle = sizes.scaled ? (lines.at28 > 1 ? styles.nameScaledLong : styles.nameScaled) : sizes.nameSmall && lines.at34 >= 2 ? styles.nameSmall : null;
  useEffect(() => {
    onMeasure?.({ photoNatural: natural });
  }, [natural, onMeasure]);
  useEffect(() => {
    if (nameLines.name === name) {
      onMeasure?.({ nameLines: nameLines.at34 });
    }
  }, [name, nameLines, onMeasure]);
  const onLoad = (source) => {
    if (source?.width > 0 && source?.height > 0) {
      aspectCache.set(image.url, source.width / source.height);
      setLoaded({ url: image.url, value: source.width / source.height });
    }
  };
  const measureLines = (key) => (event) => {
    const count = event.nativeEvent.lines.length;
    setNameLines((prev) => (prev.name === name && prev[key] === count ? prev : { ...(prev.name === name ? prev : { at34: 1, at28: 1 }), name, [key]: count }));
  };
  // Off screen, never read out: the name at 34 and at 28 on the full width (S6 and the scaled name).
  const nameMeasurer = onMeasure ? (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.measurer, { width }]}>
      <Text {...DISPLAY_TITLE_TEXT} onTextLayout={measureLines('at34')} style={styles.name}>
        {name}
      </Text>
      <Text {...DISPLAY_TITLE_TEXT} onTextLayout={measureLines('at28')} style={[styles.name, styles.nameScaled]}>
        {name}
      </Text>
    </View>
  ) : null;
  const rowStyle = sizes.scaled ? styles.rowScaled : sizes.rowCompact ? styles.rowCompact : null;
  const lineStyle = sizes.scaled ? styles.restLineScaled : sizes.rowCompact ? styles.restLineCompact : null;
  const text = (
    <View testID="exercise-stage-content" onLayout={onContentLayout} style={[styles.text, sizes.scaled && styles.textScaled]}>
      <View style={[styles.row, rowStyle]}>
        <Text {...CAP_BODY} testID="stage-rest-line" style={[styles.restLine, lineStyle]}>
          {line}
        </Text>
        {howTo}
      </View>
      <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={[styles.name, nameStyle]}>
        {name}
      </Text>
    </View>
  );
  const tile = sizes.scaled ? NO_PHOTO_TILE_SCALED : NO_PHOTO_TILE;
  return (
    <View testID="exercise-stage-frame" style={{ paddingTop: sizes.photoTop }}>
      {nameMeasurer}
      {image.url ? (
        <View style={styles.figure}>
          <PhotoBlend testID="stage-photo-blend" image={image} top={0} height={photoHeight} width={width} upward={false} />
          <View testID="exercise-stage" onLayout={onLayout} style={[styles.photo, { height: photoHeight }]}>
            {/* Decorative: the name is printed right under it. */}
            <RemoteImage {...image} resizeMode="contain" style={StyleSheet.absoluteFill} onLoad={onLoad} />
          </View>
        </View>
      ) : (
        <View testID="exercise-stage" onLayout={onLayout} style={[styles.tile, sizes.scaled && styles.tileScaled]}>
          <ExerciseImage
            testID="stage-image"
            url={null}
            name={name}
            muscleCode={exercise.exercise?.primary_muscle_group?.code}
            size={tile}
            initialsFontSize={sizes.scaled ? 28 : 36}
            style={sizes.scaled ? styles.tileImageScaled : styles.tileImage}
          />
        </View>
      )}
      <View style={{ marginTop: sizes.gap }}>{text}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  figure: {
    overflow: 'hidden',
  },
  measurer: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
    paddingHorizontal: layout.gutter,
  },
  photo: {
    alignSelf: 'stretch',
  },
  // §3.1 no photo: 80 r20, 16 above and 8 below; scaled 64 r16, 12 above and 4 below.
  tile: {
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  tileScaled: {
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
  tileImage: {
    borderRadius: 20,
  },
  tileImageScaled: {
    borderRadius: 16,
  },
  // Row 1 → the name: 4; scaled 2.
  text: {
    paddingHorizontal: layout.gutter,
    gap: spacing[1],
  },
  textScaled: {
    gap: 2,
  },
  // §3.2 row 1: 36; S5 32; scaled 28. Space-between, gap 12.
  row: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  rowCompact: {
    minHeight: 32,
  },
  rowScaled: {
    minHeight: 28,
  },
  restLine: {
    ...font(500),
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  restLineCompact: {
    fontSize: 15,
    lineHeight: 22.5,
  },
  restLineScaled: {
    fontSize: 14,
    lineHeight: 20,
  },
  name: {
    ...font(700),
    fontSize: 34,
    lineHeight: 38.08,
    letterSpacing: titleTracking(34, -0.04),
    color: colors.textPrimary,
  },
  // S6: 28/31.92.
  nameSmall: {
    fontSize: 28,
    lineHeight: 31.92,
    letterSpacing: titleTracking(28, -0.04),
  },
  // P5-SC: 28/32; past one line 24/28.
  nameScaled: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: titleTracking(28, -0.04),
  },
  nameScaledLong: {
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: titleTracking(24, -0.04),
  },
});
