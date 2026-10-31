import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import RemoteImage from '../../../shared/components/RemoteImage';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';
import { exerciseImageProps } from '../../../shared/images/remoteImageSources';
import { colors, font, layout, radii, spacing, titleTracking, typography } from '../../../shared/theme/tokens';
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

// The thumb mode's left inset and the gap to the text (styles.thumbRow).
const THUMB_INSET = spacing[4];
const THUMB_GAP = spacing[3];

// T-132 (web ES:145-152): the notes card under the name (4 + 12 above it). T-155 round 3 (PM): full width under the thumb
// too; `clamp` (the fit's first step, before the photo gives) shows 1 line with More at its end, which opens the rest in
// place (Less, under the text, closes it).
function NotesBlock({ notes, clamp = false, expanded = false, onToggle, onLayout, testID = 'exercise-notes' }) {
  const clamped = clamp && !expanded;
  return (
    <View onLayout={onLayout} style={styles.notesBlock}>
      <View testID={testID} style={[styles.notesCard, clamped && styles.notesCardClamped]}>
        <Text {...CAP_BODY} numberOfLines={clamped ? 1 : undefined} style={[styles.notesText, clamped && styles.notesTextClamped]}>
          {notes}
        </Text>
        {clamp ? (
          <Pressable testID={`${testID}-more`} accessibilityRole="button" accessibilityLabel={expanded ? 'Show less of the notes' : 'Show all the notes'} hitSlop={12} onPress={onToggle} style={styles.notesMore}>
            <Text {...CAP_BODY} style={styles.notesMoreText}>
              {expanded ? 'Less' : 'More'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// T-154 (rev 42): `fit` (phoneFit) sets the photo's max height, the gap under it and the thumb mode (the photo goes; a 56
// thumb, which opens How to, sits left of the row + name). T-155 round 3 (PM: measure, don't budget): `onMeasure` reports
// the blocks the fit needs, measured off screen at both widths so neither mode depends on the other: `name` (full width),
// `nameThumb` (beside the thumb), `notes` / `notesClamped` (the card with its space above), `row`, `photoNatural` (the
// photo's height at its aspect) and `notesExpanded`.
export default function LiveStage({ exercise, howTo = null, notes = '', onLayout, onContentLayout, fit = null, onMeasure, onThumbPress }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const image = useMemo(() => exerciseImageProps(exercise.exercise), [exercise.exercise]);
  const [aspect, setAspect] = useState({ url: null, value: ASPECT_ESTIMATE });
  const [textHeight, setTextHeight] = useState(TEXT_ESTIMATE);
  const [notesExpanded, setNotesExpanded] = useState({ notes: null, value: false });
  const expanded = notesExpanded.notes === notes && notesExpanded.value;
  const name = exerciseName(exercise);
  const line = stageRestLine(exercise);
  const ratio = aspect.url === image.url ? aspect.value : ASPECT_ESTIMATE;
  const max = fit ? fit.photo : livePhotoMax({ windowHeight: height, insetsTop: insets.top, insetsBottom: insets.bottom, textHeight });
  const photoHeight = Math.min(max, Math.round(width / ratio));
  const thumb = Boolean(fit?.thumb) && Boolean(image.url);
  const gap = fit ? fit.gap : spacing[3];
  // T-155: the full 2.3.2 row (36, 16 px) by default; the compact one (32, 15 px) from the fit's step (b).
  const compact = Boolean(fit?.compact);
  const [rowHeight, setRowHeight] = useState(36);
  const natural = Math.round(width / ratio);
  useEffect(() => {
    onMeasure?.({ photoNatural: natural });
  }, [natural, onMeasure]);
  useEffect(() => {
    if (!notes) {
      onMeasure?.({ notes: 0, notesClamped: 0 });
    }
  }, [notes, onMeasure]);
  useEffect(() => {
    onMeasure?.({ notesExpanded: expanded });
  }, [expanded, onMeasure]);
  const measure = (key) => (event) => onMeasure?.({ [key]: event.nativeEvent.layout.height });
  const notesBlock = notes ? (
    <NotesBlock notes={notes} clamp={Boolean(fit?.notesClamp)} expanded={expanded} onToggle={() => setNotesExpanded({ notes, value: !expanded })} />
  ) : null;
  // Off screen, never read out: the name at the full and the beside-the-thumb widths, the notes full and clamped.
  const measurers = onMeasure ? (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.measurers, { width }]}>
      <View style={styles.measureName}>
        <Text {...DISPLAY_TITLE_TEXT} onLayout={measure('name')} style={styles.name}>
          {name}
        </Text>
      </View>
      <View style={{ width: width - THUMB_INSET - FIT_THUMB - THUMB_GAP - layout.gutter }}>
        <Text {...DISPLAY_TITLE_TEXT} onLayout={measure('nameThumb')} style={styles.name}>
          {name}
        </Text>
      </View>
      {notes ? (
        <View style={styles.notesFullWidth}>
          <NotesBlock notes={notes} testID="measure-notes" onLayout={measure('notes')} />
          <NotesBlock notes={notes} testID="measure-notes-clamped" clamp onLayout={measure('notesClamped')} />
        </View>
      ) : null}
    </View>
  ) : null;
  const onLoad = (source) => {
    if (source?.width > 0 && source?.height > 0) {
      setAspect({ url: image.url, value: source.width / source.height });
    }
  };
  const text = (
    <View
      testID="exercise-stage-content"
      onLayout={(event) => {
        setTextHeight(event.nativeEvent.layout.height - rowHeight - 4);
        onContentLayout?.(event);
      }}
      style={[styles.text, thumb && styles.textBesideThumb]}
    >
      <View
        style={[styles.row, compact && styles.rowCompact]}
        onLayout={(event) => {
          setRowHeight(event.nativeEvent.layout.height);
          onMeasure?.({ row: event.nativeEvent.layout.height });
        }}
      >
        <Text {...CAP_BODY} testID="stage-rest-line" style={[styles.restLine, compact && styles.restLineCompact]}>
          {line}
        </Text>
        {howTo}
      </View>
      <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={styles.name}>
        {name}
      </Text>
    </View>
  );
  if (thumb) {
    // T-155 round 3 (PM): the notes go full width under the thumb row, not beside the thumb.
    return (
      <View testID="exercise-stage-frame" style={styles.frame}>
        {measurers}
        <View style={styles.thumbRow}>
          <View testID="exercise-stage" onLayout={onLayout} style={styles.thumbSlot}>
            <Pressable testID="exercise-stage-thumb" accessibilityRole="button" accessibilityLabel="How to" onPress={onThumbPress} style={styles.thumb}>
              <RemoteImage {...image} resizeMode="cover" style={StyleSheet.absoluteFill} />
            </Pressable>
          </View>
          {text}
        </View>
        <View style={styles.notesFullWidth}>{notesBlock}</View>
      </View>
    );
  }
  return (
    <View testID="exercise-stage-frame" style={[styles.frame, { paddingTop: fit ? fit.photoTop : spacing['1_5'] }]}>
      {measurers}
      {image.url ? (
        <>
          <PhotoBlend testID="stage-photo-blend" image={image} top={fit ? fit.photoTop : spacing['1_5']} height={photoHeight} width={width} upward={false} />
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
      <View style={{ marginTop: gap }}>
        {text}
        <View style={styles.notesFullWidth}>{notesBlock}</View>
      </View>
    </View>
  );
}

export const NO_PHOTO_TILE = 80;
const FIT_THUMB = 56;

const styles = StyleSheet.create({
  frame: {
    paddingTop: spacing[2],
  },
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: THUMB_INSET,
    gap: THUMB_GAP,
  },
  notesFullWidth: {
    paddingHorizontal: layout.gutter,
  },
  measurers: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
  },
  measureName: {
    paddingHorizontal: layout.gutter,
  },
  // The text block's 4 gap + the card's 12.
  notesBlock: {
    paddingTop: spacing[1],
  },
  notesCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  notesText: {
    ...typography.bodySm,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  notesCardClamped: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  notesTextClamped: {
    flex: 1,
  },
  notesMore: {
    alignSelf: 'flex-start',
  },
  notesMoreText: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.gold,
  },
  thumbSlot: {
    flexShrink: 0,
  },
  thumb: {
    width: 56,
    height: 56,
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
  tile: {
    alignItems: 'center',
    paddingTop: spacing[4],
  },
  tileImage: {
    borderRadius: 20,
  },
  text: {
    paddingHorizontal: layout.gutter,
    gap: spacing[1],
  },
  // T-155: the 2.3.2 row (36, 16 px); rev 42's compact one is 32 (15 px).
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
  restLineCompact: {
    fontSize: 15,
    lineHeight: 20,
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
