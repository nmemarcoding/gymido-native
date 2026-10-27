import { useCallback, useRef, useState } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { getServerMessage } from '../../../shared/api/apiError';
import AppModal, { ModalActions } from '../../../shared/components/AppModal';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import ExerciseImage from '../../../shared/components/ExerciseImage';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import { CAP_BODY, TITLE_TEXT } from '../../../shared/components/largeText';
import { colors, font, layout, radii, spacing, typography } from '../../../shared/theme/tokens';
import { getExercise } from '../../exercises/api/exercisesApi';
import { exerciseName } from './sessionMath';

// #5 / ND7 "How to": the exercise's "How to do it" content (description,
// steps, and the image the library has) in a sheet over the workout (phone:
// bottom sheet; ≥ 768: centred card). Closing returns to the same set; the
// session and its timers keep running underneath (nothing here touches them).
// Data: the existing GET /exercises/{id} (BE §10 #5).

// The exercise detail's ND-4 rule (ExerciseDetailScreen.howToSteps): lines →
// numbered steps, else null (one text block). Kept here because importing the
// screen pulls the whole shell into the runtime; the lead can move the one
// helper to exercises/exerciseProfile.js and import it from both (report).
export function howToSteps(instructions) {
  if (typeof instructions !== 'string' || !/\r?\n/.test(instructions)) {
    return null;
  }
  const steps = instructions
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return steps.length > 1 ? steps : null;
}

export function hasHowTo(exercise) {
  return Boolean(exercise?.description || exercise?.instructions);
}

// One load per exercise id for the session, kept by the runtime: the pill
// shows unless the library has nothing for the exercise (ND7: hidden when the
// exercise has neither text nor image).
export function useHowToLibrary({ load = getExercise } = {}) {
  const [entries, setEntries] = useState({});
  const inflight = useRef({});
  const fetchEntry = useCallback(
    (id, force = false) => {
      if (!id || (inflight.current[id] && !force)) {
        return;
      }
      inflight.current[id] = true;
      setEntries((current) => ({ ...current, [id]: { status: 'loading' } }));
      Promise.resolve()
        .then(() => load(id))
        .then(
          (exercise) => setEntries((current) => ({ ...current, [id]: { status: 'ready', exercise } })),
          (error) => {
            inflight.current[id] = false;
            setEntries((current) => ({ ...current, [id]: { status: 'error', message: getServerMessage(error) } }));
          }
        );
    },
    [load]
  );
  return { entries, fetchEntry };
}

// Batch 2 (1), web HowToSheet parity: a video FILE plays inline; any other
// video URL (a YouTube / Drive page) is a "Watch video" link out.
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i;
export function isVideoFile(url) {
  if (typeof url !== 'string' || !url) {
    return false;
  }
  return VIDEO_FILE.test(url.trim());
}

const isVideoType = (item) => String(item?.media_type ?? '').toLowerCase().includes('video');

// Media by sort_order: the first video wins; the image is the first
// non-video item, else the exercise thumbnail (library, then session).
export function howToMedia(exercise, sessionExercise) {
  const media = (Array.isArray(exercise?.media) ? exercise.media : [])
    .filter((item) => item?.url)
    .slice()
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const video = media.find(isVideoType)?.url ?? null;
  const image = media.find((item) => !isVideoType(item))?.url || exercise?.thumbnail?.url || sessionExercise?.exercise?.thumbnail?.url || null;
  return { video: isVideoFile(video) ? video : null, link: video && !isVideoFile(video) ? video : null, image };
}

