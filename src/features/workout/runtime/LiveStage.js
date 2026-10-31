import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import RemoteImage from '../../../shared/components/RemoteImage';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';
import { exerciseImageProps } from '../../../shared/images/remoteImageSources';
import { colors, font, layout, spacing, titleTracking } from '../../../shared/theme/tokens';
import { FIT, fitSizes, FULL } from './phoneFit';
import PhotoBlend from './PhotoBlend';
import { exerciseName, stageRestLine } from './sessionMath';

// T-161 LIVE-WORKOUT-SPEC §3.1–§3.2 (= web 2.4.1): the phone's stage. The photo (contain, the column width W = min(the
// screen, 430), height = min(W ÷ aspect, photoMax)) with nothing on it, over the blurred letterbox copy; under it, OFF the
// photo: "Rest {s}s · {muscle}" + the How to pill on one row (roomy 36 · compact 32), then the name (34/700; 28 at fit
// level ≥ 2 when it runs over 2 lines). No notes on phones (§3.2, live; P1 pending). No photo: the initials tile (roomy 80 ·
// compact 64). Thumb mode (level 6): a 56 thumb, which opens How to, left of the text, 12 down from its top.
// Without a fit (large text, §5.4) the stage draws FULL.
export const COLUMN_MAX = 430;
export const NO_PHOTO_TILE = 80;
export const NO_PHOTO_TILE_COMPACT = 64;
const NAME_LINE = 38.08;
const NAME_SMALL_LINE = 31.92;

// §3.1 / §5.1: the photo box has its height BEFORE the image loads: the cached aspect for that URL, else photoMax.
const aspectCache = new Map();

// `onMeasure` reports what the fit needs: `photoNatural` (the photo at its aspect, null until known) and `nameLines` (the
// name's lines at 34 on the full width, measured off screen).
export default function LiveStage({ exercise, howTo = null, onLayout, onContentLayout, fit = null, onMeasure, onThumbPress }) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const width = Math.min(windowWidth - insets.left - insets.right, COLUMN_MAX);
  const sizes = fit ?? fitSizes(FULL);
  const image = useMemo(() => exerciseImageProps(exercise.exercise), [exercise.exercise]);
  const [loaded, setLoaded] = useState(null);
  const aspect = (loaded?.url === image.url ? loaded.value : null) ?? aspectCache.get(image.url) ?? null;
  const name = exerciseName(exercise);
  const line = stageRestLine(exercise);
  const natural = image.url && aspect ? Math.round(width / aspect) : null;
  const photoHeight = natural == null ? sizes.photo : Math.min(sizes.photo, natural);
  const thumb = Boolean(sizes.thumb) && Boolean(image.url);
  const compact = sizes.compact;
  // L2, one way only: once a name steps to 28 it never goes back to 34 for the same name.
  const [nameLines, setNameLines] = useState({ name: null, lines: 1 });
  const [smallFor, setSmallFor] = useState(null);
  const longName = nameLines.name === name && nameLines.lines > 2;
  if (sizes.nameSmall && longName && smallFor !== name) {
    setSmallFor(name);
  }
  const nameSmall = smallFor === name;
  useEffect(() => {
    onMeasure?.({ photoNatural: natural });
  }, [natural, onMeasure]);
  useEffect(() => {
    if (nameLines.name === name) {
      onMeasure?.({ nameLines: nameLines.lines });
    }
  }, [name, nameLines, onMeasure]);
  const onLoad = (source) => {
    if (source?.width > 0 && source?.height > 0) {
      aspectCache.set(image.url, source.width / source.height);
      setLoaded({ url: image.url, value: source.width / source.height });
    }
  };
  // Off screen, never read out: the name at 34 on the full width, for L2.
  const nameMeasurer = onMeasure ? (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.measurer, { width }]}>
      <Text {...DISPLAY_TITLE_TEXT} onTextLayout={(event) => setNameLines({ name, lines: event.nativeEvent.lines.length })} style={styles.name}>
        {name}
      </Text>
    </View>
  ) : null;
  const text = (
    <View testID="exercise-stage-content" onLayout={onContentLayout} style={[styles.text, thumb && styles.textBesideThumb]}>
      <View style={[styles.row, compact && styles.rowCompact]}>
        <Text {...CAP_BODY} testID="stage-rest-line" style={[styles.restLine, compact && styles.restLineCompact]}>
          {line}
        </Text>
        {howTo}
      </View>
      <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={[styles.name, nameSmall && styles.nameSmall]}>
        {name}
      </Text>
    </View>
  );
  if (thumb) {
    return (
      <View testID="exercise-stage-frame" style={[styles.thumbRow, { marginTop: sizes.gap }]}>
        {nameMeasurer}
        <View testID="exercise-stage" onLayout={onLayout} style={styles.thumbSlot}>
          <Pressable testID="exercise-stage-thumb" accessibilityRole="button" accessibilityLabel="How to" onPress={onThumbPress} style={styles.thumb}>
            <RemoteImage {...image} resizeMode="cover" style={StyleSheet.absoluteFill} />
          </Pressable>
        </View>
        {text}
      </View>
    );
  }
  const tile = compact ? NO_PHOTO_TILE_COMPACT : NO_PHOTO_TILE;
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
        <View testID="exercise-stage" onLayout={onLayout} style={[styles.tile, compact && styles.tileCompact]}>
          <ExerciseImage
            testID="stage-image"
            url={null}
            name={name}
            muscleCode={exercise.exercise?.primary_muscle_group?.code}
            size={tile}
            initialsFontSize={compact ? 28 : 36}
            style={compact ? styles.tileImageCompact : styles.tileImage}
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
  // §3.1: 16 from the left edge, gap 12; the thumb 12 down from the text block's top.
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: spacing[4],
    gap: spacing[3],
  },
  thumbSlot: {
    flexShrink: 0,
    paddingTop: spacing[3],
  },
  thumb: {
    width: FIT.thumb,
    height: FIT.thumb,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  textBesideThumb: {
    flex: 1,
    paddingLeft: 0,
  },
  photo: {
    alignSelf: 'stretch',
  },
  // §3.1 no photo: roomy 80 r20, 16 above and 8 below · compact 64 r16, 12 above and 4 below.
  tile: {
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  tileCompact: {
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
  tileImage: {
    borderRadius: 20,
  },
  tileImageCompact: {
    borderRadius: 16,
  },
  text: {
    paddingHorizontal: layout.gutter,
    gap: spacing[1],
  },
  // §3.2 row 1: roomy 36 · compact 32; space-between, gap 12.
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
  name: {
    ...font(700),
    fontSize: 34,
    lineHeight: NAME_LINE,
    letterSpacing: titleTracking(34, -0.04),
    color: colors.textPrimary,
  },
  nameSmall: {
    fontSize: 28,
    lineHeight: NAME_SMALL_LINE,
    letterSpacing: titleTracking(28, -0.04),
  },
});
