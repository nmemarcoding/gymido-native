import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getServerMessage } from '../../../shared/api/apiError';
import AppModal, { ModalActions } from '../../../shared/components/AppModal';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import ExerciseImage from '../../../shared/components/ExerciseImage';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import { CAP_BODY, TITLE_TEXT } from '../../../shared/components/largeText';
import { colors, font, spacing, typography } from '../../../shared/theme/tokens';
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

// Ready with nothing to show → no pill; loading or failed → the pill stays
// (the sheet shows the loader / the error with Retry).
export function showHowToPill(entry, sessionExercise) {
  if (!entry || entry.status !== 'ready') {
    return true;
  }
  return hasHowTo(entry.exercise) || Boolean(entry.exercise?.thumbnail?.url || sessionExercise?.exercise?.thumbnail?.url);
}

export default function HowToSheet({ open, sessionExercise, entry, onRetry, onClose }) {
  const name = exerciseName(sessionExercise);
  const exercise = entry?.status === 'ready' ? entry.exercise : null;
  const url = exercise?.thumbnail?.url || sessionExercise?.exercise?.thumbnail?.url || null;
  const steps = howToSteps(exercise?.instructions);

  let body;
  if (!entry || entry.status === 'loading') {
    body = <Loader label="Loading exercise" style={styles.loader} />;
  } else if (entry.status === 'error') {
    body = <ErrorAlert title="Could not load this exercise" description={entry.message} onRetry={onRetry} />;
  } else {
    body = (
      <View testID="how-to-content" style={styles.content}>
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
  stepText: {
    flex: 1,
    minWidth: 0,
  },
});