// Inline file video (web `<video controls playsInline preload="metadata">`):
// native controls, contain, no autoplay, no loop, no PiP.
function HowToVideo({ url, name }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
  });
  return (
    <View testID="how-to-video" style={styles.video}>
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        allowsPictureInPicture={false}
        accessibilityLabel={`${name} video`}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function WatchVideoLink({ url }) {
  return (
    <Pressable
      testID="how-to-watch-video"
      accessibilityRole="link"
      accessibilityLabel="Watch video"
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={styles.watch}
    >
      {({ pressed }) => (
        <Text {...CAP_BODY} style={[styles.watchText, pressed && styles.watchPressed]}>
          Watch video
        </Text>
      )}
    </Pressable>
  );
}

// Ready with nothing to show → no pill; loading or failed → the pill stays
// (the sheet shows the loader / the error with Retry).
export function showHowToPill(entry, sessionExercise) {
  if (!entry || entry.status !== 'ready') {
    return true;
  }
  const media = howToMedia(entry.exercise, sessionExercise);
  return hasHowTo(entry.exercise) || Boolean(media.video || media.link || media.image);
}

export default function HowToSheet({ open, sessionExercise, entry, onRetry, onClose }) {
  const name = exerciseName(sessionExercise);
  const exercise = entry?.status === 'ready' ? entry.exercise : null;
  const media = howToMedia(exercise, sessionExercise);
  const url = media.video ? null : media.image;
  const steps = howToSteps(exercise?.instructions);

  let body;
  if (!entry || entry.status === 'loading') {
    body = <Loader label="Loading exercise" style={styles.loader} />;
  } else if (entry.status === 'error') {
    body = <ErrorAlert title="Could not load this exercise" description={entry.message} onRetry={onRetry} />;
  } else {
    body = (
      <View testID="how-to-content" style={styles.content}>
        {media.video ? <HowToVideo url={media.video} name={name} /> : null}
        {url ? (
          <ExerciseImage
            testID="how-to-image"
            url={url}
            name={name}
            muscleCode={sessionExercise?.exercise?.primary_muscle_group?.code}
            hero
            resizeMode="contain"
            accessibilityLabel={name}
          />
        ) : null}
        {media.link ? <WatchVideoLink url={media.link} /> : null}
        {hasHowTo(exercise) ? (
          <View style={styles.section}>
            <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.sectionTitle}>
              How to do it
            </Text>
            {exercise.description ? (
              <Text {...CAP_BODY} testID="how-to-description" style={styles.text}>
                {exercise.description}
              </Text>
            ) : null}
            {steps ? (
              <View testID="how-to-steps" style={styles.steps}>
                {steps.map((step, index) => (
                  <View key={`${index}-${step}`} style={styles.step}>
                    <Text {...CAP_BODY} style={[styles.text, styles.stepNumber]}>{`${index + 1}.`}</Text>
                    <Text {...CAP_BODY} style={[styles.text, styles.stepText]}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : exercise.instructions ? (
              <Text {...CAP_BODY} testID="how-to-instructions" style={styles.text}>
                {exercise.instructions}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <AppModal
      testID="how-to-sheet"
      isOpen={open}
      onClose={onClose}
      title={name}
      size="2xl"
      footer={
        <ModalActions>
          <PillButton testID="how-to-close" title="Close" variant="secondary" fullWidth onPress={onClose} />
        </ModalActions>
      }
    >
      {body}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: spacing[8],
  },
  content: {
    gap: spacing[5],
  },
  section: {
    gap: spacing[3],
  },
  sectionTitle: {
    ...typography.titleXs,
    color: colors.textPrimary,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
  },
  steps: {
    gap: spacing[2],
  },
  step: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  stepNumber: {
    ...font(600),
    color: colors.textPrimary,
  },
  // aspect-video, object-contain (web).
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderRadius: radii.md,
    backgroundColor: colors.ground,
  },
  watch: {
    alignSelf: 'flex-start',
    minHeight: layout.touchMin,
    justifyContent: 'center',
  },
  watchText: {
    ...typography.labelLg,
    color: colors.gold,
  },
  watchPressed: {
    textDecorationLine: 'underline',
  },
  stepText: {
    flex: 1,
    minWidth: 0,
  },
});
